import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Dimensions, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS } from './variables';

const { width, height } = Dimensions.get('window');

export default function RegisterScreen({ onRegister, onBack }) {
  useEffect(() => {
    StatusBar.setBackgroundColor('#0a1628', true);
    StatusBar.setBarStyle('light-content');
  }, []);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    setError('');
    if (!username) return setError('Please enter a username');
    if (!password) return setError('Please enter a password');
    setLoading(true);
    try {
      const serverUrl = await Api.getServerUrl();
      console.log('Registering at Railway production:', serverUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Request timeout triggered');
        controller.abort();
      }, 30000);
      
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
      style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{
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
        elevation: 10,
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: titleFontSize,
          fontWeight: '900',
          color: COLORS.text,
          marginBottom: 18,
          letterSpacing: 1,
          textTransform: 'uppercase',
          textShadowColor: COLORS.glowGreen,
          textShadowRadius: 8
        }}>Register</Text>
        <Text style={{
          fontSize: 13,
          color: COLORS.glowGreen,
          textAlign: 'center',
          marginBottom: 24,
          fontWeight: '500',
          lineHeight: 18,
        }}>Create your account</Text>
        
        <TextInput
          placeholder="Username"
          placeholderTextColor={COLORS.glowGreen}
          style={{
            borderWidth: 1,
            borderColor: COLORS.glowGreen,
            padding: 14,
            borderRadius: 12,
            width: '100%',
            marginBottom: 12,
            backgroundColor: 'rgba(0, 255, 136, 0.08)',
            fontSize: 16,
            color: COLORS.text,
            fontWeight: '500',
            shadowColor: COLORS.glowGreen,
            shadowOpacity: 0.2,
            shadowRadius: 4
          }}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        
        <View style={{ position: 'relative', marginBottom: 20 }}>
          <TextInput
            placeholder="Password"
            placeholderTextColor={COLORS.glowGreen}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            style={{
              borderWidth: 1,
              borderColor: COLORS.glowGreen,
              padding: 14,
              paddingRight: 50,
              borderRadius: 12,
              width: '100%',
              backgroundColor: 'rgba(0, 255, 136, 0.08)',
              fontSize: 16,
              color: COLORS.text,
              fontWeight: '500',
              shadowColor: COLORS.glowGreen,
              shadowOpacity: 0.2,
              shadowRadius: 4
            }}
            autoCapitalize="none"
          />
          
          <TouchableOpacity 
            onPress={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: 14,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              width: 40,
              alignItems: 'center'
            }}>
            <View style={{
              width: 24,
              height: 24,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <View style={{
                width: 20,
                height: 12,
                borderWidth: 1.5,
                borderColor: '#666',
                borderRadius: 6,
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <View style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#666'
                }} />
              </View>
              {!showPassword && (
                <View style={{
                  position: 'absolute',
                  width: 24,
                  height: 1.5,
                  backgroundColor: '#666',
                  transform: [{ rotate: '-45deg' }]
                }} />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {error ? (
          <Text style={{
            color: COLORS.danger,
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
            backgroundColor: COLORS.glowGreen,
            paddingVertical: buttonHeight * 0.4,
            borderRadius: 12,
            width: '100%',
            alignItems: 'center',
            marginBottom: 12,
            borderWidth: 1,
            borderColor: COLORS.glowGreen,
            shadowColor: COLORS.glowGreen,
            shadowOpacity: 0.7,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={{
            fontSize: inputFontSize,
            fontWeight: '800',
            color: COLORS.onPrimary,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}>
            {loading ? 'Registering...' : 'Register'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onBack}>
          <Text style={{
            color: COLORS.glowGreen,
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
