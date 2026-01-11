import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../App';

const SERVER = 'https://patak-portal-production.up.railway.app'; // Production server

export default function LoginScreen() {
  const { setUser } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    if (!username || !password) return Alert.alert('Error', 'Enter username and password');
    setLoading(true);
    try {
      // validate username exists as a house
      const res = await fetch(`${SERVER}/api/houses`);
      if (!res.ok) throw new Error('Failed to reach server');
      const json = await res.json();
      const houses = Object.keys(json.summary || {});
      const uname = username.trim().toLowerCase();
      if (!houses.includes(uname)) {
        return Alert.alert('Login failed', 'Unknown house');
      }
      const user = { username: uname };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    } catch (err) {
      Alert.alert('Error', err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PATAK - Household Login</Text>
      <TextInput placeholder="Username (e.g. house1)" value={username} onChangeText={setUsername} style={styles.input} autoCapitalize="none" />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry />
      <Button title={loading ? 'Signing in...' : 'Sign in'} onPress={onLogin} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:20, justifyContent:'center' },
  title: { fontSize:18, marginBottom:16, textAlign:'center' },
  input: { borderWidth:1, borderColor:'#ddd', padding:10, marginBottom:12, borderRadius:6 }
});
