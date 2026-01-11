import React, { useEffect, useState } from "react";
import { usageData } from "./sampleData";

// Dynamically label all houses as 'House 1', 'House 2', etc.
const getHouseLabel = (houseKey: string, index: number) => `House ${index + 1}`;

const BillingTable: React.FC = () => {
  const [summary, setSummary] = useState<Record<string, any>>({});

  function computeResidentialBill(usage: number) {
    const MINIMUM = 255.0;
    if (!usage || usage <= 10) return Number(MINIMUM.toFixed(2));
    let excess = usage - 10;
    let total = MINIMUM;
    if (excess > 0) {
      const m3 = Math.min(excess, 10);
      total += m3 * 33.0; // 11-20
      excess -= m3;
    }
    if (excess > 0) {
      const m3 = Math.min(excess, 10);
      total += m3 * 40.5; // 21-30
      excess -= m3;
    }
    if (excess > 0) {
      const m3 = Math.min(excess, 10);
      total += m3 * 48.0; // 31-40
      excess -= m3;
    }
    if (excess > 0) {
      total += excess * 55.5; // 41+
    }
    return Number(total.toFixed(2));
  }

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/houses');
        if (!res.ok) throw new Error('no summary');
        const json = await res.json();
        if (mounted) setSummary(json.summary || {});
      } catch (e) {
        // ignore, we'll fallback to local sampleData
      }
    };
    load();
    return () => { mounted = false };
  }, []);

  // List all houses only if real backend data exists
  const houseKeys = Object.keys(summary).length ? Object.keys(summary) : [];

  return (
    <section>
      <h2 style={{ color: "#0057b8", marginBottom: 12 }}>Automated Billing</h2>
      {houseKeys.length === 0 ? (
        <div style={{ padding: '1rem', color: '#888' }}>No houses or devices yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '12px 8px', background: '#fff' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Household</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Usage (m³)</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Amount Due (₱)</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Due Date</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {houseKeys.map((houseKey, idx) => {
              const label = getHouseLabel(houseKey, idx);
              const fromSummary = summary[houseKey]?.cubicMeters;
              const usageRaw = fromSummary ?? 0;
              const usage = typeof usageRaw === 'number' ? usageRaw.toFixed(6) : usageRaw;
              return (
                <tr key={houseKey} style={{ background: '#ffffff', boxShadow: '0 1px 0 rgba(0,0,0,0.04)' }}>
                  <td style={{ padding: '10px 12px' }}>{label}</td>
                  <td style={{ padding: '10px 12px' }}>{usage}</td>
                  <td style={{ padding: '10px 12px' }}>{(() => {
                    const num = Number(usageRaw || 0);
                    const amt = computeResidentialBill(num);
                    return `₱${amt.toFixed(2)}`;
                  })()}</td>
                  <td style={{ padding: '10px 12px' }}>{(() => {
                    const num = Number(usageRaw || 0);
                    if (num === 0) return 'Not yet active';
                    const d = new Date();
                    d.setMonth(d.getMonth() + 1);
                    return d.toISOString().slice(0,10);
                  })()}</td>
                  <td style={{ padding: '10px 12px', color: '#c70039' }}>{Number(usageRaw) === 0 ? 'No data' : 'Unpaid'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
};

export default BillingTable;