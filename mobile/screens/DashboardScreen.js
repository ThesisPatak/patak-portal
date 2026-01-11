import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, RefreshControl, ActivityIndicator, Animated } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, TYPO, SPACING, RADIUS, ELEVATION } from './variables';

export default function DashboardScreen({ token, onOpenUsage, onLogout, onPay, onOpenDevices, username }) {
  const [summary, setSummary] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [prevUsage, setPrevUsage] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const glowAnim = React.useRef(new Animated.Value(0)).current;
  const dropAnim = React.useRef(new Animated.Value(0)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  
  const loadDashboard = async () => {
    try {
      setLoadError(null);
      const data = await Api.getDashboard(token);
      setSummary(data || { summary: {} });
    } catch (err) {
      console.warn('getDashboard error', err);
      setLoadError(err.message || 'Failed to load dashboard');
      // Set empty data so we don't stay stuck loading
      setSummary({ summary: {} });
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

  useEffect(() => {
    const dropAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(dropAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(dropAnim, { toValue: 0, duration: 200, useNativeDriver: true })
      ])
    );
    dropAnimation.start();
    return () => dropAnimation.stop();
  }, [dropAnim]);

  useEffect(() => {
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    );
    rotateAnimation.start();
    return () => rotateAnimation.stop();
  }, [rotateAnim]);

  if (!summary) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, padding: SPACING.large }}>
        <ActivityIndicator size="large" color={COLORS.glowBlue} />
        <Text style={[styles.subtitle, { marginTop: SPACING.base }]}>Loading dashboard…</Text>
        {loadError && (
          <View style={{ marginTop: SPACING.large, padding: SPACING.base, backgroundColor: '#ff0055', borderRadius: 8 }}>
            <Text style={{ color: 'white', fontSize: 12, textAlign: 'center' }}>Error: {loadError}</Text>
            <TouchableOpacity style={{ marginTop: SPACING.small, padding: 8, backgroundColor: COLORS.glowBlue, borderRadius: 6 }} onPress={loadDashboard}>
              <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  const devices = Object.values(summary.summary || summary || {});
  console.log('[DashboardScreen] summary object:', summary);
  console.log('[DashboardScreen] devices:', devices);
  const hasDevices = devices.length > 0;
  const totalUsage = devices.reduce((sum, d) => sum + (d.cubicMeters || d.monthlyUsage || 0), 0);
  console.log('[DashboardScreen] totalUsage:', totalUsage);
  const usagePercentage = Math.min(100, (totalUsage / 100) * 100); // Assume 100m³ = 100%
  
  // Detect if usage has changed (for idle animation)
  const isIdle = prevUsage === totalUsage && prevUsage !== null;
  
  // Track usage changes
  useEffect(() => {
    setPrevUsage(totalUsage);
  }, [totalUsage]);

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: COLORS.background }}
      scrollIndicatorInsets={{ right: 1 }}
      contentContainerStyle={{ paddingBottom: SPACING.large * 2, paddingHorizontal: 0 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.glowBlue} />}
    >
      {/* Header Section */}
      <View style={{ paddingHorizontal: SPACING.base, paddingTop: SPACING.large, marginBottom: SPACING.large }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: TYPO.captionSize, color: '#8b92a9', marginBottom: SPACING.small }}>Welcome back</Text>
            <Text style={{ fontSize: 32, color: COLORS.glowBlue, fontWeight: '900', letterSpacing: 1.5, textShadowColor: COLORS.glowBlue, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }}>
              {username ? username.charAt(0).toUpperCase() + username.slice(1) : 'USER'}
            </Text>
          </View>
          <Animated.View style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: COLORS.glowBlue,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: COLORS.glowBlue,
            shadowOpacity: 0.8,
            shadowRadius: 12,
            elevation: 8,
            transform: [
              {
                translateY: dropAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 15]
                })
              },
              {
                scale: dropAnim.interpolate({
                  inputRange: [0, 0.7, 1],
                  outputRange: [1, 0.95, 0.8]
                })
              }
            ],
            opacity: dropAnim.interpolate({
              inputRange: [0, 0.8, 1],
              outputRange: [1, 1, 0.3]
            })
          }}>
            <Text style={{ fontSize: 28 }}>💧</Text>
          </Animated.View>
        </View>
      </View>

      {/* Total Usage Circular Progress Card */}
      <View style={{ paddingHorizontal: SPACING.base, marginBottom: SPACING.large }}>
        <View style={{
          backgroundColor: COLORS.cardBg,
          borderRadius: 20,
          padding: SPACING.large,
          alignItems: 'center',
          borderWidth: 2,
          borderColor: COLORS.glowBlue,
          shadowColor: COLORS.glowBlue,
          shadowOpacity: 0.5,
          shadowRadius: 15,
          elevation: 8,
        }}>
          <Text style={{ fontSize: TYPO.captionSize, color: COLORS.glowBlue, marginBottom: SPACING.base, fontWeight: '600', letterSpacing: 1 }}>TOTAL USAGE</Text>
          
          {/* Circular Progress */}
          <View style={{ width: 240, height: 240, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.large, position: 'relative' }}>
            {/* Background circle */}
            <View style={{
              position: 'absolute',
              width: 220,
              height: 220,
              borderRadius: 110,
              borderWidth: 10,
              borderColor: 'rgba(0, 180, 255, 0.2)',
              backgroundColor: 'rgba(15, 36, 56, 0.6)',
            }} />
            
            {/* Idle rotating shimmer ring */}
            {isIdle && (
              <Animated.View style={{
                position: 'absolute',
                width: 220,
                height: 220,
                borderRadius: 110,
                borderWidth: 10,
                borderColor: 'transparent',
                borderTopColor: COLORS.glowBlue,
                borderRightColor: 'rgba(255, 255, 255, 0.6)',
                borderBottomColor: 'rgba(0, 180, 255, 0.3)',
                borderLeftColor: 'rgba(0, 180, 255, 0.2)',
                transform: [
                  {
                    rotate: rotateAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg']
                    })
                  }
                ]
              }} />
            )}
            
            {/* Progress arc (active state) */}
            {!isIdle && (
              <Animated.View style={{
                position: 'absolute',
                width: 220,
                height: 220,
                borderRadius: 110,
                borderWidth: 10,
                borderColor: 'transparent',
                borderTopColor: totalUsage > 100 ? COLORS.danger : COLORS.glowBlue,
                borderRightColor: totalUsage > 100 ? COLORS.danger : COLORS.glowBlue,
                transform: [
                  {
                    rotate: `${(totalUsage / 100) * 360}deg`
                  }
                ],
                opacity: 0.8
              }} />
            )}
            
            {/* Main animated circle with glow */}
            <Animated.View style={{
              width: 220,
              height: 220,
              borderRadius: 110,
              borderWidth: 10,
              borderColor: totalUsage > 100 ? COLORS.danger : COLORS.glowBlue,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(15, 36, 56, 0.6)',
              shadowColor: totalUsage > 100 ? COLORS.danger : COLORS.glowBlue,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }),
              shadowRadius: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [5, 20] }),
              elevation: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [3, 12] }),
            }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 48, fontWeight: '900', color: COLORS.text }}>
                  {totalUsage.toFixed(6)}
                </Text>
                <Text style={{ fontSize: TYPO.captionSize, color: COLORS.glowBlue, marginTop: SPACING.small }}>m³</Text>
              </View>
            </Animated.View>
          </View>
        </View>
      </View>

      {/* Monthly Bill Card */}
      <View style={{ paddingHorizontal: SPACING.base, marginBottom: SPACING.large }}>
        <View style={{
          backgroundColor: COLORS.cardBg,
          borderRadius: 20,
          padding: SPACING.large,
          borderWidth: 2,
          borderColor: COLORS.glowBlue,
          shadowColor: COLORS.glowBlue,
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.base }}>
            <View>
              <Text style={{ fontSize: TYPO.captionSize, color: COLORS.glowBlue, marginBottom: SPACING.small, fontWeight: '600', letterSpacing: 1 }}>MONTHLY BILL</Text>
              <Text style={{ fontSize: 40, fontWeight: '900', color: COLORS.text }}>₱{summary.totalBill}</Text>
              <Text style={{ fontSize: TYPO.captionSize, color: COLORS.glowBlue, marginTop: SPACING.small }}>Est. ₱{summary.estimatedTotalBill} by month end</Text>
            </View>

          </View>
          <TouchableOpacity style={{
            backgroundColor: COLORS.glowBlue,
            paddingVertical: SPACING.base,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: SPACING.base,
            shadowColor: COLORS.glowBlue,
            shadowOpacity: 0.6,
            shadowRadius: 10,
            elevation: 5,
          }} onPress={() => onPay && onPay()}>
            <Text style={{ color: COLORS.onPrimary, fontWeight: '700', fontSize: TYPO.bodySize, letterSpacing: 0.5 }}>💳 PAY NOW</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Devices Section */}
      {hasDevices ? (
        <View style={{ paddingHorizontal: SPACING.base }}>
          <View style={{ marginBottom: SPACING.base }}>
            <Text style={{ fontSize: TYPO.bodySize, color: COLORS.text, fontWeight: '700', letterSpacing: 0.5 }}>YOUR DEVICES</Text>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.glowBlue, marginTop: SPACING.small }}>
              {devices.length} device{devices.length !== 1 ? 's' : ''} tracked
            </Text>
          </View>

          {devices.map((device, idx) => (
            <View key={idx} style={{
              backgroundColor: COLORS.cardBg,
              borderRadius: 20,
              padding: SPACING.large,
              marginBottom: SPACING.base,
              borderLeftWidth: 4,
              borderLeftColor: device.isOnline ? COLORS.glowGreen : COLORS.glowYellow,
              borderWidth: 1,
              borderColor: device.isOnline ? COLORS.glowGreen : COLORS.glowYellow,
              shadowColor: device.isOnline ? COLORS.glowGreen : COLORS.glowYellow,
              shadowOpacity: device.isOnline ? 0.3 : 0.2,
              shadowRadius: 10,
              elevation: 5,
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
                      borderRadius: RADIUS.lg,
                      backgroundColor: device.isOnline ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 235, 0, 0.15)',
                      borderWidth: 1,
                      borderColor: device.isOnline ? COLORS.glowGreen : COLORS.glowYellow
                    }}>
                      <Text style={{ fontSize: TYPO.captionSize, fontWeight: '700', color: device.isOnline ? COLORS.glowGreen : COLORS.glowYellow }}>
                        {device.isOnline ? '🟢 Online' : '🟡 Offline'}
                      </Text>
                    </View>
                  </View>
                  {device.lastReading && (
                    <Text style={{ fontSize: TYPO.captionSize, color: COLORS.glowBlue }}>
                      Updated {new Date(device.lastReading.timestamp).toLocaleString()}
                    </Text>
                  )}
                </View>
                {device.hasAlert && (
                  <View style={{ backgroundColor: 'rgba(255, 0, 85, 0.15)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.danger }}>
                    <Text style={{ fontSize: TYPO.captionSize, color: COLORS.danger, fontWeight: '700' }}>⚠️</Text>
                  </View>
                )}
              </View>

              {/* Usage Info */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.large }}>
                <View>
                  <Text style={{ fontSize: TYPO.captionSize, color: COLORS.glowBlue, marginBottom: SPACING.small }}>Usage</Text>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.text }}>{device.cubicMeters.toFixed(6)}</Text>
                  <Text style={{ fontSize: TYPO.captionSize, color: COLORS.glowBlue }}>m³</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: TYPO.captionSize, color: COLORS.glowBlue, marginBottom: SPACING.small }}>This Month</Text>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.text }}>₱{device.monthlyBill.toFixed(0)}</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: RADIUS.pill, overflow: 'hidden', marginBottom: SPACING.base }}>
                <View style={{
                  height: '100%',
                  width: Math.min(100, (device.monthlyUsage / 50) * 100) + '%',
                  backgroundColor: device.monthlyUsage > 100 ? COLORS.danger : COLORS.glowBlue,
                  borderRadius: RADIUS.pill
                }} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: TYPO.captionSize, color: COLORS.glowBlue }}>0 m³</Text>
                <Text style={{ fontSize: TYPO.captionSize, color: device.monthlyUsage > 100 ? COLORS.danger : COLORS.glowGreen, fontWeight: '600' }}>
                  {device.monthlyUsage > 100 ? '⚠️ High Usage' : '✓ Normal'}
                </Text>
              </View>

              {/* Alert Message */}
              {device.hasAlert && (
                <View style={{
                  backgroundColor: 'rgba(255, 0, 85, 0.1)',
                  borderLeftWidth: 3,
                  borderLeftColor: COLORS.danger,
                  paddingHorizontal: SPACING.base,
                  paddingVertical: SPACING.small,
                  borderRadius: RADIUS.lg,
                  marginTop: SPACING.base
                }}>
                  <Text style={{ color: COLORS.danger, fontWeight: '600', fontSize: TYPO.captionSize }}>
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
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.lg,
            padding: SPACING.large,
            borderWidth: 2,
            borderColor: COLORS.glowBlue,
            shadowColor: COLORS.glowBlue,
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 5,
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: 56, marginBottom: SPACING.base }}>🎛️</Text>
            <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: SPACING.small }}>
              No Devices Connected
            </Text>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.glowBlue, textAlign: 'center', marginBottom: SPACING.large }}>
              Start tracking water consumption by linking your first meter
            </Text>
            <TouchableOpacity style={{
              backgroundColor: COLORS.glowBlue,
              paddingHorizontal: SPACING.large,
              paddingVertical: SPACING.base,
              borderRadius: RADIUS.lg,
              shadowColor: COLORS.glowBlue,
              shadowOpacity: 0.5,
              shadowRadius: 8,
              elevation: 5
            }} onPress={() => onOpenDevices && onOpenDevices()}>
              <Text style={{ color: COLORS.onPrimary, fontWeight: '700', fontSize: TYPO.bodySize }}>+ Link Device</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Quick Actions Footer */}
      <View style={{ paddingHorizontal: SPACING.base, marginTop: SPACING.large }}>
        <Text style={{ fontSize: TYPO.captionSize, color: COLORS.glowBlue, marginBottom: SPACING.base, fontWeight: '600' }}>
          Quick Actions
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <TouchableOpacity style={{
            flex: 1,
            backgroundColor: COLORS.cardBg,
            borderRadius: 16,
            paddingVertical: SPACING.large,
            marginRight: SPACING.small,
            alignItems: 'center',
            borderTopWidth: 3,
            borderTopColor: COLORS.glowBlue,
            borderWidth: 1,
            borderColor: COLORS.glowBlue,
            shadowColor: COLORS.glowBlue,
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5
          }} onPress={() => onOpenUsage && onOpenUsage()}>
            <Text style={{ fontSize: 28, marginBottom: SPACING.small }}>📊</Text>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.text, textAlign: 'center', fontWeight: '600' }}>Usage</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{
            flex: 1,
            backgroundColor: COLORS.cardBg,
            borderRadius: 16,
            paddingVertical: SPACING.large,
            marginRight: SPACING.small,
            alignItems: 'center',
            borderTopWidth: 3,
            borderTopColor: COLORS.glowGreen,
            borderWidth: 1,
            borderColor: COLORS.glowGreen,
            shadowColor: COLORS.glowGreen,
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5
          }} onPress={() => onOpenDevices && onOpenDevices()}>
            <Text style={{ fontSize: 28, marginBottom: SPACING.small }}>🎛️</Text>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.text, textAlign: 'center', fontWeight: '600' }}>Devices</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{
            flex: 1,
            backgroundColor: COLORS.cardBg,
            borderRadius: 16,
            paddingVertical: SPACING.large,
            alignItems: 'center',
            borderTopWidth: 3,
            borderTopColor: COLORS.danger,
            borderWidth: 1,
            borderColor: COLORS.danger,
            shadowColor: COLORS.danger,
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5
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
            <Text style={{ fontSize: 28, marginBottom: SPACING.small }}>🚪</Text>
            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.text, textAlign: 'center', fontWeight: '600' }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
