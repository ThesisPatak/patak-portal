import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, SPACING } from './variables';
import { computeResidentialBill, generateBillingHistory } from '../api/billingUtils';

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
        const baseUrl = await Api.getServerUrl();
        const paymentsRes = await fetch(`${baseUrl}/api/payments/${encodeURIComponent(username)}`, {
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
          Billing Cycles (Current + Next)
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
                        {item.statusIcon} {item.billStatus || 'Pending'}
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
