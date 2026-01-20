import React, { useEffect, useState } from "react";

interface BillingPeriod {
  month: string;
  monthDate: Date;
  consumption: string;
  amountDue: string;
  billStatus: string;
  statusColor: string;
  statusIcon: string;
  dueDate: string;
}

const BillingTable: React.FC = () => {
  const [billingHistory, setBillingHistory] = useState<BillingPeriod[]>([]);
  const [usageData, setUsageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Match mobile app logic - generates billing history for 12 months
  function generateBillingHistory(readings: any[], createdAt: string): BillingPeriod[] {
    const history: BillingPeriod[] = [];
    const now = new Date();

    const hasData = readings && readings.length > 0;

    if (hasData) {
      const startDate = createdAt ? new Date(createdAt) : new Date();
      const billingStartDay = startDate.getDate();
      const billingStartMonth = startDate.getMonth();
      const billingStartYear = startDate.getFullYear();

      // Find current billing period (which month cycle are we in?)
      let currentMonthOffset = 0;

      for (let i = -24; i <= 24; i++) {
        let periodStartDate = new Date(billingStartYear, billingStartMonth + i, billingStartDay);
        let periodEndDate = new Date(billingStartYear, billingStartMonth + i + 1, billingStartDay);

        if (now >= periodStartDate && now < periodEndDate) {
          currentMonthOffset = i;
          break;
        }
      }

      // Generate 12 periods: current period + next 11 months
      for (let i = 0; i < 12; i++) {
        let periodStartDate = new Date(billingStartYear, billingStartMonth + currentMonthOffset + i, billingStartDay);
        let periodEndDate = new Date(billingStartYear, billingStartMonth + currentMonthOffset + i + 1, billingStartDay);

        const periodReadings = readings
          .filter((r) => {
            const readingDate = r.receivedAt ? new Date(r.receivedAt) : new Date(r.timestamp);
            return readingDate >= periodStartDate && readingDate < periodEndDate;
          })
          .sort((a, b) => {
            const dateA = a.receivedAt ? new Date(a.receivedAt) : new Date(a.timestamp);
            const dateB = b.receivedAt ? new Date(b.receivedAt) : new Date(b.timestamp);
            return dateA.getTime() - dateB.getTime();
          });

        let consumption = 0;
        if (periodReadings.length > 0) {
          const firstReading = periodReadings[0];
          const lastReading = periodReadings[periodReadings.length - 1];
          consumption = Math.max(0, lastReading.cubicMeters - firstReading.cubicMeters);
        }

        const monthStr = `${periodStartDate.toLocaleString('default', { month: 'short' })} ${periodStartDate.getDate()} - ${periodEndDate.toLocaleString('default', { month: 'short' })} ${periodEndDate.getDate()}`;
        const amountDue = computeResidentialBill(consumption);

        // Determine bill status
        let billStatus = 'Pending';
        let statusColor = '#ff9800';
        let statusIcon = '⏳';

        if (now > periodEndDate) {
          billStatus = 'Overdue';
          statusColor = '#ff6b6b';
          statusIcon = '🔴';
        } else if (now >= periodStartDate && now < periodEndDate) {
          billStatus = 'Pending';
          statusColor = '#ff9800';
          statusIcon = '⏳';
        } else if (now < periodStartDate) {
          billStatus = 'Upcoming';
          statusColor = '#2196F3';
          statusIcon = '📅';
        }

        history.push({
          month: monthStr,
          monthDate: periodStartDate,
          consumption: consumption.toFixed(6),
          amountDue: amountDue.toFixed(2),
          billStatus,
          statusColor,
          statusIcon,
          dueDate: periodEndDate.toISOString().split('T')[0],
        });
      }
    } else {
      // Default calendar months (no data)
      for (let i = 0; i < 12; i++) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);

        const monthStr = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

        let billStatus = 'Not yet active';
        if (i === 0) {
          billStatus = 'Current';
        } else if (i > 0) {
          billStatus = 'Upcoming';
        }

        history.push({
          month: monthStr,
          monthDate,
          consumption: '0.000000',
          amountDue: '0.00',
          billStatus,
          statusColor: '#999',
          statusIcon: '⏸️',
          dueDate: nextMonthDate.toISOString().split('T')[0],
        });
      }
    }

    return history;
  }

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get dashboard and usage data
        const [dashboardRes, usageRes] = await Promise.all([
          fetch('/api/houses'),
          fetch('/api/user/readings'),
        ]);

        if (dashboardRes.ok && usageRes.ok) {
          const dashboardData = await dashboardRes.json();
          const usageDataRaw = await usageRes.json();

          if (mounted) {
            setUsageData(dashboardData);

            // Generate billing history matching mobile app logic
            const history = generateBillingHistory(
              usageDataRaw.history || [],
              dashboardData.userCreatedAt || new Date().toISOString()
            );

            setBillingHistory(history);
          }
        } else {
          setError('Failed to load billing data');
        }
      } catch (e) {
        if (mounted) {
          setError((e as Error).message || 'Error loading billing history');
          setBillingHistory([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <section>
        <h2 style={{ color: "#0057b8", marginBottom: 12 }}>Billing History</h2>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#0057b8' }}>Loading billing history...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h2 style={{ color: "#0057b8", marginBottom: 12 }}>Billing History</h2>
        <div style={{ padding: '1rem', background: '#ffe6e6', color: '#c00', borderRadius: 6 }}>⚠️ {error}</div>
      </section>
    );
  }

  return (
    <section>
      <h2 style={{ color: "#0057b8", marginBottom: 12 }}>📋 Billing History (12 Months)</h2>
      {billingHistory.length === 0 ? (
        <div style={{ padding: '1rem', color: '#888' }}>No billing history available.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '12px 8px', background: '#fff' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Billing Period</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Consumption (m³)</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Amount Due (₱)</th>
              <th style={{ textAlign: 'center', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Due Date</th>
              <th style={{ textAlign: 'center', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {billingHistory.map((period, idx) => (
              <tr key={idx} style={{ background: '#ffffff', boxShadow: '0 1px 0 rgba(0,0,0,0.04)' }}>
                <td style={{ padding: '10px 12px', fontWeight: '500' }}>{period.month}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{period.consumption}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600' }}>₱{period.amountDue}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#555' }}>{period.dueDate}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: period.statusColor, fontWeight: '600' }}>
                  {period.statusIcon} {period.billStatus}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

export default BillingTable;