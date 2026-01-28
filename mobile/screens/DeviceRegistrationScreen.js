import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, TYPO, SPACING } from './variables';

const { width } = Dimensions.get('window');

export default function DeviceRegistrationScreen({ token, username, onDeviceRegistered }) {
  const [deviceId, setDeviceId] = useState('');
  const [houseId, setHouseId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeviceIdError, setShowDeviceIdError] = useState(false);

  const handleRegisterDevice = async () => {
    setError('');
    setShowDeviceIdError(false);

    if (!deviceId.trim()) {
      setShowDeviceIdError(true);
      setError('Device ID is required');
      return;
    }

    setLoading(true);
    try {
      const result = await Api.registerDevice(token, deviceId.trim(), houseId.trim() || null);
      
      Alert.alert(
        '✓ Device Registered Successfully!',
        `Device ID: ${result.device.deviceId}\nHouse: ${result.device.houseId || 'None'}\n\nYou can now access your dashboard.`,
        [
          {
            text: 'Continue to Dashboard',
            onPress: () => onDeviceRegistered && onDeviceRegistered(),
            style: 'default'
          }
        ]
      );
    } catch (err) {
      console.error('Device registration error:', err);
      setError(err.message || 'Failed to register device. Please try again.');
      Alert.alert('Registration Failed', err.message || 'Could not register device');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipForNow = () => {
    Alert.alert(
      'Device Registration Required',
      'You must register at least one device to use the dashboard. Please enter your device ID to continue.',
      [
        {
          text: 'OK',
          onPress: () => {},
          style: 'default'
        }
      ]
    );
  };

  const containerPadding = width > 400 ? 36 : 18;
  const cardWidth = width > 400 ? 420 : width - 32;

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: SPACING.xlarge
      }}
      style={{ backgroundColor: COLORS.background }}
    >
      <View
        style={{
          backgroundColor: COLORS.cardBg,
          borderRadius: 24,
          padding: containerPadding,
          width: cardWidth,
          borderWidth: 2,
          borderColor: COLORS.glowGreen,
          shadowColor: COLORS.glowGreen,
          shadowOpacity: 0.5,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10
        }}
      >
        <Text
          style={{
            fontSize: TYPO.titleSize,
            fontWeight: '900',
            color: COLORS.text,
            marginBottom: SPACING.base,
            letterSpacing: 1,
            textTransform: 'uppercase',
            textShadowColor: COLORS.glowGreen,
            textShadowRadius: 8
          }}
        >
          Register Device
        </Text>

        <Text
          style={{
            fontSize: TYPO.bodySize,
            color: COLORS.text,
            marginBottom: SPACING.large,
            lineHeight: 22
          }}
        >
          Welcome, {username}! To access your dashboard, you must register at least one device first.
        </Text>

        {error ? (
          <View
            style={{
              backgroundColor: 'rgba(255, 0, 85, 0.1)',
              borderLeftWidth: 4,
              borderLeftColor: '#ff0055',
              padding: SPACING.base,
              marginBottom: SPACING.large,
              borderRadius: 8
            }}
          >
            <Text style={{ color: '#ff0055', fontWeight: '600' }}>⚠ {error}</Text>
          </View>
        ) : null}

        <View style={{ marginBottom: SPACING.large }}>
          <Text
            style={{
              fontSize: TYPO.labelSize,
              color: COLORS.glowBlue,
              fontWeight: '700',
              marginBottom: SPACING.small
            }}
          >
            Device ID *
          </Text>
          <Text
            style={{
              fontSize: TYPO.smallSize,
              color: COLORS.text,
              marginBottom: SPACING.small,
              opacity: 0.7
            }}
          >
            e.g., ESP32-001, METER-001
          </Text>
          <TextInput
            placeholder="Enter your device ID"
            placeholderTextColor={COLORS.textDim}
            value={deviceId}
            onChangeText={(text) => {
              setDeviceId(text);
              setShowDeviceIdError(false);
            }}
            style={[
              styles.input,
              {
                borderColor: showDeviceIdError ? '#ff0055' : COLORS.glowBlue,
                borderWidth: 2
              }
            ]}
            editable={!loading}
            autoCapitalize="characters"
          />
        </View>

        <View style={{ marginBottom: SPACING.large }}>
          <Text
            style={{
              fontSize: TYPO.labelSize,
              color: COLORS.glowBlue,
              fontWeight: '700',
              marginBottom: SPACING.small
            }}
          >
            House/Location (Optional)
          </Text>
          <TextInput
            placeholder="e.g., Main House, Garage"
            placeholderTextColor={COLORS.textDim}
            value={houseId}
            onChangeText={setHouseId}
            style={[styles.input, { borderColor: COLORS.glowBlue, borderWidth: 2 }]}
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: COLORS.glowGreen,
              opacity: loading ? 0.6 : 1
            }
          ]}
          onPress={handleRegisterDevice}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text
              style={{
                color: 'white',
                fontSize: TYPO.bodySize,
                fontWeight: '700',
                letterSpacing: 0.5
              }}
            >
              Register Device
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            marginTop: SPACING.base,
            padding: SPACING.base
          }}
          onPress={handleSkipForNow}
          disabled={loading}
        >
          <Text
            style={{
              color: COLORS.glowBlue,
              fontSize: TYPO.bodySize,
              fontWeight: '600',
              textAlign: 'center'
            }}
          >
            ❓ Need Help?
          </Text>
        </TouchableOpacity>

        <View
          style={{
            marginTop: SPACING.large,
            paddingTop: SPACING.large,
            borderTopWidth: 1,
            borderTopColor: COLORS.glowGreen
          }}
        >
          <Text
            style={{
              fontSize: TYPO.smallSize,
              color: COLORS.text,
              opacity: 0.6,
              lineHeight: 18
            }}
          >
            💡 <Text style={{ fontWeight: '600' }}>Device ID:</Text> Find this on your device sticker or manual. Example: ESP32-001, METER-001
          </Text>
          <Text
            style={{
              fontSize: TYPO.smallSize,
              color: COLORS.glowGreen,
              marginTop: SPACING.small,
              fontWeight: '600'
            }}
          >
            ⚡ Device registration is required to proceed.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
