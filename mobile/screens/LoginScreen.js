import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StatusBar } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS } from './variables';

export default function LoginScreen({ onLogin, onShowRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Configure status bar on component mount
  useEffect(() => {
    StatusBar.setBackgroundColor('#0a1628', true);
    StatusBar.setBarStyle('light-content');
  }, []);

  const handleLogin = async () => {
    setError('');
    if (!username) return setError('Please enter a username');
    if (!password) return setError('Please enter a password');
    setLoading(true);
    try {
      // Always use Railway production server (no manual override in production)
      const data = await Api.login(username, password);
      if (data && data.token) {
        onLogin(data.token, username);
      } else setError('Invalid credentials');
    } catch (e) {
      if (e.status === 401) {
        setError('Wrong password');
      } else if (e.message && e.message.includes('fetch')) {
        setError('Cannot reach server. Check your internet connection.');
      } else {
        setError('Network error — check server connection');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
      <View style={{
        backgroundColor: COLORS.cardBg,
        borderRadius: 24,
        padding: 36,
        width: '100%',
        maxWidth: 420,
        minHeight: 480,
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: COLORS.glowBlue,
        shadowColor: COLORS.glowBlue,
        shadowOpacity: 0.5,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      }}>
        <Text style={{
          fontSize: 28,
          fontWeight: '900',
          color: COLORS.text,
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: 2,
          marginBottom: 12,
          textShadowColor: COLORS.glowBlue,
          textShadowRadius: 8
        }}>PATAK</Text>
        <Text style={{
          fontSize: 13,
          color: COLORS.glowBlue,
          textAlign: 'center',
          lineHeight: 18,
          marginBottom: 32,
          fontWeight: '500',
          letterSpacing: 0.3,
        }}>IoT-based water monitoring and automated billing system</Text>
        
        <TextInput
          placeholder="Username"
          placeholderTextColor={COLORS.glowBlue}
          value={username}
          onChangeText={setUsername}
          style={{
            borderWidth: 1,
            borderColor: COLORS.glowBlue,
            padding: 14,
            borderRadius: 12,
            marginBottom: 12,
            backgroundColor: 'rgba(0, 180, 255, 0.08)',
            color: COLORS.text,
            fontSize: 16,
            fontWeight: '500',
            shadowColor: COLORS.glowBlue,
            shadowOpacity: 0.2,
            shadowRadius: 4
          }}
          autoCapitalize="none"
        />
        
        <TextInput
          placeholder="Password"
          placeholderTextColor={COLORS.glowBlue}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={{
            borderWidth: 1,
            borderColor: COLORS.glowBlue,
            padding: 14,
            paddingRight: 50,
            borderRadius: 12,
            marginBottom: 20,
            backgroundColor: 'rgba(0, 180, 255, 0.08)',
            color: COLORS.text,
            fontSize: 16,
            fontWeight: '500',
            shadowColor: COLORS.glowBlue,
            shadowOpacity: 0.2,
            shadowRadius: 4
          }}
          autoCapitalize="none"
        />
        
        <TouchableOpacity 
          onPress={() => setShowPassword(!showPassword)}
          style={{
            position: 'absolute',
            right: 60,
            top: 215,
            paddingHorizontal: 12,
            paddingVertical: 14
          }}>
          <Text style={{ fontSize: 18 }}>
            {showPassword ? '👁️' : '👁️‍🗨️'}
          </Text>
        </TouchableOpacity>

        {error ? (
          <Text style={{
            color: COLORS.danger,
            marginBottom: 16,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: '600',
          }}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          style={{
            backgroundColor: COLORS.glowBlue,
            paddingVertical: 14,
            borderRadius: 12,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: COLORS.glowBlue,
            shadowColor: COLORS.glowBlue,
            shadowOpacity: 0.7,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={{
            color: COLORS.onPrimary,
            textAlign: 'center',
            fontWeight: '800',
            fontSize: 16,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}>
            {loading ? 'Logging in...' : 'Login'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onShowRegister}>
          <Text style={{
            color: COLORS.glowBlue,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: '600',
          }}>
            Don't have an account? Register
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
