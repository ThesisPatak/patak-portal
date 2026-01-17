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
    Alert.prompt(
      'Link Device to ESP32',
      'Enter your ESP32 IP address (e.g., 192.168.1.100)\n\nMake sure ESP32 is on the same WiFi.',
      [
        {
          text: 'Cancel',
          onPress: () => setRegistered(null),
          style: 'cancel'
        },
        {
          text: 'Link',
          onPress: async (espIP) => {
            if (!espIP || espIP.trim() === '') {
              Alert.alert('Error', 'Please enter a valid IP address');
              return;
            }

            try {
              const baseUrl = 'https://patak-portal-production.up.railway.app';
              const response = await fetch(`${baseUrl}/devices/send-token`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  deviceId,
                  espIP: espIP.trim()
                })
              });

              if (response.ok) {
                Alert.alert('✓ Success!', 'Device token sent to ESP32. Your device should start sending data now.');
                setRegistered(null);
              } else {
                const error = await response.json();
                Alert.alert('Error', error.error || 'Failed to link device');
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to connect to ESP32. Make sure:\n1. ESP32 is powered on\n2. IP address is correct\n3. Phone and ESP32 are on same WiFi');
            }
          }
        }
      ],
      'plain-text'
    );
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
