import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, Alert, Animated } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, TYPO, SPACING, RADIUS, ELEVATION } from './variables';

export default function DashboardScreen({ token, onOpenUsage, onLogout, onPay, onOpenDevices }) {
  const [summary, setSummary] = useState(null);
  
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await Api.getDashboard(token);
        if (mounted) setSummary(data);
      } catch (err) {
        console.warn('getDashboard error', err);
        if (mounted) setSummary(null);
      }
    }
    load();
    return () => { mounted = false; };
  }, [token]);

  if (!summary) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[styles.subtitle, { marginTop: SPACING.base }]}>Loading dashboard…</Text>
      </View>
    );
  }

  const devices = Object.values(summary.summary || {});
  const hasDevices = devices.length > 0;

  if (!hasDevices) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={{ paddingVertical: SPACING.large, paddingHorizontal: SPACING.base }}>
        <View style={{ alignItems: 'center', marginTop: SPACING.large * 2 }}>
          <Text style={{ fontSize: 48, marginBottom: SPACING.large }}>📱</Text>
          <Text style={{ fontSize: TYPO.headingSize, color: COLORS.text, marginBottom: SPACING.base, textAlign: 'center' }}>No Devices</Text>
          <Text style={{ fontSize: TYPO.bodySize, color: COLORS.muted, textAlign: 'center', marginBottom: SPACING.large }}>Link your first water meter to get started</Text>
          <TouchableOpacity style={{
            backgroundColor: COLORS.primary,
            paddingHorizontal: SPACING.large,
            paddingVertical: SPACING.base,
            borderRadius: RADIUS.md
          }} onPress={() => onOpenDevices && onOpenDevices()}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: TYPO.bodySize }}>+ Add Device</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={{ paddingVertical: SPACING.base }}>
      {/* Summary Cards */}
      <View style={{ paddingHorizontal: SPACING.base, marginBottom: SPACING.large }}>
        <Text style={{ fontSize: TYPO.headingSize, color: COLORS.text, marginBottom: SPACING.base, fontWeight: '900' }}>Dashboard</Text>
        
        {/* Total Bill Card */}
        <View style={{
          backgroundColor: COLORS.primary,
          borderRadius: RADIUS.lg,
          padding: SPACING.large,
          marginBottom: SPACING.base,
          shadowColor: COLORS.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: ELEVATION.high
        }}>
          <Text style={{ fontSize: TYPO.captionSize, color: 'rgba(255,255,255,0.8)', marginBottom: SPACING.small }}>Total Monthly Bill</Text>
          <Text style={{ fontSize: 32, fontWeight: '900', color: '#fff' }}>₱{summary.totalBill}</Text>
          <Text style={{ fontSize: TYPO.captionSize, color: 'rgba(255,255,255,0.7)', marginTop: SPACING.small }}>Est. ₱{summary.estimatedTotalBill} (end of month)</Text>
          <TouchableOpacity style={{
            marginTop: SPACING.large,
            backgroundColor: 'rgba(255,255,255,0.2)',
            paddingVertical: SPACING.small,
            paddingHorizontal: SPACING.base,
            borderRadius: RADIUS.md,
            alignSelf: 'flex-start'
          }} onPress={() => onPay && onPay()}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: TYPO.bodySize }}>💳 Pay Now</Text>
          </TouchableOpacity>
        </View>

        {/* Device Stats */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.large }}>
          <View style={{
            flex: 1,
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.md,
            padding: SPACING.base,
            marginRight: SPACING.small,
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted }}>Devices Online</Text>
            <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.success, marginTop: SPACING.small }}>
              {devices.filter(d => d.isOnline).length}/{devices.length}
            </Text>
          </View>
          <View style={{
            flex: 1,
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.md,
            padding: SPACING.base,
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted }}>Total Usage</Text>
            <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.primary, marginTop: SPACING.small }}>
              {devices.reduce((sum, d) => sum + d.monthlyUsage, 0).toFixed(1)}m³
            </Text>
          </View>
        </View>
      </View>

      {/* Device Cards */}
      <View style={{ paddingHorizontal: SPACING.base }}>
        <Text style={{ fontSize: TYPO.bodySize, color: COLORS.muted, marginBottom: SPACING.base, fontWeight: '600' }}>Your Devices</Text>
        {devices.map((device, idx) => (
          <View key={idx} style={{
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.lg,
            padding: SPACING.large,
            marginBottom: SPACING.base,
            borderLeftWidth: 4,
            borderLeftColor: device.isOnline ? COLORS.success : COLORS.warning,
            shadowColor: COLORS.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 2
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.base }}>
              <View>
                <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: COLORS.text }}>
                  {device.deviceId.toUpperCase()}
                </Text>
                <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginTop: SPACING.small }}>
                  {device.isOnline ? '🟢 Online' : '🔴 Offline'}
                </Text>
              </View>
              {device.hasAlert && (
                <View style={{ backgroundColor: COLORS.warning, paddingVertical: 4, paddingHorizontal: 8, borderRadius: RADIUS.md }}>
                  <Text style={{ fontSize: TYPO.captionSize, color: '#fff', fontWeight: '600' }}>⚠️ Alert</Text>
                </View>
              )}
            </View>

            {/* Last Reading */}
            {device.lastReading && (
              <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginBottom: SPACING.base }}>
                Last reading: {new Date(device.lastReading.timestamp).toLocaleString()}
              </Text>
            )}

            {/* Usage */}
            <View style={{ marginBottom: SPACING.large }}>
              <Text style={{ fontSize: 28, fontWeight: '900', color: COLORS.primary }}>
                {device.cubicMeters.toFixed(2)}m³
              </Text>
              <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted }}>Current Month Usage</Text>
              <View style={{ marginTop: SPACING.small, height: 8, backgroundColor: COLORS.bg, borderRadius: RADIUS.pill, overflow: 'hidden' }}>
                <View style={{
                  height: '100%',
                  width: Math.min(100, (device.monthlyUsage / 50) * 100) + '%',
                  backgroundColor: device.monthlyUsage > 100 ? COLORS.danger : COLORS.primary
                }} />
              </View>
            </View>

            {/* Billing */}
            <View style={{
              backgroundColor: COLORS.bg,
              borderRadius: RADIUS.md,
              padding: SPACING.base,
              marginBottom: SPACING.base
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.small }}>
                <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted }}>This Month Bill</Text>
                <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: COLORS.text }}>₱{device.monthlyBill.toFixed(0)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted }}>Estimated (end of month)</Text>
                <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: COLORS.text }}>₱{device.estimatedMonthlyBill}</Text>
              </View>
            </View>

            {/* Alert Message */}
            {device.hasAlert && (
              <View style={{
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                borderLeftWidth: 3,
                borderLeftColor: COLORS.danger,
                paddingHorizontal: SPACING.base,
                paddingVertical: SPACING.small,
                borderRadius: RADIUS.md
              }}>
                <Text style={{ color: COLORS.danger, fontWeight: '600', fontSize: TYPO.captionSize }}>
                  {device.alertMessage}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={{ paddingHorizontal: SPACING.base, marginTop: SPACING.large, marginBottom: SPACING.large * 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <TouchableOpacity style={{
            flex: 1,
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.md,
            paddingVertical: SPACING.base,
            marginRight: SPACING.small,
            alignItems: 'center'
          }} onPress={() => onOpenUsage && onOpenUsage()}>
            <Text style={{ fontSize: 20, marginBottom: SPACING.small }}>📊</Text>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, textAlign: 'center' }}>View Usage</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{
            flex: 1,
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.md,
            paddingVertical: SPACING.base,
            marginRight: SPACING.small,
            alignItems: 'center'
          }} onPress={() => onOpenDevices && onOpenDevices()}>
            <Text style={{ fontSize: 20, marginBottom: SPACING.small }}>⚙️</Text>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, textAlign: 'center' }}>Manage Devices</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{
            flex: 1,
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.md,
            paddingVertical: SPACING.base,
            alignItems: 'center'
          }} onPress={() => onLogout && onLogout()}>
            <Text style={{ fontSize: 20, marginBottom: SPACING.small }}>🚪</Text>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, textAlign: 'center' }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
