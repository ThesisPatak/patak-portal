import React, { useEffect, useState } from 'react';

interface PendingPayment {
  id: string;
  userId: string;
  username: string;
  amount: number;
  billingMonth: number;
  billingYear: number;
  referenceNumber: string;
  submittedAt: string;
  status: 'pending_verification' | 'verified' | 'rejected';
}

interface AdminGCashPaymentsProps {
  token: string;
}

const AdminGCashPayments: React.FC<AdminGCashPaymentsProps> = ({ token }: AdminGCashPaymentsProps) => {
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const API_URL = 'https://patak-portal-production.up.railway.app';

  // Load pending payments
  const loadPayments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/admin/gcash/pending`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error('Failed to load pending payments');
      
      const data = await res.json();
      setPayments(data.pending || []);
    } catch (err: any) {
      console.error(err);
      setMessage('Error loading payments: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Verify payment by reference number
  const verifyByReference = async () => {
    const reference = window.prompt('Enter reference number from GCash transaction:', '');
    if (!reference) return;

    try {
      const matching = payments.find(p => 
        p.referenceNumber.toUpperCase().includes(reference.toUpperCase()) ||
        reference.toUpperCase().includes(p.referenceNumber.substring(0, 10))
      );

      if (!matching) {
        alert('No pending payment found with that reference number');
        return;
      }

      await verifyPayment(matching.id);
    } catch (err: any) {
      setMessage('✗ Error: ' + (err.message || err));
    }
  };

  // Verify payment
  const verifyPayment = async (paymentId: string) => {
    if (!window.confirm('Confirm this GCash payment has been received?')) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/gcash/verify/${paymentId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify');

      setMessage('✓ Payment verified successfully');
      await loadPayments();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage('✗ Error: ' + (err.message || err));
    }
  };

  // Reject payment
  const rejectPayment = async (paymentId: string) => {
    const reason = window.prompt('Reason for rejection:', 'Amount mismatch');
    if (!reason) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/gcash/reject/${paymentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject');

      setMessage('✓ Payment rejected');
      await loadPayments();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage('✗ Error: ' + (err.message || err));
    }
  };

  useEffect(() => {
    loadPayments();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadPayments, 10000);
    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [token]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: '0.5rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>� GCash Pending Payments</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={verifyByReference}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: '#059669',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            🔍 Verify by Reference
          </button>
          <button
            onClick={loadPayments}
            disabled={loading}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: '#0066CC',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {message && (
        <div
          style={{
            marginBottom: 12,
            padding: '0.75rem',
            backgroundColor: message.includes('✗') ? '#fee' : '#efe',
            borderLeft: `4px solid ${message.includes('✗') ? '#b00' : '#0b0'}`,
            color: message.includes('✗') ? '#b00' : '#0b0',
            borderRadius: 4,
            fontSize: '0.9rem',
          }}
        >
          {message}
        </div>
      )}

      {payments.length === 0 ? (
        <div
          style={{
            padding: '2rem',
            backgroundColor: '#f5f5f5',
            borderRadius: 8,
            textAlign: 'center',
            color: '#666',
          }}
        >
          {loading ? '⏳ Loading...' : '✓ No pending payments'}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          }}
        >
          {payments.map((payment: PendingPayment) => (
            <div
              key={payment.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 12,
                padding: '1rem',
                backgroundColor: '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              {/* Header */}
              <div style={{ marginBottom: '1rem' }}>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: '#0066CC',
                    marginBottom: '0.25rem',
                  }}
                >
                  ₱{payment.amount.toFixed(2)}
                </div>
                <div style={{ color: '#666', fontSize: '0.9rem' }}>
                  {payment.username} • {monthNames[payment.billingMonth - 1]} {payment.billingYear}
                </div>
              </div>

              {/* Details */}
              <div
                style={{
                  backgroundColor: '#f9f9f9',
                  padding: '0.75rem',
                  borderRadius: 8,
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#666' }}>Reference:</span>
                  <br />
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{payment.referenceNumber}</span>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#666' }}>Submitted:</span>
                  <br />
                  {new Date(payment.submittedAt).toLocaleString()}
                </div>
                <div>
                  <span style={{ color: '#666' }}>Status:</span>
                  <br />
                  <span
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#fff3cd',
                      color: '#856404',
                      padding: '0.25rem 0.5rem',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    ⏳ Pending Verification
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => verifyPayment(payment.id)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: '#059669',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  ✓ Verify Payment
                </button>
                <button
                  onClick={() => rejectPayment(payment.id)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  ✗ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminGCashPayments;
