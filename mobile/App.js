import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StatusBar } from 'react-native';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import DashboardScreen from './screens/DashboardScreen';
import UsageScreen from './screens/UsageScreen';
import PayScreen from './screens/PayScreen';
import DeviceScreen from './screens/DeviceScreen';
import styles from './screens/styles';
import { COLORS } from './screens/variables';
import { startKeepAlive, stopKeepAlive } from './api/keepAlive';


export default function App() {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState(null);
  const [screen, setScreen] = useState('dashboard');
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [payInfo, setPayInfo] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  // Start keep-alive service on app load
  useEffect(() => {
    StatusBar.setBackgroundColor('#0a1628', true);
    StatusBar.setBarStyle('light-content');
    startKeepAlive();
    return () => stopKeepAlive();
  }, []);

  console.log('App state token=', token, 'screen=', screen);

  if (!token) {
    if (showRegister) {
      return <RegisterScreen onRegister={(token, user) => { setToken(token); setUsername(user); setShowRegister(false); setScreen('dashboard'); }} onBack={() => setShowRegister(false)} />;
    }
    return <LoginScreen onLogin={(token, user) => { setToken(token); setUsername(user); setScreen('dashboard'); }} onShowRegister={() => setShowRegister(true)} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <View style={[styles.appShell, { backgroundColor: COLORS.background }]}>
        <View style={[styles.contentCard, { backgroundColor: COLORS.background, flex: 1, minHeight: '100%' }]}>
          <View style={styles.titleBar}>
            <Text style={styles.headerTitleSmall}>PATAK MOBILE</Text>
          </View>
          <View style={{ flex: 1, width: '100%', backgroundColor: COLORS.background }}>
            {screen === 'dashboard' && (
              <DashboardScreen
                token={token}
                username={username}
                onOpenUsage={(house) => { setSelectedHouse(house); setScreen('usage'); }}
                onLogout={() => { setToken(null); setUsername(null); }}
                onPay={(house, amount) => { setPayInfo({ house, amount }); setScreen('pay'); }}
                onOpenDevices={() => setScreen('devices')}
              />
            )}
            {screen === 'usage' && (
              <UsageScreen token={selectedHouse || token} onBack={() => setScreen('dashboard')} />
            )}
            {screen === 'pay' && (
              <PayScreen payInfo={payInfo} onBack={() => setScreen('dashboard')} />
            )}
            {screen === 'devices' && (
              <DeviceScreen token={token} onBack={() => setScreen('dashboard')} />
            )}
          </View>
        </View>
        <View style={styles.footer} pointerEvents="none">
          <Text style={styles.footerText}>© 2025 PATAK. Guard every drop.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
