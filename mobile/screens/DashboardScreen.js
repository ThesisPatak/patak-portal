import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, Alert, Animated } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, TYPO, SPACING, RADIUS, ELEVATION } from './variables';

export default function DashboardScreen({ token, onOpenUsage, onLogout, onPay, onOpenDevices, username }) {
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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={{ paddingVertical: SPACING.base }}>
      {/* Header with User Greeting */}
      <View style={{ paddingHorizontal: SPACING.base, marginBottom: SPACING.large, marginTop: SPACING.small }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.large }}>
          <View>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginBottom: SPACING.small }}>Welcome back</Text>
            <Text style={{ fontSize: TYPO.headingSize, color: COLORS.text, fontWeight: '900' }}>
              {username ? username.charAt(0).toUpperCase() + username.slice(1) : 'User'}
            </Text>
          </View>
          <View style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: COLORS.primary,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: 24 }}>💧</Text>
          </View>
        </View>

        {/* Main Stats Cards */}
        <View style={{
          backgroundColor: `rgba(${COLORS.primary.match(/\d+/g).join(',')}, 0.1)`,
          borderRadius: RADIUS.lg,
          padding: SPACING.large,
          marginBottom: SPACING.large,
          borderLeftWidth: 6,
          borderLeftColor: COLORS.primary,
          shadowColor: COLORS.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: ELEVATION.high
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.base }}>
            <View>
              <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginBottom: SPACING.small }}>Monthly Bill</Text>
              <Text style={{ fontSize: 40, fontWeight: '900', color: COLORS.primary }}>₱{summary.totalBill}</Text>
            </View>
            <View style={{
              backgroundColor: COLORS.primary,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: RADIUS.md,
            }}>
              <Text style={{ fontSize: 20 }}>📈</Text>
            </View>
          </View>
          <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginBottom: SPACING.base }}>Est. ₱{summary.estimatedTotalBill} by month end</Text>
          <TouchableOpacity style={{
            backgroundColor: COLORS.primary,
            paddingVertical: SPACING.small,
            paddingHorizontal: SPACING.base,
            borderRadius: RADIUS.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: SPACING.base
          }} onPress={() => onPay && onPay()}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: TYPO.bodySize }}>💳 Pay Now</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.large }}>
          <View style={{
            flex: 1,
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.lg,
            padding: SPACING.base,
            marginRight: SPACING.small,
            borderTopWidth: 3,
            borderTopColor: COLORS.success
          }}>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginBottom: SPACING.small }}>Online</Text>
            <Text style={{ fontSize: 28, fontWeight: '900', color: COLORS.success }}>
              {devices.filter(d => d.isOnline).length}/{devices.length}
            </Text>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginTop: SPACING.small }}>devices</Text>
          </View>
          <View style={{
            flex: 1,
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.lg,
            padding: SPACING.base,
            borderTopWidth: 3,
            borderTopColor: COLORS.primary
          }}>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginBottom: SPACING.small }}>Total Usage</Text>
            <Text style={{ fontSize: 28, fontWeight: '900', color: COLORS.primary }}>
              {devices.reduce((sum, d) => sum + d.monthlyUsage, 0).toFixed(1)}
            </Text>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginTop: SPACING.small }}>m³</Text>
          </View>
        </View>
      </View>

      {/* Devices Section */}
      <View style={{ paddingHorizontal: SPACING.base }}>
        <View style={{ marginBottom: SPACING.base }}>
          <Text style={{ fontSize: TYPO.bodySize, color: COLORS.text, fontWeight: '700' }}>
            {hasDevices ? '📊 Your Devices' : 'Getting Started'}
          </Text>
          <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginTop: SPACING.small }}>
            {hasDevices ? `${devices.length} device${devices.length !== 1 ? 's' : ''} tracked` : 'Link your first meter'}
          </Text>
        </View>
        
        {!hasDevices ? (
          <View style={{
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.lg,
            padding: SPACING.large,
            marginBottom: SPACING.large,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: COLORS.primary,
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: 56, marginBottom: SPACING.base }}>🌊</Text>
            <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: SPACING.small }}>
              No Devices Connected
            </Text>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, textAlign: 'center', marginBottom: SPACING.large }}>
              Start tracking water consumption by linking your first meter
            </Text>
            <TouchableOpacity style={{
              backgroundColor: COLORS.primary,
              paddingHorizontal: SPACING.large,
              paddingVertical: SPACING.base,
              borderRadius: RADIUS.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center'
            }} onPress={() => onOpenDevices && onOpenDevices()}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: TYPO.bodySize }}>+ Link Device</Text>
            </TouchableOpacity>
          </View>
        ) : (
          devices.map((device, idx) => (
          <View key={idx} style={{
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.lg,
            padding: SPACING.large,
            marginBottom: SPACING.base,
            borderTopWidth: 4,
            borderTopColor: device.isOnline ? COLORS.success : COLORS.warning,
            shadowColor: COLORS.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 2
          }}>
            {/* Device Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.base }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.small }}>
                  <Text style={{ fontSize: TYPO.bodySize, fontWeight: '800', color: COLORS.text }}>
                    {device.deviceId.toUpperCase()}
                  </Text>
                  <View style={{
                    marginLeft: SPACING.small,
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    borderRadius: RADIUS.md,
                    backgroundColor: device.isOnline ? 'rgba(46, 213, 115, 0.1)' : 'rgba(243, 156, 18, 0.1)'
                  }}>
                    <Text style={{ fontSize: TYPO.captionSize, fontWeight: '700', color: device.isOnline ? COLORS.success : COLORS.warning }}>
                      {device.isOnline ? '● Online' : '● Offline'}
                    </Text>
                  </View>
                </View>
                {device.lastReading && (
                  <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted }}>
                    Updated {new Date(device.lastReading.timestamp).toLocaleString()}
                  </Text>
                )}
              </View>
              {device.hasAlert && (
                <View style={{ backgroundColor: 'rgba(231, 76, 60, 0.15)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.md }}>
                  <Text style={{ fontSize: TYPO.captionSize, color: COLORS.danger, fontWeight: '700' }}>⚠️</Text>
                </View>
              )}
            </View>

            {/* Usage Display */}
            <View style={{ marginBottom: SPACING.large, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACING.base }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: SPACING.small }}>
                <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted }}>Monthly Usage</Text>
                <Text style={{ fontSize: 32, fontWeight: '900', color: COLORS.primary }}>
                  {device.cubicMeters.toFixed(2)}
                </Text>
              </View>
              <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginBottom: SPACING.base }}>m³</Text>
              <View style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: RADIUS.pill, overflow: 'hidden' }}>
                <View style={{
                  height: '100%',
                  width: Math.min(100, (device.monthlyUsage / 50) * 100) + '%',
                  backgroundColor: device.monthlyUsage > 100 ? COLORS.danger : COLORS.primary,
                  borderRadius: RADIUS.pill
                }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.small }}>
                <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted }}>0 m³</Text>
                <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted }}>
                  {device.monthlyUsage > 100 ? '⚠️ High' : '✓ Normal'}
                </Text>
              </View>
            </View>

            {/* Billing Info */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.small }}>
              <View>
                <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginBottom: SPACING.small }}>This Month</Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text }}>₱{device.monthlyBill.toFixed(0)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginBottom: SPACING.small }}>Est. Month End</Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.primary }}>₱{device.estimatedMonthlyBill}</Text>
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
                borderRadius: RADIUS.md,
                marginTop: SPACING.base
              }}>
                <Text style={{ color: COLORS.danger, fontWeight: '600', fontSize: TYPO.captionSize }}>
                  {device.alertMessage}
                </Text>
              </View>
            )}
          </View>
          ))
        )}
      </View>

      {/* Quick Actions Footer */}
      <View style={{ paddingHorizontal: SPACING.base, marginTop: SPACING.large, marginBottom: SPACING.large * 2 }}>
        <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginBottom: SPACING.base, fontWeight: '600' }}>
          Quick Actions
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <TouchableOpacity style={{
            flex: 1,
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.lg,
            paddingVertical: SPACING.large,
            marginRight: SPACING.small,
            alignItems: 'center',
            borderTopWidth: 3,
            borderTopColor: '#3498db'
          }} onPress={() => onOpenUsage && onOpenUsage()}>
            <Text style={{ fontSize: 28, marginBottom: SPACING.small }}>📊</Text>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.text, textAlign: 'center', fontWeight: '600' }}>Usage</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{
            flex: 1,
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.lg,
            paddingVertical: SPACING.large,
            marginRight: SPACING.small,
            alignItems: 'center',
            borderTopWidth: 3,
            borderTopColor: '#9b59b6'
          }} onPress={() => onOpenDevices && onOpenDevices()}>
            <Text style={{ fontSize: 28, marginBottom: SPACING.small }}>⚙️</Text>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.text, textAlign: 'center', fontWeight: '600' }}>Devices</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{
            flex: 1,
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.lg,
            paddingVertical: SPACING.large,
            alignItems: 'center',
            borderTopWidth: 3,
            borderTopColor: '#e74c3c'
          }} onPress={() => onLogout && onLogout()}>
            <Text style={{ fontSize: 28, marginBottom: SPACING.small }}>🚪</Text>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.text, textAlign: 'center', fontWeight: '600' }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
