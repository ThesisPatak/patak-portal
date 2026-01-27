import React, { useEffect, useState } from "react";

interface BillingPeriod {
  month: string;
  consumption: string;
  totalConsumption: string;
  amountDue: string;
  billStatus: string;
  statusColor: string;
  statusIcon: string;
  dueDate: string;
  paymentDate?: string;
  paymentAmount?: string;
}

const BillingTable: React.FC = () => {
  const [billingHistory, setBillingHistory] = useState<BillingPeriod[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function computeResidentialBill(usage: number) {
    const MINIMUM = 255.0;
    if (!usage || usage <= 0) return 0;
    if (usage <= 10) return Number(MINIMUM.toFixed(2));
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

  // Generates billing history based on first reading date + 31-day cycles
  function generateBillingHistory(readings: any[], createdAt: string, payments: any[] = []): BillingPeriod[] {
    const history: BillingPeriod[] = [];

    // Get the latest meter reading (cumulative total)
    const allReadings = readings || [];
    let latestMeterReading = 0;
    let firstReadingDate: Date | null = null;
    
    if (allReadings.length > 0) {
      // Sort by date ascending to get first reading
      const sorted = allReadings.sort((a: any, b: any) => {
        const dateA = a.receivedAt ? new Date(a.receivedAt) : new Date(a.timestamp);
        const dateB = b.receivedAt ? new Date(b.receivedAt) : new Date(b.timestamp);
        return dateA.getTime() - dateB.getTime();
      });
      firstReadingDate = sorted[0].receivedAt ? new Date(sorted[0].receivedAt) : new Date(sorted[0].timestamp);
      
      // Get latest reading
      const sortedDesc = allReadings.sort((a: any, b: any) => {
        const dateA = a.receivedAt ? new Date(a.receivedAt) : new Date(a.timestamp);
        const dateB = b.receivedAt ? new Date(b.receivedAt) : new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });
      latestMeterReading = sortedDesc[0].cubicMeters || 0;
    }

    // If no readings, use createdAt as reference
    if (!firstReadingDate) {
      firstReadingDate = new Date(createdAt);
    }

    // Generate current + next 31-day billing period (continuous billing cycle)
    // Limit to 2 cycles maximum
    const maxCycles = 2;
    for (let i = 0; i < maxCycles; i++) {
      const periodStartDate = new Date(firstReadingDate);
      periodStartDate.setDate(periodStartDate.getDate() + (i * 31));
      
      const periodEndDate = new Date(periodStartDate);
      periodEndDate.setDate(periodEndDate.getDate() + 31);

      // Get readings for this period
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

      // Status will be determined after payment check
      let billStatus = 'Pending';
      let statusColor = '#ff9800';
      let statusIcon = '⏳';

      // Calculate consumption as DIFFERENCE between period readings (not cumulative total)
      // This properly resets with each billing period
      if (periodReadings.length > 0) {
        const firstReading = periodReadings[0];
        const lastReading = periodReadings[periodReadings.length - 1];
        // Consumption = Meter at period end - Meter at period start
        consumption = Math.max(0, lastReading.cubicMeters - firstReading.cubicMeters);
      }
      // Note: For periods with no readings, consumption stays 0
      // which will trigger minimum charge in computeResidentialBill()

      const monthStr = periodStartDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      const amountDue = computeResidentialBill(consumption);

      // Total consumption shows the cumulative meter reading
      // For upcoming periods with no consumption data yet, still apply minimum charge
      const totalConsumption = latestMeterReading.toFixed(6);

      // Calculate billing month and year for this period
      const billingMonth = periodStartDate.getMonth() + 1;
      const billingYear = periodStartDate.getFullYear();

      // Check if payment exists and is verified for this billing period
      const payment = payments.find(p => 
        p.billingMonth === billingMonth && 
        p.billingYear === billingYear && 
        (p.status === 'verified' || p.status === 'PAID')
      );

      // Update status to PAID if payment found
      let paymentDate = '';
      let paymentAmount = '';
      let isPaid = false;
      if (payment && payment.createdAt) {
        billStatus = 'Paid';
        statusColor = '#059669';
        statusIcon = '✅';
        isPaid = true;
        paymentDate = new Date(payment.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        paymentAmount = payment.amount ? `₱${Number(payment.amount).toFixed(2)}` : '';
      }

      history.push({
        month: monthStr,
        consumption: consumption.toFixed(6),
        totalConsumption: totalConsumption,
        amountDue: amountDue.toFixed(2),
        billStatus,
        statusColor,
        statusIcon,
        dueDate: periodEndDate.toISOString().split('T')[0],
        paymentDate,
        paymentAmount,
      });
    }

    // Only show current cycle, and next cycle only if current is paid
    let visibleCycles = [];
    
    if (history.length > 0) {
      const firstCyclePaid = !!payments.find(p => 
        p.billingMonth === history[0].dueDate?.split('-')[1] && 
        p.billingYear === history[0].dueDate?.split('-')[0] &&
        (p.status === 'verified' || p.status === 'PAID')
      );
      
      if (firstCyclePaid) {
        // First cycle is paid, show it as Paid and next as Current
        history[0].billStatus = 'Paid';
        history[0].statusColor = '#059669';
        history[0].statusIcon = '✅';
        visibleCycles.push(history[0]);
        
        // Show second cycle as Current if available
        if (history.length > 1) {
          history[1].billStatus = 'Current';
          history[1].statusColor = '#4CAF50';
          history[1].statusIcon = '📊';
          visibleCycles.push(history[1]);
        }
      } else {
        // First cycle is not paid, show it as Current only
        history[0].billStatus = 'Current';
        history[0].statusColor = '#4CAF50';
        history[0].statusIcon = '📊';
        visibleCycles.push(history[0]);
      }
    }

    return visibleCycles;
  }

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get dashboard, usage data, and payment data
        const [dashboardRes, usageRes, paymentsRes] = await Promise.all([
          fetch('/api/houses'),
          fetch('/api/user/readings'),
          fetch('/api/payments').catch(() => ({ ok: false })),
        ]);

        if (dashboardRes.ok && usageRes.ok) {
          const dashboardData = await dashboardRes.json();
          const usageDataRaw = await usageRes.json();
          let paymentsData: any[] = [];

          // Fetch payments if endpoint available
          if (paymentsRes.ok) {
            const paymentResponse = await paymentsRes.json();
            paymentsData = paymentResponse.payments || [];
          }

          if (mounted) {
            setPayments(paymentsData);

            // Generate billing history with payment status
            const filteredHistory = generateBillingHistory(
              usageDataRaw.history || [],
              dashboardData.userCreatedAt || new Date().toISOString(),
              paymentsData
            );

            setBillingHistory(filteredHistory);
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
      <h2 style={{ color: "#0057b8", marginBottom: 12 }}>📋 Billing Period (Current + Next)</h2>
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
              <th style={{ textAlign: 'center', padding: '8px 12px', background: '#f3f7fb', borderRadius: 6 }}>Payment Details</th>
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
                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                  {period.paymentDate ? (
                    <div>
                      <div style={{ fontWeight: '600', color: '#059669' }}>Paid</div>
                      <div style={{ fontSize: '11px', marginTop: '4px' }}>{period.paymentDate}</div>
                      {period.paymentAmount && <div style={{ fontSize: '11px', marginTop: '2px' }}>{period.paymentAmount}</div>}
                    </div>
                  ) : (
                    <span style={{ color: '#999' }}>—</span>
                  )}
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