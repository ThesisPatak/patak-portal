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
        const url = await Api.getServerUrl();
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
        onLogin(data.token);
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
    <View style={styles.center}>
      <View style={[styles.card, { width: '100%', maxWidth: 420, minHeight: 420, justifyContent: 'center', paddingVertical: 44, marginTop: -20 }]}>
        <Text style={[styles.title, { textAlign: 'center', textTransform: 'uppercase' }]}>Welcome to PATAK</Text>
        <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 12, lineHeight: 20, marginBottom: 24 }]}>A modern IoT-based water consumption and billing system. This portal enables suppliers to monitor water usage, manage automated billing, and provide actionable insights for efficient and sustainable water management.</Text>
        <TextInput
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          style={[styles.input, { marginTop: 24 }]}
          autoCapitalize="none"
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={[styles.input, { marginTop: 12 }]}
          autoCapitalize="none"
        />


        {error ? <Text style={{ color: COLORS.danger, marginBottom: 8 }}>{error}</Text> : null}

        <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? 'Logging in...' : 'Login'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onShowRegister} style={{ marginTop: 16 }}>
          <Text style={{ color: COLORS.primary, textAlign: 'center' }}>Don't have an account? Register</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
