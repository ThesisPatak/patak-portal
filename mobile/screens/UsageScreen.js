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

// Tiered water billing calculation - MUST MATCH SERVER & DASHBOARD
// Import from a shared utility or use the same logic as DashboardScreenMinimal
function calculateWaterBill(cubicMeters) {
  const MINIMUM_CHARGE = 255.00;
  const FREE_USAGE = 10; // cubic meters included in minimum
  
  if (cubicMeters <= 0) {
    return 0;
  }
  
  if (cubicMeters <= FREE_USAGE) {
    return MINIMUM_CHARGE;
  }
  
  const excess = cubicMeters - FREE_USAGE;
  const tier1 = Math.min(excess, 10);           // 11-20 m³: 33.00 per m³
  const tier2 = Math.min(Math.max(excess - 10, 0), 10);  // 21-30 m³: 40.50 per m³
  const tier3 = Math.min(Math.max(excess - 20, 0), 10);  // 31-40 m³: 48.00 per m³
  const tier4 = Math.max(excess - 30, 0);      // 41+ m³: 55.50 per m³
  
  const excessCharge = (tier1 * 33.00) + (tier2 * 40.50) + (tier3 * 48.00) + (tier4 * 55.50);
  return Math.round((MINIMUM_CHARGE + excessCharge) * 100) / 100;
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
    
    // Real-time polling: sync with ESP32 data in near real-time
    // Reduced to 2 seconds for faster updates when device sends readings
    const interval = setInterval(() => {
      loadReadings();
    }, 2000); // Changed from 5000ms to 2000ms
    
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

      <Text style={styles.title}>Water Consumption History</Text>

      {error && (
        <View style={{ backgroundColor: '#ff4444', padding: 12, marginBottom: 12, borderRadius: 8 }}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>⚠️ {error}</Text>
        </View>
      )}

      {readings.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.base }}>
          <View style={{ backgroundColor: '#1a3a52', padding: 24, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: COLORS.glowBlue, fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
              📱 No Device Registered
            </Text>
            <Text style={{ color: COLORS.text, fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
              Please register your water meter device to start viewing consumption history.</Text>
            </Text>
            <Text style={{ color: '#aaa', fontSize: 12, textAlign: 'center', fontStyle: 'italic' }}>
              Once your device is registered, readings will appear here.
            </Text>
          </View>
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
                  💧 Volume: {item.cubicMeters?.toFixed(6)} m³ ({item.totalLiters?.toFixed(0)} L)
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
                💰 Estimated Bill: ₱{calculateWaterBill(item.cubicMeters || 0).toFixed(2)}
              </Text>

              {/* Device ID */}
              {item.deviceId && (
                <Text style={{ color: '#888', fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
                  Device: {item.deviceId}
                </Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}
