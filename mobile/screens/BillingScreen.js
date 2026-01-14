import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, SPACING } from './variables';

function computeResidentialBill(usage) {
  const MINIMUM = 255.0;
  if (!usage || usage <= 10) return Number(MINIMUM.toFixed(2));
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

export default function BillingScreen({ onBack, token, username }) {
  const [summary, setSummary] = useState(null);
  const [userCreatedAt, setUserCreatedAt] = useState(null);

  useEffect(() => {
    let mounted = true;
    let stopped = false;
    async function load() {
      try {
        const data = await Api.getDashboard(token);
        if (mounted) {
          setSummary(data.summary || {});
          setUserCreatedAt(data.userCreatedAt || new Date().toISOString());
        }
      } catch (e) {}
    }
    if (token) {
      load();
      const id = setInterval(() => { if (!stopped) load(); }, 1000);
      return () => { stopped = true; mounted = false; clearInterval(id); };
    }
    return () => { mounted = false; };
  }, [token]);

  const houses = summary ? Object.keys(summary) : [];

  return (
    <View style={{ padding: SPACING.base, flex: 1 }}>
      <TouchableOpacity onPress={onBack} style={[styles.secondaryButton, { alignSelf: 'flex-start', marginBottom: SPACING.small }]}>
        <Text style={styles.secondaryButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Automated Billing</Text>

      {houses.length === 0 ? (
        <Text style={styles.subtitle}>No billing data available.</Text>
      ) : (
          <FlatList
            data={houses}
            keyExtractor={(h) => h}
            renderItem={({ item }) => {
              const s = summary[item] || {};
              const usage = s.cubicMeters ?? 0;
              const amount = s.monthlyBill ?? 0;
              
              // Due date: from first reading timestamp + 1 month (or "Not yet active")
              const due = (() => { 
                if (Number(usage) === 0 || !s.lastReading?.timestamp) return 'Not yet active';
                const firstReadingDate = new Date(s.lastReading.timestamp);
                const dueDate = new Date(firstReadingDate);
                dueDate.setMonth(dueDate.getMonth() + 1);
                return dueDate.toISOString().slice(0,10);
              })();
              
              const status = Number(usage) === 0 ? 'No data' : 'Unpaid';
              const isOnline = s.isOnline ?? false;
              const deviceStatus = isOnline ? '🟢 Online' : '🔴 Offline';
              
              return (
                <View style={styles.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontWeight: '700', color: COLORS.primary }}>{username || 'User'}</Text>
                    <Text style={{ fontSize: 12, color: isOnline ? '#4caf50' : '#ff6b6b', fontWeight: '600' }}>{deviceStatus}</Text>
                  </View>
                  <Text style={styles.subtitle}>Usage (m³): {typeof usage === 'number' ? usage.toFixed(6) : usage}</Text>
                  <Text style={styles.subtitle}>Amount Due (₱): ₱{amount.toFixed(2)}</Text>
                  <Text style={styles.subtitle}>Due Date: {due}</Text>
                  <Text style={[styles.subtitle, { color: status === 'Unpaid' ? COLORS.danger : COLORS.muted }]}>{status}</Text>
                </View>
              );
            }}
          />
      )}
    </View>
  );
}
