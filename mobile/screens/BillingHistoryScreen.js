import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, SPACING } from './variables';

function generateBillingHistory(readings, createdAt) {
  const history = [];
  const now = new Date();
  
  // Check if we have actual data
  const hasData = readings && readings.length > 0;
  
  if (hasData) {
    // Use account creation date for billing cycles, NOT the reading timestamp
    // (readings may have incorrect 1970 timestamps due to NTP sync issues)
    const startDate = createdAt ? new Date(createdAt) : new Date();
    const billingStartDay = startDate.getDate();
    const billingStartMonth = startDate.getMonth();
    const billingStartYear = startDate.getFullYear();
    
    // Find current billing period (which month cycle are we in?)
    let currentMonthOffset = 0;
    let foundCurrentPeriod = false;
    
    // Look backwards to find where current date falls
    for (let i = -12; i <= 0; i++) {
      let periodStartDate = new Date(billingStartYear, billingStartMonth + i, billingStartDay);
      let periodEndDate = new Date(billingStartYear, billingStartMonth + i + 1, billingStartDay);
      
      if (now >= periodStartDate && now < periodEndDate) {
        currentMonthOffset = i;
        foundCurrentPeriod = true;
        break;
      }
    }
    
    // Generate 12 periods: current period + next 11 months (forward from now)
    for (let i = 0; i < 12; i++) {
      let periodStartDate = new Date(billingStartYear, billingStartMonth + currentMonthOffset + i, billingStartDay);
      let periodEndDate = new Date(billingStartYear, billingStartMonth + currentMonthOffset + i + 1, billingStartDay);
      
      const periodReadings = readings.filter((r) => {
        // Use receivedAt (server time) instead of timestamp (may be 1970)
        const readingDate = r.receivedAt ? new Date(r.receivedAt) : new Date(r.timestamp);
        return readingDate >= periodStartDate && readingDate < periodEndDate;
      }).sort((a, b) => {
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
      const amountDue = consumption * 15;
      
      // Determine bill status
      let billStatus = 'Pending';
      if (now > periodEndDate) {
        billStatus = 'Overdue';
      } else if (now >= periodStartDate && now < periodEndDate) {
        billStatus = 'Current';
      } else if (now < periodStartDate) {
        billStatus = 'Upcoming';
      }
      
      history.push({
        month: monthStr,
        monthDate: periodStartDate,
        consumption: consumption.toFixed(6),
        amountDue: amountDue.toFixed(2),
        billStatus,
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
        dueDate: nextMonthDate.toISOString().split('T')[0],
      });
    }
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
      const userData = dashboard?.summary?.[username] || {};
      setUserInfo(userData);

      // Get user's readings
      const data = await Api.getUsage(token);
      const history = data.history || [];
      setReadings(history);

      // Generate billing history
      const createdAt = userData.createdAt || new Date().toISOString();
      const bills = generateBillingHistory(history, createdAt);
      setBillingHistory(bills);
      
      // Get payment history
      try {
        const paymentsRes = await fetch(`https://patak-portal-production.up.railway.app/api/payments/${encodeURIComponent(username)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          setPayments(paymentsData.payments || []);
        }
      } catch (paymentErr) {
        console.log('Could not load payments:', paymentErr);
        setPayments([]);
      }
    } catch (e) {
      console.error('Error loading data:', e);
      setError(e.message || 'Failed to load billing history');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
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

  const totalConsumption = userInfo?.cubicMeters || 0;
  const createdDate = userInfo?.createdAt ? new Date(userInfo.createdAt).toLocaleDateString() : 'Unknown';
  const deviceCount = userInfo?.deviceCount || 0;
  const lastReading = userInfo?.lastReading ? new Date(userInfo.lastReading.timestamp).toLocaleString() : 'No data yet';

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

          <View>
            <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 2 }}>Last Reading</Text>
            <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '600' }}>{lastReading}</Text>
          </View>
        </View>
      </View>

      {/* Billing History Table */}
      <View style={{ backgroundColor: '#1a3a52', padding: 16, borderRadius: 12, marginBottom: SPACING.large }}>
        <Text style={{ color: COLORS.glowBlue, fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
          Last 12 Months
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
              const displayTotal = isLastRow ? totalConsumption : billingHistory.slice(0, index + 1).reduce((sum, b) => sum + parseFloat(b.consumption), 0);

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
                    <Text style={{ color: '#aaa', fontSize: 11, marginBottom: 2 }}>User's Total Consumption</Text>
                    <Text style={{ color: COLORS.glowBlue, fontSize: 13, fontWeight: '600' }}>
                      {displayTotal.toFixed(6)} m³
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
                    {(() => {
                      const payment = payments.find(p => {
                        const billDate = new Date(item.dueDate);
                        return p.billingMonth === (billDate.getMonth() + 1) && p.billingYear === billDate.getFullYear();
                      });
                      
                      if (payment) {
                        return (
                          <View>
                            <Text style={{ color: '#4caf50', fontSize: 12, fontWeight: '600' }}>
                              ✅ Paid
                            </Text>
                            <Text style={{ color: '#aaa', fontSize: 10, marginTop: 2 }}>
                              on {new Date(payment.paymentDate).toLocaleDateString()}
                            </Text>
                          </View>
                        );
                      }
                      
                      return (
                        <Text
                          style={{
                            color:
                              item.billStatus === 'Overdue'
                                ? '#ff6b6b'
                                : '#ff9800',
                            fontSize: 12,
                            fontWeight: '600',
                          }}
                        >
                          {item.billStatus === 'Pending' && '⏳ '}{item.billStatus === 'Overdue' && '🔴 '}{item.billStatus === 'Upcoming' && '📅 '}{item.billStatus}
                        </Text>
                      );
                    })()}
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
