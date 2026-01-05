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

  useEffect(() => {
    let mounted = true;
    let stopped = false;
    async function load() {
      try {
        const data = await Api.getUsage(token);
        if (mounted) {
          // show newest first
          const h = (data.history || []).slice().reverse();
          setItems(h);
        }
      } catch (e) {
        // ignore load errors during polling
      }
    }
    load();
    const id = setInterval(() => { if (!stopped) load(); }, 5000);
    return () => { stopped = true; mounted = false; clearInterval(id); };
  }, [token]);

  // pull-to-refresh
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try { await Api.getUsage(token).then(d => setItems((d.history || []).slice().reverse())); } catch(e){}
    setRefreshing(false);
  };

  return (
    <View style={{ padding: SPACING.base, flex: 1 }}>
      <TouchableOpacity onPress={onBack} style={{ marginBottom: SPACING.small }}>
        <Text style={{ color: COLORS.link }}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Usage History</Text>

      {items.length === 0 ? (
        <Text style={styles.subtitle}>No readings available yet.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, idx) => String(idx)}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderItem={({ item }) => (
            <View style={styles.cardSmall}>
              <Text style={{ fontWeight: '700' }}>{fmt(item.timestamp)}</Text>
              <Text style={styles.subtitle}>Total Liters: {item.totalLiters ?? '—'}</Text>
              <Text style={styles.subtitle}>Cubic Meters: {item.cubicMeters ?? '—'}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
