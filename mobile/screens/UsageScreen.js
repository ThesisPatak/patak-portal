import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, SPACING } from './variables';

function formatDate(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch (e) {
    return timestamp;
  }
}

export default function UsageScreen({ token, onBack }) {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  async function loadReadings() {
    try {
      setError(null);
      const data = await Api.getUsage(token);
      const history = data.history || [];
      setReadings(history);
    } catch (e) {
      console.error('Error loading readings:', e);
      setError(e.message || 'Failed to load readings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReadings();
  }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReadings();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.glowBlue} />
        <Text style={{ color: COLORS.glowBlue, marginTop: 12 }}>Loading readings...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, padding: SPACING.base }}>
      <TouchableOpacity onPress={onBack} style={{ marginBottom: SPACING.small }}>
        <Text style={{ color: COLORS.link, fontSize: 16 }}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Water Usage History</Text>

      {error && (
        <View style={{ backgroundColor: '#ff4444', padding: 12, marginBottom: 12, borderRadius: 8 }}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>⚠️ {error}</Text>
        </View>
      )}

      {readings.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: COLORS.text, fontSize: 16 }}>No readings yet</Text>
        </View>
      ) : (
        <FlatList
          data={readings.slice().reverse()}
          keyExtractor={(item, idx) => String(idx)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.glowBlue} />}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: '#1a3a52', padding: 12, marginBottom: 8, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: COLORS.glowBlue }}>
              <Text style={{ color: COLORS.glowBlue, fontWeight: 'bold', marginBottom: 4 }}>
                {formatDate(item.timestamp)}
              </Text>
              <Text style={{ color: COLORS.text, marginBottom: 2 }}>
                💧 {item.cubicMeters?.toFixed(4)} m³
              </Text>
              <Text style={{ color: '#aaa', fontSize: 12 }}>
                {item.totalLiters?.toFixed(0)} liters
              </Text>
            </View>
          )}
          ListHeaderComponent={
            <View style={{ marginBottom: 12, padding: 12, backgroundColor: '#1a3a52', borderRadius: 8 }}>
              <Text style={{ color: COLORS.text, marginBottom: 4 }}>Total Readings</Text>
              <Text style={{ color: COLORS.glowBlue, fontSize: 24, fontWeight: 'bold' }}>
                {readings.length}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
