import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS } from './variables';

const { width, height } = Dimensions.get('window');

export default function RegisterScreen({ onRegister, onBack }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError('');
    if (!username) return setError('Please enter a username');
    if (!password) return setError('Please enter a password');
    setLoading(true);
    try {
      const serverUrl = await Api.getServerUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const res = await fetch(`${serverUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
      } else {
        onRegister && onRegister(data.token);
      }
    } catch (e) {
      console.error('Registration error:', e);
      if (e.name === 'AbortError') {
        setError('Server is taking too long. Please try again.');
      } else {
        setError(e.message || 'Network error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Responsive sizing
  const containerPadding = width > 400 ? 36 : 18;
  const inputFontSize = width > 400 ? 18 : 15;
  const buttonHeight = width > 400 ? 54 : 44;
  const titleFontSize = width > 400 ? 32 : 26;
  const cardWidth = width > 400 ? 400 : width - 32;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{
        backgroundColor: COLORS.cardBg,
        borderRadius: 18,
        padding: containerPadding,
        width: cardWidth,
        shadowColor: COLORS.shadow,
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: titleFontSize,
          fontWeight: 'bold',
          color: COLORS.primary,
          marginBottom: 18,
          letterSpacing: 0.5,
        }}>Register</Text>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            padding: 12,
            borderRadius: 10,
            width: '100%',
            marginBottom: 14,
            backgroundColor: COLORS.surface,
            fontSize: inputFontSize,
          }}
          placeholder="Username"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            padding: 12,
            borderRadius: 10,
            width: '100%',
            marginBottom: 14,
            backgroundColor: COLORS.surface,
            fontSize: inputFontSize,
          }}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={{ color: COLORS.danger, marginBottom: 10, fontSize: 15 }}>{error}</Text> : null}
        <TouchableOpacity
          style={{
            backgroundColor: COLORS.primary,
            borderRadius: 12,
            height: buttonHeight,
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            marginTop: 4,
            marginBottom: 6,
            shadowColor: COLORS.primary,
            shadowOpacity: 0.12,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
            opacity: loading ? 0.7 : 1,
          }}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={{ color: COLORS.onPrimary, fontWeight: '700', fontSize: inputFontSize }}>{loading ? 'Registering...' : 'Register'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack} style={{ marginTop: 10 }}>
          <Text style={{ color: COLORS.link, fontSize: 15, fontWeight: '600' }}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
