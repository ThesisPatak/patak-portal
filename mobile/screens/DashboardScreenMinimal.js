import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Animated, Alert } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, TYPO, SPACING } from './variables';
import { computeResidentialBill } from '../api/billingUtils';

export default function DashboardScreen({ token, username, onOpenBilling, onLogout, onPay, onOpenDevices }) {
  const [summary, setSummary] = useState({ summary: {} });
  const [usageHistory, setUsageHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const glowAnim = React.useRef(new Animated.Value(0)).current;

  // Load dashboard data with polling
  useEffect(() => {
    console.log('DashboardScreen: Mounting with token=', token);
    let mounted = true;
    let stopped = false;
    async function load() {
      if (mounted) await loadDashboard();
    }
    load();
    const id = setInterval(() => { if (!stopped && mounted) load(); }, 1000);
    return () => { stopped = true; mounted = false; clearInterval(id); };
  }, [token]);

  // Glow animation
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: false })
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [glowAnim]);

  const loadDashboard = async () => {
    try {
      if (!loading) setLoading(true);
      setError(null);
      const data = await Api.getDashboard(token);
      setSummary(data || { summary: {} });
      
      // Load usage history to calculate present and previous
      try {
        const history = await Api.getUsage(token);
        setUsageHistory(history || []);
      } catch (histErr) {
        console.log('Could not load usage history:', histErr);
        setUsageHistory([]);
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError(err.message || 'Failed to load dashboard');
      setSummary({ summary: {} });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: SPACING.large }}>
        <Text style={{ color: COLORS.glowBlue, fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Loading Dashboard...</Text>
      </View>
    );
  }

  // Use same logic as web app - access consumption metrics from summary
  const summaryData = summary?.summary || summary || {};
  const devices = Object.values(summaryData);
  
  // Get consumption metrics directly from API response
  const currentUsage = devices.reduce((sum, d) => sum + (Number(d?.currentConsumption) || 0), 0);
  const previousUsage = devices.reduce((sum, d) => sum + (Number(d?.previousConsumption) || 0), 0);
  const totalConsumption = devices.reduce((sum, d) => sum + (Number(d?.totalConsumption) || 0), 0);
  const totalUsage = totalConsumption; // Alias for clarity
  
  // Calculate due date from first device's first reading
  const getDueDate = () => {
    const allDevices = devices.filter(d => d && d.lastReading && d.lastReading.timestamp);
    if (allDevices.length === 0) return 'Not yet active';
    const firstReading = new Date(allDevices[0].lastReading.timestamp);
    const dueDate = new Date(firstReading);
    dueDate.setMonth(dueDate.getMonth() + 1);
    return dueDate.toISOString().slice(0, 10);
  };
  const dueDate = getDueDate();

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: COLORS.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.glowBlue} />}
      contentContainerStyle={{ padding: SPACING.base, paddingBottom: SPACING.large * 2 }}
    >
      {error && (
        <View style={{ backgroundColor: '#ff0055', padding: 12, borderRadius: 8, marginBottom: SPACING.large }}>
          <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>Error: {error}</Text>
          <TouchableOpacity style={{ marginTop: 8, padding: 8, backgroundColor: COLORS.glowBlue, borderRadius: 6 }} onPress={loadDashboard}>
            <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center', fontSize: 12 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Header */}
      <View style={{ marginBottom: SPACING.large }}>
        <Text style={{ color: '#888', fontSize: 14, marginBottom: SPACING.small }}>Welcome back</Text>
        <Text style={{ fontSize: 32, color: COLORS.glowBlue, fontWeight: '900' }}>
          {username ? username.charAt(0).toUpperCase() + username.slice(1) : 'USER'}
        </Text>
      </View>

      {/* Consumption Circles - Vertical Stack Layout */}
      <View style={{ marginBottom: SPACING.large }}>
        <Text style={{ fontSize: 16, color: COLORS.glowBlue, fontWeight: '700', marginBottom: SPACING.large, textAlign: 'center' }}>
          CONSUMPTION SUMMARY
        </Text>
        
        {/* Current Consumption */}
        <View style={{ marginBottom: SPACING.base }}>
          <View style={[styles.card, { borderColor: '#1dd1a1', borderWidth: 2, padding: SPACING.base, alignItems: 'center' }]}>
            <Text style={{ fontSize: 11, color: '#1dd1a1', fontWeight: '600', marginBottom: SPACING.small }}>CURRENT CONSUMPTION (m³)</Text>
            
            <View style={{ width: 130, height: 130, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
              <View style={{
                position: 'absolute',
                width: 110,
                height: 110,
                borderRadius: 55,
                borderWidth: 4,
                borderColor: 'rgba(29, 209, 161, 0.2)',
                backgroundColor: 'rgba(15, 36, 56, 0.6)',
              }} />
              
              <Animated.View style={{
                width: 110,
                height: 110,
                borderRadius: 55,
                borderWidth: 4,
                borderColor: '#1dd1a1',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgba(15, 36, 56, 0.6)',
                shadowColor: '#1dd1a1',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }),
                shadowRadius: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [5, 15] }),
                elevation: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [3, 10] }),
              }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: COLORS.text }}>
                    {currentUsage.toFixed(6)}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#1dd1a1', marginTop: 2 }}>m³</Text>
                </View>
              </Animated.View>
            </View>
          </View>
        </View>

        {/* Previous Consumption */}
        <View style={{ marginBottom: SPACING.base }}>
          <View style={[styles.card, { borderColor: '#888888', borderWidth: 2, padding: SPACING.base, alignItems: 'center' }]}>
            <Text style={{ fontSize: 11, color: '#888888', fontWeight: '600', marginBottom: SPACING.small }}>PREVIOUS CONSUMPTION (m³)</Text>
            
            <View style={{ width: 130, height: 130, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
              <View style={{
                position: 'absolute',
                width: 110,
                height: 110,
                borderRadius: 55,
                borderWidth: 4,
                borderColor: 'rgba(136, 136, 136, 0.2)',
                backgroundColor: 'rgba(15, 36, 56, 0.6)',
              }} />
              
              <Animated.View style={{
                width: 110,
                height: 110,
                borderRadius: 55,
                borderWidth: 4,
                borderColor: '#888888',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgba(15, 36, 56, 0.6)',
                shadowColor: '#888888',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
                shadowRadius: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 12] }),
                elevation: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 8] }),
              }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: COLORS.text }}>
                    {previousUsage.toFixed(6)}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#888888', marginTop: 2 }}>m³</Text>
                </View>
              </Animated.View>
            </View>
          </View>
        </View>

        {/* Total Consumption */}
        <View style={{ marginBottom: SPACING.large }}>
          <View style={[styles.card, { borderColor: COLORS.glowBlue, borderWidth: 2, padding: SPACING.base, alignItems: 'center' }]}>
            <Text style={{ fontSize: 11, color: COLORS.glowBlue, fontWeight: '600', marginBottom: SPACING.small }}>TOTAL CONSUMPTION (m³)</Text>
            
            <View style={{ width: 130, height: 130, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
              <View style={{
                position: 'absolute',
                width: 110,
                height: 110,
                borderRadius: 55,
                borderWidth: 4,
                borderColor: 'rgba(0, 180, 255, 0.2)',
                backgroundColor: 'rgba(15, 36, 56, 0.6)',
              }} />
              
              <Animated.View style={{
                width: 110,
                height: 110,
                borderRadius: 55,
                borderWidth: 4,
                borderColor: totalConsumption > 100 ? COLORS.danger : COLORS.glowBlue,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgba(15, 36, 56, 0.6)',
                shadowColor: totalConsumption > 100 ? COLORS.danger : COLORS.glowBlue,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
                shadowRadius: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 12] }),
                elevation: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 8] }),
              }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: COLORS.text }}>
                    {totalConsumption.toFixed(6)}
                  </Text>
                  <Text style={{ fontSize: 10, color: COLORS.glowBlue, marginTop: 2 }}>m³</Text>
                </View>
              </Animated.View>
            </View>
          </View>
        </View>
      </View>

      {/* Estimated Bill */}
      <View style={[styles.card, { marginBottom: SPACING.large, alignItems: 'center' }]}>
        <Text style={{ fontSize: 14, color: COLORS.glowBlue, fontWeight: '600', marginBottom: SPACING.base }}>MONTHLY BILL</Text>
        {totalUsage === 0 ? (
          <>
            <Text style={{ fontSize: 28, fontWeight: '900', color: '#999' }}>Not yet active</Text>
            <Text style={{ fontSize: 12, color: '#666', marginTop: SPACING.small }}>Waiting for first reading...</Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 36, fontWeight: '900', color: COLORS.glowBlue }}>₱{computeResidentialBill(totalUsage).toFixed(2)}</Text>
            <Text style={{ fontSize: 12, color: COLORS.text, marginTop: SPACING.small }}>Due: {dueDate}</Text>
          </>
        )}
      </View>

      {/* Devices */}
      <View style={{ marginBottom: SPACING.large }}>
        <Text style={{ fontSize: 16, color: COLORS.glowBlue, fontWeight: '700', marginBottom: SPACING.base }}>
          Devices ({devices.length})
        </Text>
        {devices.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center', padding: SPACING.large }]}>
            <Text style={{ color: COLORS.text, fontSize: 14 }}>No devices registered</Text>
          </View>
        ) : (
          devices.map((device, idx) => (
            <View key={idx} style={[styles.card, { marginBottom: SPACING.small }]}>
              <Text style={{ color: COLORS.glowBlue, fontWeight: '700', marginBottom: 4 }}>
                🎛️ {device.deviceId || `Device ${idx + 1}`}
              </Text>
              <Text style={{ color: COLORS.text, fontSize: 12 }}>
                {device.lastSeen ? '🟢 Active' : '🔴 Offline'}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Action Buttons */}
      <View style={{ gap: SPACING.base }}>
        <TouchableOpacity style={[styles.primaryButton]} onPress={onOpenBilling}>
          <Text style={styles.primaryButtonText}>📋 Billing History</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.primaryButton, totalUsage === 0 && { opacity: 0.5 }]} 
          disabled={totalUsage === 0}
          onPress={() => {
            const currentDate = new Date();
            const billingMonth = currentDate.getMonth() + 1;
            const billingYear = currentDate.getFullYear();
            const billAmount = computeResidentialBill(totalUsage);
            if (billAmount > 0) {
              onPay(username || 'Account', billAmount, billingMonth, billingYear);
            } else {
              Alert.alert('No Bill', 'No consumption recorded yet. Please wait for the first reading from your water meter.');
            }
          }}>
          <Text style={styles.primaryButtonText}>💳 Pay Bill</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.secondaryButton, { marginTop: SPACING.base }]} 
          onPress={() => {
            Alert.alert(
              'Confirm Logout',
              'Are you sure you want to log out?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log out', style: 'destructive', onPress: () => onLogout && onLogout() }
              ],
              { cancelable: true }
            );
          }}
        >
          <Text style={styles.secondaryButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
