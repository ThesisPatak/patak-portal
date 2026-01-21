import React, { useEffect, useState } from "react";

interface BillingPeriod {
  month: string;
  monthDate: Date;
  consumption: string;
  totalConsumption: string;
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

  // Match mobile app logic - generates billing history for 12 months of 2026 (Jan-Dec, Jan at top)
  function generateBillingHistory(readings: any[], createdAt: string): BillingPeriod[] {
    const history: BillingPeriod[] = [];
    const now = new Date();

    // Get the latest meter reading (cumulative total)
    const allReadings = readings || [];
    let latestMeterReading = 0;
    if (allReadings.length > 0) {
      const sorted = allReadings.sort((a: any, b: any) => {
        const dateA = a.receivedAt ? new Date(a.receivedAt) : new Date(a.timestamp);
        const dateB = b.receivedAt ? new Date(b.receivedAt) : new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });
      latestMeterReading = sorted[0].cubicMeters || 0;
    }

    // Generate 12 calendar months for 2026 (January to December)
    const year = 2026;

    for (let month = 0; month < 12; month++) {
      const periodStartDate = new Date(year, month, 1);
      const periodEndDate = new Date(year, month + 1, 1);

      // Get readings for this month
      const periodReadings = (readings || [])
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

      const monthStr = periodStartDate.toLocaleString('default', { month: 'long', year: 'numeric' });
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
        billStatus = 'Current';
        statusColor = '#4CAF50';
        statusIcon = '📊';
      } else if (now < periodStartDate) {
        billStatus = 'Upcoming';
        statusColor = '#2196F3';
        statusIcon = '📅';
      }

      // Total consumption only for past/current months, 0 for upcoming
      const totalConsumption = (billStatus === 'Upcoming') ? '0.000000' : latestMeterReading.toFixed(6);

      history.push({
        month: monthStr,
        monthDate: periodStartDate,
        consumption: consumption.toFixed(6),
        totalConsumption: totalConsumption,
        amountDue: amountDue.toFixed(2),
        billStatus,
        statusColor,
        statusIcon,
        dueDate: periodEndDate.toISOString().split('T')[0],
      });
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
              <th style={{ textAlign: 'right', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Total Consumption (m³)</th>
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
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{period.totalConsumption}</td>
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