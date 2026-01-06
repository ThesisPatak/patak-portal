import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, Alert, Animated } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, TYPO, SPACING } from './variables';

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
          // animate primary usage when it changes
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

  function computeResidentialBill(usage) {
    const MINIMUM = 255.0;
    if (!usage || usage === 0) return 0;
    if (usage <= 10) return Number(MINIMUM.toFixed(2));
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
    return Number(total.toFixed(2));
  }

  return (
    <ScrollView contentContainerStyle={{ padding: SPACING.base, paddingTop: SPACING.small, paddingBottom: SPACING.xlarge, flexGrow: 1 }} style={{ flex: 1 }}>
      <Text style={styles.title}>Overview</Text>

      

      {!summary ? (
        <View style={{ alignItems: 'center', marginTop: SPACING.large }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.subtitle, { marginTop: SPACING.base }]}>Loading summary…</Text>
        </View>
      ) : (summary.summary && Object.keys(summary.summary).length === 0 ? (
        <Text style={styles.subtitle}>No houses found (summary is empty).</Text>
      ) : (
        <>
          {primaryHouse ? (
            (() => {
              const s = summary.summary[primaryHouse] || {};
              const usage = Number(s.cubicMeters ?? (s.last && s.last.cubicMeters) ?? s.totalLiters ?? 0);
              
              // Calculate due date from readingStartDate (only show if usage > 0)
              const due = (() => {
                if (usage === 0) return null; // No usage yet, show "Not yet active"
                if (!s.readingStartDate) return null; // No readings yet
                const startDate = new Date(s.readingStartDate);
                const dueDate = new Date(startDate);
                dueDate.setMonth(dueDate.getMonth() + 1);
                return dueDate.toISOString().slice(0, 10);
              })();
              
              return (
                <View style={styles.cardLatest}> 
                  <Text style={{ fontWeight: '800', color: COLORS.primary, fontSize: TYPO.subtitleSize + 3 }}>{primaryHouse.toUpperCase()}</Text>
                  <Text style={[styles.subtitle, { marginTop: SPACING.base, fontSize: TYPO.smallSize + 2 }]}>Last reading</Text>
                  <Text style={[styles.subtitle, { marginTop: 2 }]}>{s.last ? new Date(s.last.timestamp).toLocaleString() : 'Not yet active'}</Text>
                  {s.last && <Text style={[styles.smallText, { marginTop: 4 }]}>Updated {lastAge}s ago</Text>}
                  <View style={{ height: SPACING.small }} />
                  <Text style={[styles.subtitle, { fontSize: TYPO.subtitleSize + 2 }]}>Usage</Text>
                  <Animated.Text style={[styles.latestValue, { transform: [{ scale: usageAnim }] }]}>{usage ? usage.toFixed(3) : '0.000'} m³</Animated.Text>

                  <View style={{ height: SPACING.small }} />
                  <Text style={{ fontSize: TYPO.bodySize, fontWeight: '800', color: COLORS.link }}>Amount Due (₱)</Text>
                  {due ? (
                    <>
                      <Text style={{ fontSize: TYPO.bodySize + 2, fontWeight: '800', color: COLORS.link }}>₱{Number(computeResidentialBill(usage)).toFixed(2)}</Text>
                      <Text style={[styles.subtitle, { marginTop: SPACING.base }]}>Due Date: {due}</Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: TYPO.bodySize + 2, fontWeight: '700', color: COLORS.warning }}>Not yet active</Text>
                  )}

                  {/* Expanded metrics for mobile monitoring */}
                  <View style={{ height: SPACING.base }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.small }}>
                    <View>
                      <Text style={[styles.smallText]}>Total Liters</Text>
                      <Text style={{ fontWeight: '700' }}>{s.totalLiters ?? '—'}</Text>
                    </View>
                    <View>
                      <Text style={[styles.smallText]}>Cubic Meters</Text>
                      <Text style={{ fontWeight: '700' }}>{s.cubicMeters ?? (s.totalLiters ? (Number(s.totalLiters) / 1000).toFixed(3) : '—')}</Text>
                    </View>
                  </View>

                  <View style={{ height: SPACING.base }} />
                  <TouchableOpacity style={[styles.primaryButton]} onPress={() => onPay && onPay(primaryHouse, computeResidentialBill(usage))}>
                    <Text style={[styles.primaryButtonText]}>PAY</Text>
                  </TouchableOpacity>
                  <View style={{ height: SPACING.base }} />
                  <TouchableOpacity style={styles.primaryButton} onPress={() => onOpenUsage(primaryHouse)}>
                    <Text style={styles.primaryButtonText}>View Usage Details</Text>
                  </TouchableOpacity>
                  <View style={{ height: SPACING.base }} />
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: COLORS.secondary }]} onPress={() => onOpenDevices && onOpenDevices()}>
                    <Text style={styles.primaryButtonText}>🔧 My Devices</Text>
                  </TouchableOpacity>
                </View>
              );
            })()
          ) : null}

          <View style={{ marginTop: 6 }}>
            {houses.filter(h => h !== primaryHouse).map((item) => {
              const s = summary.summary[item] || {};
              return (
                <TouchableOpacity key={item} style={styles.cardSmall} onPress={() => onOpenUsage(item)}>
                  <Text style={{ fontWeight: '700', color: COLORS.primary }}>{item}</Text>
                  <Text style={styles.subtitle}>Last reading: {s.last ? new Date(s.last.timestamp).toLocaleString() : 'Not yet active'}</Text>
                  <Text style={styles.subtitle}>Total Liters: {s.totalLiters ?? '—'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ))}

      <View style={{ height: 8 }} />
      <TouchableOpacity
        onPress={() => {
          Alert.alert(
            'Confirm',
            'Log out?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log out', style: 'destructive', onPress: () => onLogout && onLogout() }
            ],
            { cancelable: true }
          );
        }}
        style={[
          styles.secondaryButton,
          {
            alignSelf: 'stretch',
            marginTop: SPACING.small,
            borderColor: COLORS.danger,
            marginBottom: SPACING.xlarge,
            paddingVertical: 14
          }
        ]}
      >
        <Text style={[styles.secondaryButtonText, { color: COLORS.danger, textAlign: 'center', width: '100%' }]}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
