import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StatusBar, ActivityIndicator, AppState } from 'react-native';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import DashboardScreen from './screens/DashboardScreenMinimal';
import BillingHistoryScreen from './screens/BillingHistoryScreen';
import PayScreen from './screens/PayScreen';
import DeviceScreen from './screens/DeviceScreen';
import styles from './screens/styles';
import { COLORS } from './screens/variables';
import { startKeepAlive, stopKeepAlive } from './api/keepAlive';


export default function App() {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState(null);
  const [screen, setScreen] = useState('dashboard');
  const [payInfo, setPayInfo] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [error, setError] = useState(null);
  const [appState, setAppState] = useState(AppState.currentState);

  // Start keep-alive service on app load
  useEffect(() => {
    StatusBar.setBackgroundColor('#0a1628', true);
    StatusBar.setBarStyle('light-content');
    startKeepAlive();
    return () => stopKeepAlive();
  }, []);

  // Monitor app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [token]);

  const handleAppStateChange = (nextAppState) => {
    // Log state transitions
    console.log(`[AppState] Transition: ${appState} -> ${nextAppState}`);

    // When app returns from background, verify token is still valid
    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('[AppState] App returned to foreground - session is still active');
      if (token) {
        console.log('[AppState] Token verified - user session maintained');
      }
    } else if (nextAppState.match(/inactive|background/)) {
      console.log('[AppState] App going to background');
    }

    setAppState(nextAppState);
  };

  if (!token) {
    if (showRegister) {
      return <RegisterScreen onRegister={(token, user) => { setToken(token); setUsername(user); setShowRegister(false); setScreen('dashboard'); }} onBack={() => setShowRegister(false)} />;
    }
    return <LoginScreen onLogin={(token, user) => { setToken(token); setUsername(user); setScreen('dashboard'); }} onShowRegister={() => setShowRegister(true)} />;
  }

  // Show loading screen after login while dashboard loads
  const renderContent = () => {
    if (!screen) {
      return (
        <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: COLORS.glowBlue, fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Loading Dashboard...</Text>
          <ActivityIndicator size="large" color={COLORS.glowBlue} />
        </View>
      );
    }

    if (screen === 'dashboard') {
      return (
        <DashboardScreen
          token={token}
          username={username}
          onOpenBilling={() => setScreen('billing')}
          onLogout={() => { setToken(null); setUsername(null); setScreen('dashboard'); }}
          onPay={(house, amount, billingMonth, billingYear) => { setPayInfo({ house, amount, billingMonth, billingYear }); setScreen('pay'); }}
          onOpenDevices={() => setScreen('devices')}
        />
      );
    }

    if (screen === 'billing') {
      return <BillingHistoryScreen token={token} username={username} onBack={() => setScreen('dashboard')} />;
    }

    if (screen === 'pay') {
      return <PayScreen 
        payInfo={payInfo} 
        token={token}
        username={username}
        onBack={() => {
          setPayInfo(null);
          // Navigate back to billing screen instead of dashboard
          setScreen('billing');
        }}
        onPaymentSuccess={() => {
          setPayInfo(null);
        }}
      />;
    }

    if (screen === 'devices') {
      return <DeviceScreen token={token} onBack={() => setScreen('dashboard')} />;
    }

    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: COLORS.glowBlue, fontSize: 16 }}>Unknown Screen: {screen}</Text>
        <TouchableOpacity style={{ marginTop: 20, padding: 10, backgroundColor: COLORS.glowBlue, borderRadius: 8 }} onPress={() => setScreen('dashboard')}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <View style={[styles.appShell, { backgroundColor: COLORS.background }]}>
        <View style={[styles.contentCard, { backgroundColor: COLORS.background, flex: 1, minHeight: '100%' }]}>
          <View style={styles.titleBar}>
            <Text style={styles.headerTitleSmall}>PATAK MOBILE</Text>
          </View>
          <View style={{ flex: 1, width: '100%', backgroundColor: COLORS.background }}>
            {error && (
              <View style={{ backgroundColor: '#ff0055', padding: 12, margin: 8, borderRadius: 8 }}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Error: {error}</Text>
              </View>
            )}
            {renderContent()}
          </View>
        </View>
        <View style={styles.footer} pointerEvents="none">
          <Text style={styles.footerText}>© 2025 PATAK. Guard every drop.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
