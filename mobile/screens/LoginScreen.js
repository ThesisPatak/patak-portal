import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import Api from '../api/Api';
import styles from './styles';
import { COLORS } from './variables';

export default function LoginScreen({ onLogin, onShowRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(true);

  // Auto-detect server on component mount
  useEffect(() => {
    const detectServer = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const url = await Api.getServerUrl();
        clearTimeout(timeoutId);
        setServerUrl(url);
      } catch (e) {
        setError('Could not auto-detect server. Check if backend is running.');
      } finally {
        setDetecting(false);
      }
    };
    detectServer();
  }, []);

  const handleLogin = async () => {
    setError('');
    if (!username) return setError('Please enter a username');
    if (!password) return setError('Please enter a password');
    setLoading(true);
    try {
      const data = await Api.login(username, password, serverUrl || undefined);
      if (data && data.token) {
        console.log('Login success, token=', data.token);
        onLogin(data.token, username);
      } else setError('Invalid credentials');
    } catch (e) {
      if (e.status === 401) {
        setError('Wrong password');
      } else if (e.message && e.message.includes('fetch')) {
        setError('Cannot reach server. Check server URL.');
      } else {
        setError('Network error — check server connection');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f1419', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
      <View style={{
        backgroundColor: '#1a2332',
        borderRadius: 24,
        padding: 36,
        width: '100%',
        maxWidth: 420,
        minHeight: 480,
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#3498db',
        shadowColor: '#3498db',
        shadowOpacity: 0.5,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      }}>
        <Text style={{
          fontSize: 28,
          fontWeight: '900',
          color: '#ffffff',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: 2,
          marginBottom: 12,
        }}>PATAK</Text>
        <Text style={{
          fontSize: 13,
          color: '#64B5F6',
          textAlign: 'center',
          lineHeight: 18,
          marginBottom: 32,
          fontWeight: '500',
          letterSpacing: 0.3,
        }}>IoT-based water monitoring and automated billing system</Text>
        
        <TextInput
          placeholder="Username"
          placeholderTextColor="#64B5F6"
          value={username}
          onChangeText={setUsername}
          style={{
            borderWidth: 1,
            borderColor: '#42A5F5',
            padding: 14,
            borderRadius: 12,
            marginBottom: 12,
            backgroundColor: 'rgba(52, 152, 219, 0.05)',
            color: '#ffffff',
            fontSize: 16,
            fontWeight: '500',
          }}
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
            padding: 14,
            borderRadius: 12,
            marginBottom: 20,
            backgroundColor: 'rgba(52, 152, 219, 0.05)',
            color: '#ffffff',
            fontSize: 16,
            fontWeight: '500',
          }}
          autoCapitalize="none"
        />

        {error ? (
          <Text style={{
            color: '#FF6B6B',
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
            backgroundColor: '#3498db',
            paddingVertical: 14,
            borderRadius: 12,
            marginBottom: 16,
            shadowColor: '#3498db',
            shadowOpacity: 0.6,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={{
            color: '#fff',
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
            color: '#64B5F6',
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
