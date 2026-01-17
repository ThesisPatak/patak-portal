import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, Alert, Clipboard } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, TYPO, SPACING } from './variables';

export default function DeviceScreen({ token, onBack }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [houseId, setHouseId] = useState('');
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(null);

  // Load registered devices
  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://patak-portal-production.up.railway.app/devices/list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      }
    } catch (e) {
      console.warn('Failed to load devices:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterDevice = async () => {
    setError('');
    if (!deviceId.trim()) {
      setError('Please enter a Device ID');
      return;
    }

    setRegistering(true);
    try {
      const result = await Api.registerDevice(token, deviceId.trim(), houseId.trim() || null);
      setRegistered(result);
      setDeviceId('');
      setHouseId('');
      
      // Show success with LINK button
      Alert.alert(
        '✓ Device Registered!',
        `Device ID: ${result.device.deviceId}\nHouse: ${result.device.houseId || 'None'}\n\nNow link your ESP32 device to send data automatically.`,
        [
          {
            text: 'LINK Device',
            onPress: async () => {
              await handleLinkDevice(result.device.deviceId, result.deviceToken);
            },
            style: 'default'
          },
          { 
            text: 'Later', 
            onPress: () => setRegistered(null),
            style: 'cancel'
          }
        ]
      );

      // Reload devices list
      loadDevices();
    } catch (e) {
      setError(e.message || 'Registration failed');
      Alert.alert('Error', e.message);
    } finally {
      setRegistering(false);
    }
  };

  const handleLinkDevice = async (deviceId, deviceToken) => {
    try {
      Alert.alert(
        'Linking Device...',
        'Make sure your phone and ESP32 are on the same WiFi network.',
        [{ text: 'OK', onPress: () => {} }]
      );

      // Try to auto-discover ESP32 using mDNS hostname
      const espHostname = deviceId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const espURLs = [
        `http://${espHostname}.local`,
        `http://esp32-patak.local`,
        `http://esp32.local`
      ];

      let success = false;
      let lastError = '';

      for (const espURL of espURLs) {
        try {
          const response = await Promise.race([
            fetch(`${espURL}/api/token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ token: deviceToken })
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 3000)
            )
          ]);

          if (response.ok) {
            success = true;
            break;
          }
        } catch (err) {
          lastError = err.message;
          continue;
        }
      }

      if (success) {
        Alert.alert(
          '✓ Success!',
          'Device linked! Your ESP32 will now send data automatically.'
        );
        setRegistered(null);
        loadDevices();
      } else {
        Alert.alert(
          'Connection Issue',
          'Could not find ESP32 on your WiFi.\n\nMake sure:\n1. ESP32 is powered on\n2. Phone and ESP32 are on same WiFi\n3. Device ID matches: ' +
            deviceId
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to link device: ' + err.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: SPACING.base, paddingBottom: SPACING.xlarge, backgroundColor: COLORS.background }} style={{ backgroundColor: COLORS.background }}>
      <View style={{ marginBottom: SPACING.large }}>
        <TouchableOpacity onPress={onBack} style={{ marginBottom: SPACING.base }}>
          <Text style={{ color: COLORS.glowBlue, fontSize: TYPO.bodySize, fontWeight: '600' }}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Devices</Text>
      </View>

      {/* Register New Device Section */}
      <View style={[styles.card, { marginBottom: SPACING.large }]}>
        <Text style={{ fontSize: TYPO.subtitleSize, fontWeight: '700', color: COLORS.glowBlue, marginBottom: SPACING.base }}>
          Register New Device
        </Text>
        
        <Text style={{ fontSize: TYPO.smallSize, color: COLORS.text, marginBottom: SPACING.small }}>
          Device ID (e.g., ESP32-001)
        </Text>
        <TextInput
          placeholder="ESP32-001"
          value={deviceId}
          onChangeText={setDeviceId}
          style={[styles.input, { marginBottom: SPACING.base }]}
          editable={!registering}
          autoCapitalize="characters"
        />

        <Text style={{ fontSize: TYPO.smallSize, color: COLORS.text, marginBottom: SPACING.small }}>
          House Name (optional)
        </Text>
        <TextInput
          placeholder="house1"
          value={houseId}
          onChangeText={setHouseId}
          style={[styles.input, { marginBottom: SPACING.base }]}
          editable={!registering}
          autoCapitalize="none"
        />

        {error ? (
          <Text style={{ color: COLORS.danger, marginBottom: SPACING.base, fontSize: TYPO.smallSize }}>
            ❌ {error}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryButton, { opacity: registering ? 0.6 : 1 }]}
          onPress={handleRegisterDevice}
          disabled={registering}
        >
          <Text style={styles.primaryButtonText}>
            {registering ? 'Registering...' : 'Register Device'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Registered Devices Section */}
      <View>
        <Text style={{ fontSize: TYPO.subtitleSize, fontWeight: '700', color: COLORS.glowBlue, marginBottom: SPACING.base }}>
          Registered Devices ({devices.length})
        </Text>

        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: SPACING.large }}>
            <ActivityIndicator size="large" color={COLORS.glowBlue} />
          </View>
        ) : devices.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center', paddingVertical: SPACING.large }]}>
            <Text style={{ color: COLORS.textMuted, fontSize: TYPO.bodySize }}>
              No devices registered yet
            </Text>
            <Text style={{ color: COLORS.textMuted, fontSize: TYPO.smallSize, marginTop: SPACING.small }}>
              Register your first device above ↑
            </Text>
          </View>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={devices}
            keyExtractor={(item) => item.deviceId}
            renderItem={({ item }) => (
              <View style={[styles.card, { marginBottom: SPACING.base }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.base }}>
                  <Text style={{ fontSize: TYPO.subtitleSize, fontWeight: '700', color: COLORS.glowBlue }}>
                    {item.deviceId}
                  </Text>
                  <View style={{ paddingHorizontal: SPACING.small, paddingVertical: 4, backgroundColor: item.lastSeen ? COLORS.success : COLORS.warning, borderRadius: 8 }}>
                    <Text style={{ color: 'white', fontSize: TYPO.smallSize, fontWeight: '600' }}>
                      {item.lastSeen ? '🟢 Active' : '🔴 Offline'}
                    </Text>
                  </View>
                </View>

                {item.houseId && (
                  <Text style={{ fontSize: TYPO.smallSize, color: COLORS.text, marginBottom: SPACING.small }}>
                    House: <Text style={{ fontWeight: '600' }}>{item.houseId}</Text>
                  </Text>
                )}

                {item.lastSeen && (
                  <Text style={{ fontSize: TYPO.smallSize, color: COLORS.textMuted, marginBottom: SPACING.small }}>
                    Last seen: {new Date(item.lastSeen).toLocaleString()}
                  </Text>
                )}

                <Text style={{ fontSize: TYPO.smallSize, color: COLORS.textMuted }}>
                  Registered: {new Date(item.createdAt).toLocaleDateString()}
                </Text>

                {item.status && (
                  <View style={{ marginTop: SPACING.base, paddingTop: SPACING.base, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                    <Text style={{ fontSize: TYPO.smallSize, color: COLORS.text }}>
                      Status: <Text style={{ fontWeight: '600', color: COLORS.glowBlue }}>{item.status}</Text>
                    </Text>
                  </View>
                )}
              </View>
            )}
          />
        )}
      </View>

      {/* Instructions Card */}
      <View style={[styles.card, { marginTop: SPACING.large, backgroundColor: COLORS.infoBg }]}>
        <Text style={{ fontSize: TYPO.subtitleSize, fontWeight: '700', color: COLORS.glowBlue, marginBottom: SPACING.base }}>
          📱 How to Set Up Your Device
        </Text>
        <Text style={{ fontSize: TYPO.smallSize, color: COLORS.text, lineHeight: 20 }}>
          1. Enter your device ID (check ESP32 serial monitor or LCD){'\n'}
          2. Optionally enter a house name{'\n'}
          3. Tap "Register Device"{'\n'}
          4. Copy the device token{'\n'}
          5. Enter the token on your ESP32 using: <Text style={{ fontWeight: '600' }}>token &lt;device_token&gt;</Text>{'\n'}
          6. Device will start sending readings
        </Text>
      </View>
    </ScrollView>
  );
}
