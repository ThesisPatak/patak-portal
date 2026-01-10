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
      console.log('Attempting registration at', serverUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Request timeout triggered');
        controller.abort();
      }, 30000); // Reduced to 30 seconds for faster feedback
      
      const startTime = Date.now();
      const res = await fetch(`${serverUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal
      });
      const elapsed = Date.now() - startTime;
      clearTimeout(timeoutId);
      
      console.log(`Registration request took ${elapsed}ms, status: ${res.status}`);
      
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
      } else {
        onRegister && onRegister(data.token, username);
      }
    } catch (e) {
      console.error('Registration error:', e);
      if (e.name === 'AbortError') {
        setError('Connection timeout. Check your internet and try again.');
      } else {
        setError(e.message || 'Network error. Please try again.');
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
      style={{ flex: 1, backgroundColor: '#0f1419', justifyContent: 'center', alignItems: 'center' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{
        backgroundColor: '#1a2332',
        borderRadius: 24,
        padding: containerPadding,
        width: cardWidth,
        borderWidth: 2,
        borderColor: '#3498db',
        shadowColor: '#3498db',
        shadowOpacity: 0.5,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: titleFontSize,
          fontWeight: '900',
          color: '#ffffff',
          marginBottom: 18,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>Register</Text>
        <Text style={{
          fontSize: 13,
          color: '#64B5F6',
          textAlign: 'center',
          marginBottom: 24,
          fontWeight: '500',
          lineHeight: 18,
        }}>Create your account</Text>
        
        <TextInput
          placeholder="Username"
          placeholderTextColor="#64B5F6"
          style={{
            borderWidth: 1,
            borderColor: '#42A5F5',
            padding: 12,
            borderRadius: 12,
            width: '100%',
            marginBottom: 12,
            backgroundColor: 'rgba(52, 152, 219, 0.05)',
            fontSize: inputFontSize,
            color: '#ffffff',
            fontWeight: '500',
          }}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        
        <TextInput
          placeholder="Password"
          placeholderTextColor="#64B5F6"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={{
            borderWidth: 1,
            borderColor: '#42A5F5',
            padding: 12,
            borderRadius: 12,
            width: '100%',
            marginBottom: 18,
            backgroundColor: 'rgba(52, 152, 219, 0.05)',
            fontSize: inputFontSize,
            color: '#ffffff',
            fontWeight: '500',
          }}
          autoCapitalize="none"
        />

        {error ? (
          <Text style={{
            color: '#FF6B6B',
            marginBottom: 12,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: '600',
          }}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          style={{
            backgroundColor: '#3498db',
            paddingVertical: buttonHeight * 0.4,
            borderRadius: 12,
            width: '100%',
            alignItems: 'center',
            marginBottom: 12,
            shadowColor: '#3498db',
            shadowOpacity: 0.6,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={{
            fontSize: inputFontSize,
            fontWeight: '800',
            color: '#fff',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}>
            {loading ? 'Registering...' : 'Register'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onBack}>
          <Text style={{
            color: '#64B5F6',
            textAlign: 'center',
            fontSize: 13,
            fontWeight: '600',
          }}>
            Already have an account? Back to Login
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
