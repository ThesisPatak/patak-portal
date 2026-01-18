import React, { useEffect, useState } from "react";

// Tiered water billing calculation
function calculateWaterBill(cubicMeters: number): number {
  const MINIMUM_CHARGE = 255.00;
  const FREE_USAGE = 10; // cubic meters included in minimum
  
  if (cubicMeters <= FREE_USAGE) {
    return MINIMUM_CHARGE;
  }
  
  const excess = cubicMeters - FREE_USAGE;
  
  // Apply tiered rates for usage above 10 m³
  const tier1 = Math.min(excess, 10);           // 11-20 m³: 33.00 per m³
  const tier2 = Math.min(Math.max(excess - 10, 0), 10);  // 21-30 m³: 40.50 per m³
  const tier3 = Math.min(Math.max(excess - 20, 0), 10);  // 31-40 m³: 48.00 per m³
  const tier4 = Math.max(excess - 30, 0);      // 41+ m³: 55.50 per m³
  
  const excessCharge = (tier1 * 33.00) + (tier2 * 40.50) + (tier3 * 48.00) + (tier4 * 55.50);
  
  return Math.round((MINIMUM_CHARGE + excessCharge) * 100) / 100;
}

interface UsageDashboardProps {
  token: string;
  username: string;
  onLogout: () => void;
}

type HouseSummary = {
  totalLiters: number;
  cubicMeters: number;
  last: any | null;
};

const UsageDashboard: React.FC<UsageDashboardProps> = ({ token, username, onLogout }) => {
  const [summary, setSummary] = useState<Record<string, HouseSummary>>({});
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Record<string, any[]>>({});
  const [invLoading, setInvLoading] = useState<Record<string, boolean>>({});
  const [lastReadings, setLastReadings] = useState<Record<string, any>>({});

  type ApiResponse = { summary?: Record<string, HouseSummary> };

  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;
    let reconnectMs = 1000;

    const fetchInitial = async () => {
      try {
        const res = await fetch('/api/houses', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch initial summary');
        const data: ApiResponse = await res.json();
        if (!closed) setSummary(data.summary || {});
      } catch (err) {
        console.error(err);
      } finally {
        if (!closed) setLoading(false);
      }
    };

    fetchInitial();

    const connect = () => {
      try {
        // EventSource doesn't support custom headers, so pass token in query string
        // The server validates this in the authMiddleware
        es = new EventSource(`/api/stream?token=${encodeURIComponent(token)}`);
      } catch (err) {
        console.error('Failed to create EventSource', err);
        setTimeout(connect, reconnectMs);
        reconnectMs = Math.min(30000, reconnectMs * 2);
        return;
      }

      es.addEventListener('summary', (e) => {
        try {
          const msg = JSON.parse((e as MessageEvent).data);
          if (!closed) setSummary(msg.summary || {});
        } catch (err) {
          console.error('Invalid SSE summary', err);
        }
        reconnectMs = 1000;
        if (!closed) setLoading(false);
      });

      // also listen for single-reading events so we can show LCD-like details immediately
      es.addEventListener('reading', (e) => {
        try {
          const reading = JSON.parse((e as MessageEvent).data);
          const h = reading.house || 'unknown';
          // update lastReadings for quick display
          setLastReadings(prev => ({ ...prev, [h]: reading }));
          // update summary for the house as well
          setSummary(prev => ({
            ...prev,
            [h]: {
              totalLiters: typeof reading.totalLiters === 'number' ? reading.totalLiters : (reading.totalLiters ? Number(reading.totalLiters) : (prev[h]?.totalLiters ?? 0)),
              cubicMeters: typeof reading.cubicMeters === 'number' ? reading.cubicMeters : (reading.cubicMeters ? Number(reading.cubicMeters) : (prev[h]?.cubicMeters ?? 0)),
              last: reading,
            }
          }));
        } catch (err) {
          console.error('Invalid SSE reading', err);
        }
      });

      es.onopen = () => {
        reconnectMs = 1000;
      };

      es.onerror = (err) => {
        console.error('SSE error', err);
        if (!es) return;
        if (es.readyState === EventSource.CLOSED) {
          es.close();
          if (!closed) {
            setTimeout(connect, reconnectMs);
            reconnectMs = Math.min(30000, reconnectMs * 2);
          }
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (es) es.close();
    };
  }, []);

  async function fetchInvoices(house: string) {
    setInvLoading(prev => ({ ...prev, [house]: true }));
    try {
      const res = await fetch(`/api/billing/invoices/${house}`);
      if (!res.ok) throw new Error('Failed to fetch invoices');
      const data = await res.json();
      setInvoices(prev => ({ ...prev, [house]: data.invoices || [] }));
    } catch (err) {
      console.error('Invoice fetch error', err);
    } finally {
      setInvLoading(prev => ({ ...prev, [house]: false }));
    }
  }

  async function generateInvoice(house: string) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = now.toISOString();
    setInvLoading(prev => ({ ...prev, [house]: true }));
    try {
      const res = await fetch('/api/billing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ house, start, end }),
      });
      if (!res.ok) throw new Error('Failed to generate invoice');
      const json = await res.json();
      await fetchInvoices(house);
      return json.invoice;
    } catch (err) {
      console.error('Generate invoice error', err);
      return null;
    } finally {
      setInvLoading(prev => ({ ...prev, [house]: false }));
    }
  }

  const allKeys = Object.keys(summary).length ? Object.keys(summary) : [];
  
  // Create mapping of lowercase keys to original keys to preserve case-sensitive lookups
  const keyMap: Record<string, string> = {};
  allKeys.forEach(k => {
    keyMap[k.toLowerCase()] = k;
  });

  // normalize keys and filter out obvious test entries (0.1 m³ or 100 liters)
  const houses = allKeys
    .map(k => k.toString().toLowerCase())
    .filter((k, i, arr) => arr.indexOf(k) === i) // dedupe
    .filter(k => {
      const originalKey = keyMap[k];
      const s = summary[originalKey] || {};
      const cm = Number(s?.cubicMeters ?? s?.last?.cubicMeters ?? 0);
      const tl = Number(s?.totalLiters ?? s?.last?.totalLiters ?? 0);
      if (cm === 0.1 || tl === 100) return false;
      return true;
    });
  const totalUsageNumber = houses.reduce((s, h) => s + (summary[keyMap[h]]?.cubicMeters || 0), 0);
  const totalUsage = totalUsageNumber.toFixed(3);
  const totalBill = calculateWaterBill(totalUsageNumber).toFixed(2);
  // Label houses as 'House 1', 'House 2', etc.
  const HOUSE_LABELS: Record<string, string> = {};
  houses.forEach((h, i) => {
    HOUSE_LABELS[h] = `House ${i + 1}`;
  });

  // Per-device readings state
  const [deviceReadings, setDeviceReadings] = useState<Record<string, Record<string, any[]>>>({});

  // Fetch per-device readings for each house
  useEffect(() => {
    const fetchDeviceReadings = () => {
      houses.forEach(houseId => {
        const originalDeviceId = keyMap[houseId];
        fetch(`/api/readings/${originalDeviceId}`)
          .then(res => res.json())
          .then(data => {
            setDeviceReadings(prev => ({ ...prev, [houseId]: data.byDevice || {} }));
          })
          .catch(() => {});
      });
    };

    // Fetch immediately when houses change
    fetchDeviceReadings();

    // Also poll for updates every 5 seconds to show latest readings
    const interval = setInterval(fetchDeviceReadings, 5000);

    return () => clearInterval(interval);
  }, [houses.join(",")]);

  return (
    <>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "2rem",
        paddingBottom: "1rem",
        borderBottom: "1px solid #e0e0e0"
      }}>
        <div>
          <h2 style={{ margin: 0, color: "#0057b8" }}>Welcome, {username}</h2>
          <small style={{ color: "#666" }}>Your water usage dashboard</small>
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: "0.5rem 1rem",
            background: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.9rem",
            color: "#333"
          }}
        >
          Log Out
        </button>
      </div>

      <section>
        <h2 style={{ color: "#0057b8" }}>Real-Time Water Usage</h2>
        {houses.length === 0 ? (
          <div style={{ padding: '1rem', color: '#888' }}>No houses or devices yet.</div>
        ) : (
          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", flexWrap: "wrap" }}>
            <div style={{ padding: "1rem", background: "#e2f3ff", borderRadius: "12px", flex: "1 1 140px", minWidth: "140px" }}>
              <h4 style={{ margin: "0" }}>Total (m³)</h4>
              <p style={{ fontSize: "1.5rem", margin: "0.25rem 0", color: "#0057b8" }}>{Number(totalUsage).toFixed(3)}</p>
              <small>Across all houses</small>
            </div>

            {houses.map((h) => (
              <div key={h} style={{ padding: "1rem", background: "#fff", borderRadius: "10px", flex: "1 1 240px", minWidth: "240px", boxShadow: "0 2px 6px #0000000f" }}>
                <h4 style={{ margin: "0 0 0.5rem 0" }}>{HOUSE_LABELS[h] || h}</h4>
                <p style={{ margin: 0, fontSize: "1.1rem" }}>{Number(summary[keyMap[h]]?.cubicMeters ?? 0).toFixed(3)} m³</p>
                <small style={{ color: "#666" }}> {
                  summary[keyMap[h]]?.last && summary[keyMap[h]].last.timestamp
                    ? new Date(summary[keyMap[h]].last.timestamp).toLocaleTimeString()
                    : (loading ? "loading..." : "no data")
                }</small>
                {(deviceReadings[h] && Object.keys(deviceReadings[h]).length > 0) && (
                  <div style={{ marginTop: 8 }}>
                    <b>Per-device readings:</b>
                    <ul style={{ fontSize: '0.95rem', color: '#333', margin: 0, padding: 0, listStyle: 'none' }}>
                      {Object.entries(deviceReadings[h]).map(([dev, readings]) => (
                        <li key={dev} style={{ marginBottom: 4 }}>
                          <span style={{ fontWeight: 600 }}>{dev}:</span> {Array.isArray(readings) && readings.length > 0 ? `${readings[readings.length-1].data?.cubicMeters ?? readings[readings.length-1].data?.volume ?? '-'} m³ (last)` : 'no data'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
};

export default UsageDashboard;