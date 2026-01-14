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

function calculateFlowRate(liters, durationSeconds) {
  if (!durationSeconds || durationSeconds === 0) return 0;
  return (liters / durationSeconds) * 60; // liters per minute
}

function calculateCost(cubicMeters) {
  // Philippine water rate: approximately ₱ 9.50 per cubic meter
  const RATE_PER_CUBIC_METER = 9.50;
  return cubicMeters * RATE_PER_CUBIC_METER;
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
      
      // Show only the last 50 readings (most recent first)
      const last50Readings = history.slice(0, 50);
      
      setReadings(last50Readings);
    } catch (e) {
      console.error('Error loading readings:', e);
      setError(e.message || 'Failed to load readings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReadings();
    
    // Real-time polling: refresh every 5 seconds to show new readings
    const interval = setInterval(() => {
      loadReadings();
    }, 5000);
    
    return () => clearInterval(interval);
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
          keyExtractor={(item, idx) => `${item.timestamp}-${idx}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.glowBlue} />}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: '#1a3a52', padding: 12, marginBottom: 8, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: COLORS.glowBlue }}>
              <Text style={{ color: COLORS.glowBlue, fontWeight: 'bold', marginBottom: 8 }}>
                {formatDate(item.timestamp)}
              </Text>
              
              {/* Volume Data */}
              <View style={{ marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#2a4a62' }}>
                <Text style={{ color: COLORS.text, marginBottom: 2 }}>
                  💧 Volume: {item.cubicMeters?.toFixed(4)} m³ ({item.totalLiters?.toFixed(0)} L)
                </Text>
              </View>

              {/* Flow Rate */}
              {item.durationSeconds && item.totalLiters && (
                <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 4 }}>
                  ⚡ Flow Rate: {calculateFlowRate(item.totalLiters, item.durationSeconds).toFixed(2)} L/min
                </Text>
              )}

              {/* Usage Duration */}
              {item.durationSeconds && (
                <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 4 }}>
                  ⏱️ Duration: {Math.floor(item.durationSeconds)} seconds
                </Text>
              )}

              {/* Cost */}
              <Text style={{ color: '#FFD700', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
                💰 Cost: ₱{calculateCost(item.cubicMeters || 0).toFixed(2)}
              </Text>

              {/* Device ID */}
              {item.deviceId && (
                <Text style={{ color: '#888', fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
                  Device: {item.deviceId}
                </Text>
              )}
            </View>
          )}
          ListHeaderComponent={
            <View style={{ marginBottom: 12, padding: 12, backgroundColor: '#1a3a52', borderRadius: 8 }}>
              <Text style={{ color: COLORS.text, marginBottom: 4 }}>Recent Readings (Last 50)</Text>
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
