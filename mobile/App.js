import React, { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity } from 'react-native';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import DashboardScreen from './screens/DashboardScreen';
import UsageScreen from './screens/UsageScreen';
import BillingScreen from './screens/BillingScreen';
import PayScreen from './screens/PayScreen';
import DeviceScreen from './screens/DeviceScreen';
import styles from './screens/styles';


export default function App() {
  const [token, setToken] = useState(null);
  const [screen, setScreen] = useState('dashboard');
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [payInfo, setPayInfo] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  console.log('App state token=', token, 'screen=', screen);

  if (!token) {
    if (showRegister) {
      return <RegisterScreen onRegister={(token) => { setToken(token); setShowRegister(false); setScreen('dashboard'); }} onBack={() => setShowRegister(false)} />;
    }
    return <LoginScreen onLogin={(token) => { setToken(token); setScreen('dashboard'); }} onShowRegister={() => setShowRegister(true)} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appShell}>
        <View style={styles.contentCard}>
          <View style={styles.titleBar}>
            <Text style={styles.headerTitleSmall}>PATAK MOBILE</Text>
          </View>
          {screen === 'dashboard' && (
            <DashboardScreen
              token={token}
              onOpenUsage={(house) => { setSelectedHouse(house); setScreen('usage'); }}
              onLogout={() => setToken(null)}
              onPay={(house, amount) => { setPayInfo({ house, amount }); setScreen('pay'); }}
              onOpenDevices={() => setScreen('devices')}
            />
          )}
          {screen === 'billing' && (
            <BillingScreen onBack={() => setScreen('dashboard')} />
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
        <View style={styles.footer} pointerEvents="none">
          <Text style={styles.footerText}>© 2025 PATAK. Guard every drop.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
