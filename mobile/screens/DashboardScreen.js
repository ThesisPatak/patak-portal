import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, TYPO, SPACING, RADIUS, ELEVATION } from './variables';

export default function DashboardScreen({ token, onOpenUsage, onLogout, onPay, onOpenDevices, username }) {
  const [summary, setSummary] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const loadDashboard = async () => {
    try {
      const data = await Api.getDashboard(token);
      setSummary(data);
    } catch (err) {
      console.warn('getDashboard error', err);
      setSummary(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };
  
  useEffect(() => {
    let mounted = true;
    async function load() {
      await loadDashboard();
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
  const totalUsage = devices.reduce((sum, d) => sum + d.monthlyUsage, 0);
  const usagePercentage = Math.min(100, (totalUsage / 100) * 100); // Assume 100m³ = 100%

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: '#0f1419' }}
      scrollIndicatorInsets={{ right: 1 }}
      contentContainerStyle={{ paddingBottom: SPACING.large * 2, paddingHorizontal: 0 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Header Section */}
      <View style={{ paddingHorizontal: SPACING.base, paddingTop: SPACING.large, marginBottom: SPACING.large }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: TYPO.captionSize, color: '#8b92a9', marginBottom: SPACING.small }}>Welcome back</Text>
            <Text style={{ fontSize: TYPO.headingSize, color: '#ffffff', fontWeight: '900' }}>
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
            <Text style={{ fontSize: 24 }}>⚡</Text>
          </View>
        </View>
      </View>

      {/* Total Usage Circular Progress Card */}
      <View style={{ paddingHorizontal: SPACING.base, marginBottom: SPACING.large }}>
        <View style={{
          backgroundColor: '#1a2332',
          borderRadius: 20,
          padding: SPACING.large,
          alignItems: 'center',
          borderWidth: 2,
          borderColor: '#3498db',
          shadowColor: '#3498db',
          shadowOpacity: 0.5,
          shadowRadius: 15,
          elevation: 8,
        }}>
          <Text style={{ fontSize: TYPO.captionSize, color: '#64B5F6', marginBottom: SPACING.base, fontWeight: '600', letterSpacing: 1 }}>TOTAL USAGE</Text>
          
          {/* Circular Progress */}
          <View style={{ width: 180, height: 180, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.large, position: 'relative' }}>
            <View style={{
              width: 160,
              height: 160,
              borderRadius: 80,
              borderWidth: 8,
              borderColor: totalUsage > 100 ? '#FF6B6B' : '#3498db',
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: totalUsage > 100 ? '#FF6B6B' : '#3498db',
              shadowOpacity: 0.6,
              shadowRadius: 10,
              elevation: 5,
              backgroundColor: 'rgba(15, 20, 25, 0.5)',
            }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 40, fontWeight: '900', color: '#ffffff' }}>
                  {totalUsage.toFixed(1)}
                </Text>
                <Text style={{ fontSize: TYPO.captionSize, color: '#64B5F6', marginTop: SPACING.small }}>m³</Text>
              </View>
            </View>
          </View>

          <Text style={{ fontSize: 28, fontWeight: '900', color: '#ffffff', marginBottom: SPACING.small }}>
            {totalUsage.toFixed(1)} m³
          </Text>
        </View>
      </View>

      {/* Monthly Bill Card */}
      <View style={{ paddingHorizontal: SPACING.base, marginBottom: SPACING.large }}>
        <View style={{
          backgroundColor: '#1a2332',
          borderRadius: 20,
          padding: SPACING.large,
          borderWidth: 2,
          borderColor: '#42A5F5',
          shadowColor: '#42A5F5',
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.base }}>
            <View>
              <Text style={{ fontSize: TYPO.captionSize, color: '#64B5F6', marginBottom: SPACING.small, fontWeight: '600', letterSpacing: 1 }}>MONTHLY BILL</Text>
              <Text style={{ fontSize: 40, fontWeight: '900', color: '#ffffff' }}>₱{summary.totalBill}</Text>
              <Text style={{ fontSize: TYPO.captionSize, color: '#64B5F6', marginTop: SPACING.small }}>Est. ₱{summary.estimatedTotalBill} by month end</Text>
            </View>
            <View style={{
              backgroundColor: '#3498db',
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              shadowColor: '#3498db',
              shadowOpacity: 0.6,
              shadowRadius: 8,
              elevation: 5,
            }}>
              <Text style={{ fontSize: 20 }}>�</Text>
            </View>
          </View>
          <TouchableOpacity style={{
            backgroundColor: '#3498db',
            paddingVertical: SPACING.base,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: SPACING.base,
            shadowColor: '#3498db',
            shadowOpacity: 0.6,
            shadowRadius: 10,
            elevation: 5,
          }} onPress={() => onPay && onPay()}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: TYPO.bodySize, letterSpacing: 0.5 }}>💰 PAY NOW</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Devices Section */}
      {hasDevices ? (
        <View style={{ paddingHorizontal: SPACING.base }}>
          <View style={{ marginBottom: SPACING.base }}>
            <Text style={{ fontSize: TYPO.bodySize, color: '#ffffff', fontWeight: '700', letterSpacing: 0.5 }}>YOUR DEVICES</Text>
            <Text style={{ fontSize: TYPO.captionSize, color: '#64B5F6', marginTop: SPACING.small }}>
              {devices.length} device{devices.length !== 1 ? 's' : ''} tracked
            </Text>
          </View>

          {devices.map((device, idx) => (
            <View key={idx} style={{
              backgroundColor: '#1a2332',
              borderRadius: 20,
              padding: SPACING.large,
              marginBottom: SPACING.base,
              borderLeftWidth: 4,
              borderLeftColor: device.isOnline ? '#42A5F5' : '#FFA726',
              borderWidth: 1,
              borderColor: device.isOnline ? 'rgba(66, 165, 245, 0.3)' : 'rgba(255, 167, 38, 0.2)',
              shadowColor: device.isOnline ? '#42A5F5' : '#FFA726',
              shadowOpacity: device.isOnline ? 0.3 : 0.2,
              shadowRadius: 10,
              elevation: 5,
            }}>
              {/* Device Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.base }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.small }}>
                    <Text style={{ fontSize: TYPO.bodySize, fontWeight: '800', color: '#ffffff' }}>
                      {device.deviceId.toUpperCase()}
                    </Text>
                    <View style={{
                      marginLeft: SPACING.small,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: RADIUS.md,
                      backgroundColor: device.isOnline ? 'rgba(66, 165, 245, 0.15)' : 'rgba(255, 167, 38, 0.15)'
                    }}>
                      <Text style={{ fontSize: TYPO.captionSize, fontWeight: '700', color: device.isOnline ? '#42A5F5' : '#FFA726' }}>
                        {device.isOnline ? '● Online' : '● Offline'}
                      </Text>
                    </View>
                  </View>
                  {device.lastReading && (
                    <Text style={{ fontSize: TYPO.captionSize, color: '#64B5F6' }}>
                      Updated {new Date(device.lastReading.timestamp).toLocaleString()}
                    </Text>
                  )}
                </View>
                {device.hasAlert && (
                  <View style={{ backgroundColor: 'rgba(255, 107, 107, 0.15)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.md }}>
                    <Text style={{ fontSize: TYPO.captionSize, color: '#FF6B6B', fontWeight: '700' }}>⚠️</Text>
                  </View>
                )}
              </View>

              {/* Usage Info */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.large }}>
                <View>
                  <Text style={{ fontSize: TYPO.captionSize, color: '#64B5F6', marginBottom: SPACING.small }}>Usage</Text>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: '#ffffff' }}>{device.cubicMeters.toFixed(2)}</Text>
                  <Text style={{ fontSize: TYPO.captionSize, color: '#64B5F6' }}>m³</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: TYPO.captionSize, color: '#64B5F6', marginBottom: SPACING.small }}>This Month</Text>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: '#ffffff' }}>₱{device.monthlyBill.toFixed(0)}</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: RADIUS.pill, overflow: 'hidden', marginBottom: SPACING.base }}>
                <View style={{
                  height: '100%',
                  width: Math.min(100, (device.monthlyUsage / 50) * 100) + '%',
                  backgroundColor: device.monthlyUsage > 100 ? '#FF6B6B' : '#42A5F5',
                  borderRadius: RADIUS.pill
                }} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: TYPO.captionSize, color: '#64B5F6' }}>0 m³</Text>
                <Text style={{ fontSize: TYPO.captionSize, color: device.monthlyUsage > 100 ? '#FF6B6B' : '#42A5F5', fontWeight: '600' }}>
                  {device.monthlyUsage > 100 ? '⚠️ High Usage' : '✓ Normal'}
                </Text>
              </View>

              {/* Alert Message */}
              {device.hasAlert && (
                <View style={{
                  backgroundColor: 'rgba(255, 107, 107, 0.1)',
                  borderLeftWidth: 3,
                  borderLeftColor: '#FF6B6B',
                  paddingHorizontal: SPACING.base,
                  paddingVertical: SPACING.small,
                  borderRadius: RADIUS.md,
                  marginTop: SPACING.base
                }}>
                  <Text style={{ color: '#FF6B6B', fontWeight: '600', fontSize: TYPO.captionSize }}>
                    {device.alertMessage}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ paddingHorizontal: SPACING.base }}>
          <View style={{
            backgroundColor: '#1a2332',
            borderRadius: RADIUS.lg,
            padding: SPACING.large,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.05)',
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: 56, marginBottom: SPACING.base }}>📡</Text>
            <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: '#ffffff', textAlign: 'center', marginBottom: SPACING.small }}>
              No Devices Connected
            </Text>
            <Text style={{ fontSize: TYPO.captionSize, color: '#64B5F6', textAlign: 'center', marginBottom: SPACING.large }}>
              Start tracking water consumption by linking your first meter
            </Text>
            <TouchableOpacity style={{
              backgroundColor: '#3498db',
              paddingHorizontal: SPACING.large,
              paddingVertical: SPACING.base,
              borderRadius: RADIUS.md,
            }} onPress={() => onOpenDevices && onOpenDevices()}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: TYPO.bodySize }}>+ Link Device</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Quick Actions Footer */}
      <View style={{ paddingHorizontal: SPACING.base, marginTop: SPACING.large }}>
        <Text style={{ fontSize: TYPO.captionSize, color: '#64B5F6', marginBottom: SPACING.base, fontWeight: '600' }}>
          Quick Actions
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <TouchableOpacity style={{
            flex: 1,
            backgroundColor: '#1a2332',
            borderRadius: 16,
            paddingVertical: SPACING.large,
            marginRight: SPACING.small,
            alignItems: 'center',
            borderTopWidth: 3,
            borderTopColor: '#3498db',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.05)',
          }} onPress={() => onOpenUsage && onOpenUsage()}>
            <Text style={{ fontSize: 28, marginBottom: SPACING.small }}>�</Text>
            <Text style={{ fontSize: TYPO.captionSize, color: '#ffffff', textAlign: 'center', fontWeight: '600' }}>Usage</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{
            flex: 1,
            backgroundColor: '#1a2332',
            borderRadius: 16,
            paddingVertical: SPACING.large,
            marginRight: SPACING.small,
            alignItems: 'center',
            borderTopWidth: 3,
            borderTopColor: '#5C6BC0',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.05)',
          }} onPress={() => onOpenDevices && onOpenDevices()}>
            <Text style={{ fontSize: 28, marginBottom: SPACING.small }}>🔧</Text>
            <Text style={{ fontSize: TYPO.captionSize, color: '#ffffff', textAlign: 'center', fontWeight: '600' }}>Devices</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{
            flex: 1,
            backgroundColor: '#1a2332',
            borderRadius: 16,
            paddingVertical: SPACING.large,
            alignItems: 'center',
            borderTopWidth: 3,
            borderTopColor: '#FF6B6B',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.05)',
          }} onPress={() => {
            Alert.alert(
              'Confirm Logout',
              'Are you sure you want to log out?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log out', style: 'destructive', onPress: () => onLogout && onLogout() }
              ],
              { cancelable: true }
            );
          }}>
            <Text style={{ fontSize: 28, marginBottom: SPACING.small }}>🔐</Text>
            <Text style={{ fontSize: TYPO.captionSize, color: '#ffffff', textAlign: 'center', fontWeight: '600' }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
