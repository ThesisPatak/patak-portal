import React, { useEffect, useState } from "react";
import { computeResidentialBill, generateBillingHistory, BillingPeriod } from "./billingUtils";

const BillingTable: React.FC = () => {
  const [billingHistory, setBillingHistory] = useState<BillingPeriod[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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