import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, TYPO, SPACING } from './variables';

export default function DashboardScreen({ token, username, onLogout, onOpenUsage, onPay, onOpenDevices }) {
  const [summary, setSummary] = useState({ summary: {} });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load dashboard data
  useEffect(() => {
    console.log('DashboardScreen: Mounting with token=', token);
    loadDashboard();
  }, [token]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading dashboard data...');
      const data = await Api.getDashboard(token);
      console.log('Dashboard data loaded:', data);
      setSummary(data || { summary: {} });
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

  const devices = Object.values(summary.summary || {});
  const totalUsage = devices.reduce((sum, d) => sum + (d.monthlyUsage || 0), 0);

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

      {/* Total Usage Card */}
      <View style={[styles.card, { marginBottom: SPACING.large, alignItems: 'center' }]}>
        <Text style={{ fontSize: 14, color: COLORS.glowBlue, fontWeight: '600', marginBottom: SPACING.base }}>TOTAL USAGE</Text>
        <Text style={{ fontSize: 48, fontWeight: '900', color: COLORS.text, marginBottom: SPACING.small }}>
          {totalUsage.toFixed(1)}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.glowBlue }}>m³</Text>
      </View>

      {/* Estimated Bill */}
      <View style={[styles.card, { marginBottom: SPACING.large, alignItems: 'center' }]}>
        <Text style={{ fontSize: 14, color: COLORS.glowBlue, fontWeight: '600', marginBottom: SPACING.base }}>MONTHLY BILL</Text>
        <Text style={{ fontSize: 36, fontWeight: '900', color: COLORS.glowBlue }}>₱{(totalUsage * 15).toFixed(2)}</Text>
        <Text style={{ fontSize: 12, color: COLORS.text, marginTop: SPACING.small }}>Est. by month end</Text>
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
        <TouchableOpacity style={[styles.primaryButton]} onPress={onOpenUsage}>
          <Text style={styles.primaryButtonText}>📈 Usage History</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.primaryButton]} onPress={() => onPay(null, totalUsage * 15)}>
          <Text style={styles.primaryButtonText}>💳 Pay Bill</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.primaryButton]} onPress={onOpenDevices}>
          <Text style={styles.primaryButtonText}>🎛️ Manage Devices</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.secondaryButton, { marginTop: SPACING.base }]} 
          onPress={onLogout}
        >
          <Text style={styles.secondaryButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
