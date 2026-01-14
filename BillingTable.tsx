import React, { useEffect, useState } from "react";
import { usageData } from "./sampleData";

// Dynamically label all houses as 'House 1', 'House 2', etc.
const getHouseLabel = (houseKey: string, index: number) => `House ${index + 1}`;

const BillingTable: React.FC = () => {
  const [summary, setSummary] = useState<Record<string, any>>({});
  const [userCreatedAt, setUserCreatedAt] = useState<string>(new Date().toISOString());

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
        if (mounted) {
          setSummary(json.summary || {});
          setUserCreatedAt(json.userCreatedAt || new Date().toISOString());
        }
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
      <h2 style={{ color: "#0057b8", marginBottom: 12 }}>User's Accounts</h2>
      {houseKeys.length === 0 ? (
        <div style={{ padding: '1rem', color: '#888' }}>No houses or devices yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '12px 8px', background: '#fff' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Household</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Device Status</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Usage (m³)</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Amount Due (₱)</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Due Date</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Bill Status</th>
            </tr>
          </thead>
          <tbody>
            {houseKeys.map((houseKey, idx) => {
              const label = getHouseLabel(houseKey, idx);
              const fromSummary = summary[houseKey]?.cubicMeters;
              const usageRaw = fromSummary ?? 0;
              const usage = typeof usageRaw === 'number' ? usageRaw.toFixed(6) : usageRaw;
              const isOnline = summary[houseKey]?.isOnline ?? false;
              const statusColor = isOnline ? '#4caf50' : '#ff6b6b';
              const statusText = isOnline ? '🟢 Online' : '🔴 Offline';
              
              // Calculate bill status
              const getBillStatus = () => {
                const num = Number(usageRaw || 0);
                if (num === 0 || !summary[houseKey]?.lastReading?.timestamp) return { text: 'Not yet active', color: '#999' };
                
                const firstReadingDate = new Date(summary[houseKey].lastReading.timestamp);
                const dueDate = new Date(firstReadingDate);
                dueDate.setMonth(dueDate.getMonth() + 1);
                
                const now = new Date();
                if (now > dueDate) {
                  return { text: '🔴 Overdue', color: '#ff6b6b' };
                } else {
                  return { text: '⏳ Pending', color: '#ff9800' };
                }
              };
              
              const billStatus = getBillStatus();
              
              return (
                <tr key={houseKey} style={{ background: '#ffffff', boxShadow: '0 1px 0 rgba(0,0,0,0.04)' }}>
                  <td style={{ padding: '10px 12px' }}>{label}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {(() => {
                      // Get device status from the house data
                      const houseData = summary[houseKey];
                      const lastReading = houseData?.last;
                      if (!lastReading) return <span style={{ color: '#ff6b6b', fontWeight: '600' }}>🔴 Offline</span>;
                      
                      // Check if device is online (had activity in last 5 minutes)
                      const lastSeenTime = lastReading.receivedAt ? new Date(lastReading.receivedAt).getTime() : new Date(lastReading.timestamp).getTime();
                      const now = Date.now();
                      const isOnline = (now - lastSeenTime) < 5 * 60 * 1000;
                      
                      return isOnline ? 
                        <span style={{ color: '#4caf50', fontWeight: '600' }}>🟢 Active</span> : 
                        <span style={{ color: '#ff6b6b', fontWeight: '600' }}>🔴 Offline</span>;
                    })()}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{usage}</td>
                  <td style={{ padding: '10px 12px' }}>{(() => {
                    const num = Number(usageRaw || 0);
                    const amt = computeResidentialBill(num);
                    return `₱${amt.toFixed(2)}`;
                  })()}</td>
                  <td style={{ padding: '10px 12px' }}>{(() => {
                    const num = Number(usageRaw || 0);
                    if (num === 0 || !summary[houseKey]?.lastReading?.timestamp) return 'Not yet active';
                    const firstReadingDate = new Date(summary[houseKey].lastReading.timestamp);
                    const dueDate = new Date(firstReadingDate);
                    dueDate.setMonth(dueDate.getMonth() + 1);
                    return dueDate.toISOString().slice(0,10);
                  })()}</td>
                  <td style={{ padding: '10px 12px', color: billStatus.color, fontWeight: '600' }}>{billStatus.text}</td>
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