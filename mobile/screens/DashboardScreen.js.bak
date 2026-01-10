import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, Alert, Animated } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, TYPO, SPACING, RADIUS, ELEVATION } from './variables';

// Simple circular progress component
const CircularProgress = ({ percentage, size = 200, strokeWidth = 8 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#f0f4f8',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
      }}>
        <View style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: 'transparent',
          borderTopColor: COLORS.primary,
          borderRightColor: COLORS.primary,
          opacity: percentage / 100,
          transform: [{ rotate: `${(percentage / 100) * 360}deg` }]
        }} />
        <View style={{ alignItems: 'center', zIndex: 10 }}>
          <Text style={{ fontSize: TYPO.h2, fontWeight: '700', color: COLORS.primary }}>
            {Math.round(percentage)}%
          </Text>
          <Text style={{ fontSize: TYPO.labelSize, color: COLORS.muted, marginTop: 4 }}>Utilization</Text>
        </View>
      </View>
    </View>
  );
};

export default function DashboardScreen({ token, onOpenUsage, onLogout, onPay, onOpenDevices }) {
  const [summary, setSummary] = useState(null);
  const [lastAge, setLastAge] = useState(0);
  const usageAnim = useRef(new Animated.Value(1)).current;
  const prevUsageRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let stopped = false;
    async function load() {
      try {
        const data = await Api.getDashboard(token);
        console.log('Dashboard getDashboard ->', data);
        if (mounted) {
          setSummary(data);
          try {
            const houses = data && data.summary ? Object.keys(data.summary) : [];
            const primary = (token && houses.includes(token.toLowerCase())) ? token.toLowerCase() : (houses[0] || null);
            const s = primary ? (data.summary[primary] || {}) : null;
            const usage = Number(s?.cubicMeters ?? (s?.last && s.last.cubicMeters) ?? s?.totalLiters ?? 0);
            const prev = prevUsageRef.current;
            if (prev != null && usage !== prev) {
              usageAnim.setValue(0.92);
              Animated.spring(usageAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
            }
            prevUsageRef.current = usage;
          } catch (e) {}
        }
      } catch (err) {
        console.warn('getDashboard error', err);
        if (mounted) setSummary(null);
      }
    }
    load();
    const id = setInterval(() => { if (!stopped) load(); }, 5000);
    const ageId = setInterval(() => {
      try {
        if (summary && summary.summary) {
          const houses = Object.keys(summary.summary);
          const primary = (token && houses.includes(token.toLowerCase())) ? token.toLowerCase() : (houses[0] || null);
          const s = primary ? (summary.summary[primary] || {}) : null;
          const received = s?.last?.receivedAt || s?.last?.timestamp;
          if (received) {
            const diff = Math.max(0, Math.floor((Date.now() - new Date(received).getTime()) / 1000));
            setLastAge(diff);
          }
        }
      } catch (e) {}
    }, 1000);
    return () => { stopped = true; mounted = false; clearInterval(id); clearInterval(ageId); };
  }, []);

  const houses = summary && summary.summary ? Object.keys(summary.summary) : [];
  const primaryHouse = (token && houses.includes(token.toLowerCase())) ? token.toLowerCase() : (houses[0] || null);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xlarge, flexGrow: 1 }} style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Premium Professional Header */}
      <View style={{
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.xlarge + 4,
        paddingHorizontal: SPACING.base,
        paddingTop: SPACING.xlarge + 8,
        paddingBottom: SPACING.xlarge + 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
        borderRadius: RADIUS.xl,
        marginHorizontal: SPACING.base,
        marginTop: SPACING.base,
        alignItems: 'center'
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.small }}>
          <Text style={{ fontSize: 38, marginRight: 12 }}>💧</Text>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: TYPO.labelSize, color: 'rgba(255,255,255,0.85)', fontWeight: '600', letterSpacing: 0.4 }}>Water Management</Text>
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff', marginTop: 2, letterSpacing: -0.2 }}>PATAK Monitor</Text>
          </View>
        </View>
        <Text style={{ fontSize: TYPO.bodySmall, color: 'rgba(255,255,255,0.9)', marginTop: 6, fontWeight: '500', lineHeight: 20, textAlign: 'center' }}>Real-time consumption tracking & automated billing</Text>
      </View>

      <View style={{ paddingHorizontal: SPACING.base, paddingTop: SPACING.large }}>
        {!summary ? (
          <View style={{ alignItems: 'center', marginTop: SPACING.large }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[styles.subtitle, { marginTop: SPACING.base }]}>Loading summary…</Text>
          </View>
        ) : (summary.summary && Object.keys(summary.summary).length === 0 ? (
          <View style={{
            backgroundColor: COLORS.cardBg,
            borderRadius: RADIUS.lg,
            padding: SPACING.large,
            alignItems: 'center',
            borderLeftWidth: 4,
            borderLeftColor: COLORS.warning
          }}>
            <Text style={{ fontSize: TYPO.bodySize, color: COLORS.muted, textAlign: 'center' }}>No houses found. Please configure your account.</Text>
          </View>
        ) : (
          <>
            {primaryHouse ? (
              (() => {
                const s = summary.summary[primaryHouse] || {};
                const usage = Number(s.cubicMeters ?? (s.last && s.last.cubicMeters) ?? s.totalLiters ?? 0);
                const totalLiters = s.totalLiters ?? (s.cubicMeters ? s.cubicMeters * 1000 : 0);
                const maxUsage = 50; // m³ - for visualization
                const utilizationPercent = Math.min(100, (usage / maxUsage) * 100);
                
                return (
                  <View>
                    {/* Primary House Card - Main Focus */}
                    <View style={{
                      backgroundColor: COLORS.cardBg,
                      borderRadius: RADIUS.lg,
                      padding: SPACING.large,
                      marginBottom: SPACING.large,
                      borderTopWidth: 3,
                      borderTopColor: COLORS.primary,
                      shadowColor: COLORS.shadow,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.12,
                      shadowRadius: 12,
                      elevation: ELEVATION.high,
                    }}>
                      {/* Header */}
                      <View style={{ marginBottom: SPACING.large, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>📍 Primary Property</Text>
                          <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.primary, marginTop: 6, letterSpacing: -0.2 }}>
                            {primaryHouse.toUpperCase()}
                          </Text>
                        </View>
                        <View style={{
                          backgroundColor: COLORS.success,
                          paddingVertical: 8,
                          paddingHorizontal: 16,
                          borderRadius: RADIUS.pill,
                          alignItems: 'center',
                          shadowColor: COLORS.shadow,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.12,
                          shadowRadius: 4,
                          elevation: 2
                        }}>
                          <Text style={{ fontSize: TYPO.captionSize, color: '#fff', fontWeight: '800', letterSpacing: 0.5 }}>● ACTIVE</Text>
                        </View>
                      </View>

                      {/* Last Update Status */}
                      <View style={{
                        paddingBottom: SPACING.base,
                        borderBottomWidth: 1,
                        borderBottomColor: COLORS.divider,
                        marginBottom: SPACING.large
                      }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View>
                            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, fontWeight: '600' }}>Last Reading</Text>
                            <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: COLORS.text, marginTop: 4 }}>
                              {s.last ? new Date(s.last.timestamp).toLocaleString() : 'Awaiting first reading'}
                            </Text>
                          </View>
                          {s.last && (
                            <Text style={{ fontSize: TYPO.captionSize, color: COLORS.success, fontWeight: '600' }}>
                              {lastAge}s ago
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Usage Display with Gauge */}
                      <View style={{
                        alignItems: 'center',
                        marginBottom: SPACING.large,
                        backgroundColor: '#f0f6ff',
                        borderRadius: RADIUS.lg,
                        padding: SPACING.large,
                        marginHorizontal: -SPACING.large,
                        marginTop: -SPACING.large,
                        paddingTop: SPACING.xlarge + 8
                      }}>
                        <CircularProgress percentage={utilizationPercent} size={180} strokeWidth={8} />
                        <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginTop: SPACING.large, fontWeight: '600', textAlign: 'center' }}>Current Billing Cycle</Text>
                      </View>

                      {/* Usage Metrics */}
                      <View style={{
                        flexDirection: 'row',
                        gap: SPACING.base,
                        marginBottom: SPACING.large,
                        marginTop: SPACING.large
                      }}>
                        <View style={{
                          flex: 1,
                          backgroundColor: '#0055cc',
                          borderRadius: RADIUS.lg,
                          padding: SPACING.base,
                          shadowColor: '#0055cc',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.2,
                          shadowRadius: 8,
                          elevation: 3
                        }}>
                          <Text style={{ fontSize: TYPO.captionSize, color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>💧 Cubic Meters</Text>
                          <Animated.Text style={{
                            fontSize: TYPO.h2,
                            fontWeight: '900',
                            color: '#fff',
                            marginTop: 8,
                            transform: [{ scale: usageAnim }]
                          }}>
                            {usage ? usage.toFixed(3) : '0.000'} m³
                          </Animated.Text>
                        </View>
                        <View style={{
                          flex: 1,
                          backgroundColor: '#7c3aed',
                          borderRadius: RADIUS.lg,
                          padding: SPACING.base,
                          shadowColor: '#7c3aed',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.2,
                          shadowRadius: 8,
                          elevation: 3
                        }}>
                          <Text style={{ fontSize: TYPO.captionSize, color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>🌊 Total Liters</Text>
                          <Text style={{ fontSize: TYPO.h2, fontWeight: '900', color: '#fff', marginTop: 8 }}>
                            {totalLiters ? totalLiters.toLocaleString() : '0'} L
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Billing & Payment Card */}
                    <View style={{
                      backgroundColor: COLORS.cardBg,
                      borderRadius: RADIUS.lg,
                      padding: SPACING.large,
                      marginBottom: SPACING.large,
                      borderTopWidth: 3,
                      borderTopColor: usage === 0 ? COLORS.muted : COLORS.danger,
                      shadowColor: usage === 0 ? COLORS.shadow : COLORS.danger,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: usage === 0 ? 0.08 : 0.15,
                      shadowRadius: usage === 0 ? 8 : 12,
                      elevation: usage === 0 ? 2 : 4,
                    }}>
                      <View style={{ marginBottom: SPACING.base }}>
                        <Text style={{ fontSize: TYPO.labelSize, color: COLORS.muted, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>💳 Billing Summary</Text>
                      </View>

                      {/* Amount Due - Large Display */}
                      <View style={{ marginBottom: SPACING.large, paddingBottom: SPACING.large, borderBottomWidth: 2, borderBottomColor: COLORS.divider }}>
                        <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, fontWeight: '600', marginBottom: 8 }}>Amount Due</Text>
                        <Text style={{
                          fontSize: 42,
                          fontWeight: '900',
                          color: usage === 0 ? COLORS.muted : COLORS.danger,
                          letterSpacing: -1
                        }}>
                          ₱{usage === 0 ? '0.00' : Number((() => {
                            const MINIMUM = 255.0;
                            if (usage <= 10) return MINIMUM;
                            let excess = usage - 10;
                            let total = MINIMUM;
                            if (excess > 0) {
                              const m3 = Math.min(excess, 10);
                              total += m3 * 33.0;
                              excess -= m3;
                            }
                            if (excess > 0) {
                              const m3 = Math.min(excess, 10);
                              total += m3 * 40.5;
                              excess -= m3;
                            }
                            if (excess > 0) {
                              const m3 = Math.min(excess, 10);
                              total += m3 * 48.0;
                              excess -= m3;
                            }
                            if (excess > 0) {
                              total += excess * 55.5;
                            }
                            return total;
                          })()).toFixed(2)}
                        </Text>
                      </View>

                      {/* Billing Details Grid */}
                      <View style={{ gap: SPACING.base }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: SPACING.small, borderBottomWidth: 1, borderBottomColor: COLORS.divider }}>
                          <Text style={{ fontSize: TYPO.bodySmall, color: COLORS.muted, fontWeight: '600' }}>📅 Due Date</Text>
                          <Text style={{ fontSize: TYPO.bodySize, fontWeight: '800', color: COLORS.text }}>
                            {usage === 0 ? '—' : (() => {
                              const date = new Date();
                              date.setMonth(date.getMonth() + 1);
                              return date.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
                            })()}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: TYPO.bodySmall, color: COLORS.muted, fontWeight: '600' }}>📊 Status</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: usage === 0 ? COLORS.muted : COLORS.danger
                            }} />
                            <Text style={{ fontSize: TYPO.bodySmall, fontWeight: '800', color: usage === 0 ? COLORS.muted : COLORS.danger }}>
                              {usage === 0 ? 'No Data' : 'Pending Payment'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={{ gap: SPACING.small, marginBottom: SPACING.large }}>
                      <TouchableOpacity
                        style={{
                          backgroundColor: COLORS.danger,
                          paddingVertical: 16,
                          borderRadius: RADIUS.lg,
                          alignItems: 'center',
                          shadowColor: COLORS.danger,
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.25,
                          shadowRadius: 12,
                          elevation: 5
                        }}
                        onPress={() => onPay && onPay(primaryHouse, usage === 0 ? 0 : Number((() => {
                          const MINIMUM = 255.0;
                          if (usage <= 10) return MINIMUM;
                          let excess = usage - 10;
                          let total = MINIMUM;
                          if (excess > 0) {
                            const m3 = Math.min(excess, 10);
                            total += m3 * 33.0;
                            excess -= m3;
                          }
                          if (excess > 0) {
                            const m3 = Math.min(excess, 10);
                            total += m3 * 40.5;
                            excess -= m3;
                          }
                          if (excess > 0) {
                            const m3 = Math.min(excess, 10);
                            total += m3 * 48.0;
                            excess -= m3;
                          }
                          if (excess > 0) {
                            total += excess * 55.5;
                          }
                          return total;
                        })().toFixed(2)))}
                      >
                        <Text style={{ color: '#fff', fontSize: TYPO.bodySize, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 }}>💳 PAY NOW</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          backgroundColor: COLORS.primaryLight,
                          paddingVertical: 16,
                          borderRadius: RADIUS.lg,
                          alignItems: 'center',
                          shadowColor: COLORS.primary,
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.2,
                          shadowRadius: 10,
                          elevation: 4
                        }}
                        onPress={() => onOpenUsage(primaryHouse)}
                      >
                        <Text style={{ color: '#fff', fontSize: TYPO.bodySize, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 }}>📊 ANALYTICS</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          backgroundColor: COLORS.textSecondary,
                          paddingVertical: 16,
                          borderRadius: RADIUS.lg,
                          alignItems: 'center',
                          shadowColor: COLORS.textSecondary,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.15,
                          shadowRadius: 8,
                          elevation: 3
                        }}
                        onPress={() => onOpenDevices && onOpenDevices()}
                      >
                        <Text style={{ color: '#fff', fontSize: TYPO.bodySize, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 }}>⚙️ DEVICES</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Other Properties */}
                    {houses.filter(h => h !== primaryHouse).length > 0 && (
                      <View style={{ marginBottom: SPACING.large }}>
                        <Text style={{ fontSize: TYPO.h4, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.base, letterSpacing: 0.5 }}>OTHER PROPERTIES</Text>
                        {houses.filter(h => h !== primaryHouse).map((item) => {
                          const s = summary.summary[item] || {};
                          const itemUsage = Number(s.cubicMeters ?? (s.last && s.last.cubicMeters) ?? 0);
                          return (
                            <TouchableOpacity
                              key={item}
                              style={{
                                backgroundColor: COLORS.cardBg,
                                borderRadius: RADIUS.base,
                                padding: SPACING.base,
                                marginBottom: SPACING.small,
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderLeftWidth: 3,
                                borderLeftColor: COLORS.info,
                                shadowColor: COLORS.shadow,
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                                shadowRadius: 4,
                                elevation: ELEVATION.low,
                              }}
                              onPress={() => onOpenUsage(item)}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: '800', color: COLORS.primary, fontSize: TYPO.bodySize }}>
                                  {item.toUpperCase()}
                                </Text>
                                <Text style={{ fontSize: TYPO.captionSize, color: COLORS.muted, marginTop: 4 }}>
                                  {s.last ? new Date(s.last.timestamp).toLocaleDateString() : 'No data'}
                                </Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ fontWeight: '800', color: COLORS.primary, fontSize: TYPO.bodySize }}>
                                  {itemUsage.toFixed(3)} m³
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })()
            ) : null}
          </>
        ))}
      </View>

      {/* Logout Button */}
      <View style={{ paddingHorizontal: SPACING.base, paddingBottom: SPACING.large }}>
        <TouchableOpacity
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
          style={{
            backgroundColor: 'transparent',
            borderColor: COLORS.danger,
            borderWidth: 2,
            paddingVertical: 14,
            borderRadius: RADIUS.base,
            alignItems: 'center'
          }}
        >
          <Text style={{ color: COLORS.danger, fontSize: TYPO.bodySize, fontWeight: '800' }}>Log out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
