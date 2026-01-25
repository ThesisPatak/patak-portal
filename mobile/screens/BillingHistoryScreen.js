import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, SPACING } from './variables';

// Tiered billing formula matching web app (BillingTable.tsx)
function computeResidentialBill(usage) {
  const MINIMUM = 255.0;
  if (!usage || usage <= 10) return Number(MINIMUM.toFixed(2));
  let excess = usage - 10;
  let total = MINIMUM;
  if (excess > 0) {
    const m3 = Math.min(excess, 10);
    total += m3 * 33.0; // 11-20 m³
    excess -= m3;
  }
  if (excess > 0) {
    const m3 = Math.min(excess, 10);
    total += m3 * 40.5; // 21-30 m³
    excess -= m3;
  }
  if (excess > 0) {
    const m3 = Math.min(excess, 10);
    total += m3 * 48.0; // 31-40 m³
    excess -= m3;
  }
  if (excess > 0) {
    total += excess * 55.5; // 41+ m³
  }
  return Number(total.toFixed(2));
}

function generateBillingHistory(readings, createdAt, payments = []) {
  const history = [];
  const now = new Date();

  // Get the latest meter reading (cumulative total)
  const allReadings = readings || [];
  let latestMeterReading = 0;
  let firstReadingDate = null;
  
  if (allReadings.length > 0) {
    // Sort by date ascending to get first reading
    const sorted = allReadings.sort((a, b) => {
      const dateA = a.receivedAt ? new Date(a.receivedAt) : new Date(a.timestamp);
      const dateB = b.receivedAt ? new Date(b.receivedAt) : new Date(b.timestamp);
      return dateA.getTime() - dateB.getTime();
    });
    firstReadingDate = sorted[0].receivedAt ? new Date(sorted[0].receivedAt) : new Date(sorted[0].timestamp);
    
    // Get latest reading
    const sortedDesc = allReadings.sort((a, b) => {
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
  
  // Generate 12 billing periods starting from first reading date
  for (let i = 0; i < 12; i++) {
    const periodStartDate = new Date(firstReadingDate);
    periodStartDate.setMonth(periodStartDate.getMonth() + i);
    
    const periodEndDate = new Date(firstReadingDate);
    periodEndDate.setMonth(periodEndDate.getMonth() + i + 1);
    
    // Get readings for this period
    const periodReadings = (readings || []).filter((r) => {
      const readingDate = r.receivedAt ? new Date(r.receivedAt) : new Date(r.timestamp);
      return readingDate >= periodStartDate && readingDate < periodEndDate;
    }).sort((a, b) => {
      const dateA = a.receivedAt ? new Date(a.receivedAt) : new Date(a.timestamp);
      const dateB = b.receivedAt ? new Date(b.receivedAt) : new Date(b.timestamp);
      return dateA.getTime() - dateB.getTime();
    });
    
    let consumption = 0;
    
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
    
    // For current period, show latest meter reading. For past periods, show difference between readings
    if (billStatus === 'Current') {
      consumption = latestMeterReading;
    } else if (periodReadings.length > 0) {
      const firstReading = periodReadings[0];
      const lastReading = periodReadings[periodReadings.length - 1];
      consumption = Math.max(0, lastReading.cubicMeters - firstReading.cubicMeters);
    }
    
    const monthStr = periodStartDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const amountDue = computeResidentialBill(consumption);
    
    // Total consumption only for past/current periods, 0 for upcoming
    const totalConsumption = (billStatus === 'Upcoming') ? '0.000000' : latestMeterReading.toFixed(6);
    
    // Calculate billing month and year for this period
    const billingMonth = periodStartDate.getMonth() + 1;
    const billingYear = periodStartDate.getFullYear();
    
    // Check if payment exists and is verified for this billing period
    const payment = payments.find(p => 
      p.billingMonth === billingMonth && 
      p.billingYear === billingYear && 
      (p.status === 'verified' || p.status === 'PAID')
    );
    
    // Update status to PAID if payment found and is within billing period
    let paymentDate = '';
    if (payment && payment.createdAt) {
      const paymentTime = new Date(payment.createdAt);
      // Only show as PAID if payment was made during or within the billing period
      if (paymentTime >= periodStartDate && paymentTime <= periodEndDate) {
        billStatus = 'Paid';
        statusColor = '#059669';
        statusIcon = '✅';
        paymentDate = new Date(payment.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    }
    
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
      billingMonth,
      billingYear,
      paymentDate,
    });
  }
  
  return history;
}

export default function BillingHistoryScreen({ token, username, onBack }) {
  const [readings, setReadings] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  async function loadData() {
    try {
      setError(null);
      // Get user's dashboard data
      const dashboard = await Api.getDashboard(token);
      // Summary is keyed by deviceId, get first device if available
      const firstDeviceKey = Object.keys(dashboard?.summary || {})[0];
      const userData = dashboard?.summary?.[firstDeviceKey] || {};
      const dashboardRoot = dashboard || {}; // Keep root data for deviceCount
      setUserInfo({ 
        ...userData, 
        deviceCount: dashboardRoot.deviceCount || 0,
        userCreatedAt: dashboardRoot.userCreatedAt // Add root userCreatedAt
      });

      // Get user's readings
      const data = await Api.getUsage(token);
      const history = data.history || [];
      setReadings(history);

      // Get payment history FIRST before generating billing history
      let paymentsList = [];
      try {
        const paymentsRes = await fetch(`https://patak-portal-production.up.railway.app/api/payments/${encodeURIComponent(username)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          paymentsList = paymentsData.payments || [];
          setPayments(paymentsList);
        }
      } catch (paymentErr) {
        console.log('Could not load payments:', paymentErr);
        setPayments([]);
      }

      // Generate billing history - use dashboard userCreatedAt
      const createdAt = dashboardRoot.userCreatedAt || new Date().toISOString();
      const bills = generateBillingHistory(history, createdAt, paymentsList);
      setBillingHistory(bills);
    } catch (e) {
      console.error('Error loading data:', e);
      setError(e.message || 'Failed to load billing history');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    
    // Auto-refresh billing data every 3 seconds to catch payment updates
    const interval = setInterval(() => {
      loadData();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.glowBlue} />
        <Text style={{ color: COLORS.glowBlue, marginTop: 12 }}>Loading billing history...</Text>
      </View>
    );
  }

  const totalConsumption = userInfo?.totalConsumption || userInfo?.cubicMeters || 0;
  // Use root userCreatedAt from dashboard if available, fallback to device createdAt
  const createdDate = userInfo?.userCreatedAt 
    ? new Date(userInfo.userCreatedAt).toLocaleDateString() 
    : (userInfo?.createdAt ? new Date(userInfo.createdAt).toLocaleDateString() : 'Unknown');
  const deviceCount = userInfo?.deviceCount || 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.glowBlue} />}
      contentContainerStyle={{ padding: SPACING.base, paddingBottom: SPACING.large }}
    >
      {/* Back Button */}
      <TouchableOpacity onPress={onBack} style={{ marginBottom: SPACING.base }}>
        <Text style={{ color: COLORS.link, fontSize: 16, fontWeight: '600' }}>← Back to Dashboard</Text>
      </TouchableOpacity>

      {/* Title */}
      <Text style={[styles.title, { marginBottom: SPACING.large }]}>📋 Billing History</Text>

      {error && (
        <View style={{ backgroundColor: '#ff4444', padding: 12, marginBottom: 12, borderRadius: 8 }}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>⚠️ {error}</Text>
        </View>
      )}

      {/* User Information */}
      <View style={{ backgroundColor: '#1a3a52', padding: 16, borderRadius: 12, marginBottom: SPACING.large }}>
        <Text style={{ color: COLORS.glowBlue, fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
          User Information
        </Text>

        <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 12, borderRadius: 8, marginBottom: 8 }}>
          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 2 }}>Registered</Text>
            <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '600' }}>{createdDate}</Text>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 2 }}>Devices</Text>
            <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '600' }}>{deviceCount}</Text>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 2 }}>Total Consumption</Text>
            <Text style={{ color: COLORS.glowBlue, fontSize: 14, fontWeight: '600' }}>
              {totalConsumption.toFixed(6)} m³
            </Text>
          </View>
        </View>
      </View>

      {/* Billing History Table */}
      <View style={{ backgroundColor: '#1a3a52', padding: 16, borderRadius: 12, marginBottom: SPACING.large }}>
        <Text style={{ color: COLORS.glowBlue, fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
          Current Month + Upcoming
        </Text>

        {billingHistory.length === 0 ? (
          <Text style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>No billing history available</Text>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={billingHistory}
            keyExtractor={(item, idx) => `${item.month}-${idx}`}
            renderItem={({ item, index }) => {
              const isLastRow = index === billingHistory.length - 1;

              return (
                <View
                  style={{
                    backgroundColor: isLastRow ? 'rgba(0, 87, 184, 0.1)' : 'transparent',
                    padding: 12,
                    marginBottom: 8,
                    borderLeftWidth: 3,
                    borderLeftColor: COLORS.glowBlue,
                    borderRadius: 4,
                  }}
                >
                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ color: COLORS.glowBlue, fontWeight: '600', fontSize: 12 }}>
                      {item.month}
                    </Text>
                  </View>

                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ color: '#aaa', fontSize: 11, marginBottom: 2 }}>Consumption</Text>
                    <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '500' }}>
                      {item.consumption} m³
                    </Text>
                  </View>

                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ color: '#aaa', fontSize: 11, marginBottom: 2 }}>Total Consumption</Text>
                    <Text style={{ color: COLORS.glowBlue, fontSize: 13, fontWeight: '600' }}>
                      {item.totalConsumption} m³
                    </Text>
                  </View>

                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ color: '#aaa', fontSize: 11, marginBottom: 2 }}>Amount Due</Text>
                    <Text style={{ color: '#FFD700', fontSize: 13, fontWeight: '600' }}>
                      ₱{item.amountDue}
                    </Text>
                  </View>

                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ color: '#aaa', fontSize: 11, marginBottom: 2 }}>Due Date</Text>
                    <Text style={{ color: COLORS.text, fontSize: 12 }}>{item.dueDate}</Text>
                  </View>

                  <View>
                    <Text style={{ color: '#aaa', fontSize: 11, marginBottom: 2 }}>Status</Text>
                    {item.billStatus === 'Paid' && item.paymentDate ? (
                      <View>
                        <Text style={{ color: '#059669', fontSize: 12, fontWeight: '600' }}>
                          ✅ Paid
                        </Text>
                        <Text style={{ color: '#aaa', fontSize: 10, marginTop: 2 }}>
                          {item.paymentDate}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={{
                          color: item.statusColor || '#ff9800',
                          fontSize: 12,
                          fontWeight: '600',
                        }}
                      >
                        {item.statusIcon} {item.billStatus}
                      </Text>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    </ScrollView>
  );
}
