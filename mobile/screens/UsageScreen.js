import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, SPACING } from './variables';

function fmt(ts) {
  try { return new Date(ts).toLocaleString(); } catch (e) { return ts; }
}

export default function UsageScreen({ token, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    let stopped = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await Api.getUsage(token);
        if (mounted) {
          const h = (data.history || []);
          setItems(h);
        }
      } catch (e) {
        if (mounted) {
          setError(`Failed to load readings: ${e.message}`);
          console.error('UsageScreen load error:', e);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const id = setInterval(() => { if (!stopped) load(); }, 10000);
    return () => { stopped = true; mounted = false; clearInterval(id); };
  }, [token]);

  // pull-to-refresh
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try { await Api.getUsage(token).then(d => setItems(d.history || [])); } catch(e){}
    setRefreshing(false);
  };

  return (
    <View style={{ padding: SPACING.base, flex: 1, backgroundColor: COLORS.background }}>
      <TouchableOpacity onPress={onBack} style={{ marginBottom: SPACING.small }}>
        <Text style={{ color: COLORS.link }}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Usage History</Text>

      {error && (
        <View style={{ backgroundColor: '#ff4444', padding: 12, marginBottom: 12, borderRadius: 8 }}>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{error}</Text>
        </View>
      )}

      {loading && items.length === 0 ? (
        <Text style={styles.subtitle}>Loading readings...</Text>
      ) : items.length === 0 ? (
        <Text style={styles.subtitle}>No readings available yet.</Text>
      ) : (
        <FlatList
          data={items.slice().reverse()}
          keyExtractor={(item, idx) => String(idx)}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderItem={({ item }) => (
            <View style={styles.cardSmall}>
              <Text style={{ fontWeight: '700', color: COLORS.text }}>{fmt(item.timestamp)}</Text>
              <Text style={styles.subtitle}>Cubic Meters: {item.cubicMeters?.toFixed(6) ?? '—'}</Text>
              <Text style={styles.subtitle}>Total Liters: {item.totalLiters ?? '—'}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
