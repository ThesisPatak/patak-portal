import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import { useAuth } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER = 'https://patak-portal-production.up.railway.app'; // Production server

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

export default function DashboardScreen() {
  const { user, setUser } = useAuth();
  const [summary, setSummary] = useState({});
  const [lastReading, setLastReading] = useState(null);

  useEffect(() => {
    let es;
    let closed = false;
    const connect = () => {
      es = new EventSource(`${SERVER}/api/stream`);
      es.addEventListener('summary', (e) => {
        const msg = JSON.parse(e.data);
        if (!closed) setSummary(msg.summary || {});
      });
        es.addEventListener('reading', (e) => {
          const reading = JSON.parse(e.data);
          const housename = (user?.username || 'house1').toLowerCase();
          if (reading.house === housename) setLastReading(reading);
        });
      es.onerror = () => { if (es) es.close(); setTimeout(connect, 3000); };
    };
    connect();
    return () => { closed = true; if (es) es.close(); };
  }, [user]);

  const housename = (user?.username || 'house1').toLowerCase();
  const houseSummary = summary[housename] || { cubicMeters: 0, last: null };
  const usage = Number(houseSummary.cubicMeters || 0).toFixed(6);
  const amount = computeResidentialBill(Number(houseSummary.cubicMeters || 0));

  async function logout() {
    Alert.alert(
      'Confirm',
      'Log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: async () => { await AsyncStorage.removeItem('user'); setUser(null); } }
      ],
      { cancelable: true }
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>PATAK Supplier - {housename}</Text>
        <Button title="Log out" onPress={logout} />
      </View>

      <View style={styles.card}>
        <Text style={styles.h4}>Real-Time Water Usage</Text>
        <Text style={styles.big}>{usage} m³</Text>
        <Text style={styles.small}>Last: {houseSummary.last ? new Date(houseSummary.last.timestamp).toLocaleString() : 'no data'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.h4}>Automated Billing</Text>
        <View style={{flexDirection:'row',justifyContent:'space-between'}}>
          <Text>Current Consumption</Text>
          <Text>{usage}</Text>
        </View>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:8}}>
          <Text>Amount Due (₱)</Text>
          <Text>₱{amount.toFixed(2)}</Text>
        </View>
      </View>

      {lastReading ? (
        <View style={styles.card}>
          <Text style={styles.h4}>Last Reading</Text>
          <Text>Liters: {Number(lastReading.totalLiters).toFixed(3)}</Text>
          <Text>Cubic m: {Number(lastReading.cubicMeters).toFixed(3)}</Text>
          <Text>Ts: {new Date(lastReading.timestamp * 1000).toLocaleString()}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  card: { background:'#fff', padding:12, borderRadius:8, marginBottom:12, elevation:2 },
  h4: { fontWeight:'600', marginBottom:8 },
  big: { fontSize:32, color:'#0057b8' },
  small: { color:'#666' }
});
