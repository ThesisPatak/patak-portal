import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Linking } from 'react-native';
import styles from './styles';
import { COLORS, SPACING, TYPO } from './variables';

export default function PayScreen({ payInfo, token, username, onBack, onPaymentSuccess }) {
  const amount = payInfo?.amount ?? 0;
  const house = payInfo?.house ?? username ?? 'Account';
  const billingMonth = payInfo?.billingMonth || new Date().getMonth() + 1;
  const billingYear = payInfo?.billingYear || new Date().getFullYear();
  const [loading, setLoading] = useState(false);
  const [gcashNumber, setGcashNumber] = useState(null);
  const [gcashName, setGcashName] = useState('Admin Account');
  const [gcashLoading, setGcashLoading] = useState(true);
  const [referenceNumber] = useState(`REF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);

  // Month names for display
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const billingPeriod = `${monthNames[billingMonth - 1]} ${billingYear}`;

  // Fetch GCash number from server
  React.useEffect(() => {
    const fetchGcashNumber = async () => {
      try {
        const response = await fetch('https://patak-portal-production.up.railway.app/api/config/gcash');
        const data = await response.json();
        if (data.gcash.configured) {
          setGcashNumber(data.gcash.displayNumber || data.gcash.number);
          setGcashName(data.gcash.displayName || 'Admin Account');
        }
      } catch (err) {
        console.error('Failed to fetch GCash number:', err);
      } finally {
        setGcashLoading(false);
      }
    };
    fetchGcashNumber();
  }, []);

  // Handle GCash manual payment
  const handleGCashPayment = async () => {
    try {
      setLoading(true);

      const response = await fetch('https://patak-portal-production.up.railway.app/api/gcash/submit-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Number(amount),
          billingMonth: billingMonth,
          billingYear: billingYear,
          referenceNumber: referenceNumber,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          '✓ Payment Submitted',
          `Amount: ₱${Number(amount).toFixed(2)}\nReference: ${referenceNumber}\n\nYour payment is pending verification. The admin will confirm it shortly.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setLoading(false);
                onBack();
                if (onPaymentSuccess) onPaymentSuccess();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', data.error || 'Failed to submit payment');
        setLoading(false);
      }
    } catch (err) {
      console.error('Payment submission error:', err);
      Alert.alert('Error', 'Failed to submit payment: ' + err.message);
      setLoading(false);
    }
  };

  const handleCopyReference = () => {
    // Note: React Native doesn't have direct clipboard in Expo, but this can be enhanced with expo-clipboard
    Alert.alert('Reference Number', referenceNumber, [
      {
        text: 'Close',
        onPress: () => {},
      },
    ]);
  };

  // Handle manual GCash payment
  const handleManualGCashPayment = async () => {
    try {
      setLoading(true);

      const response = await fetch('https://patak-portal-production.up.railway.app/api/gcash/submit-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Number(amount),
          billingMonth: billingMonth,
          billingYear: billingYear,
          referenceNumber: referenceNumber,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          '✓ Payment Submitted',
          `Amount: ₱${Number(amount).toFixed(2)}\nReference: ${referenceNumber}\n\nYour payment is pending verification. The admin will confirm it shortly.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setLoading(false);
                onBack();
                if (onPaymentSuccess) onPaymentSuccess();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', data.error || 'Failed to submit payment');
        setLoading(false);
      }
    } catch (err) {
      console.error('Payment submission error:', err);
      Alert.alert('Error', 'Failed to submit payment: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ padding: SPACING.base, paddingTop: SPACING.large }}>
        {/* Header with Back Button */}
        <TouchableOpacity onPress={onBack} style={[styles.secondaryButton, { alignSelf: 'flex-start', marginBottom: SPACING.base }]}>
          <Text style={styles.secondaryButtonText}>← Back</Text>
        </TouchableOpacity>

        {/* GCash Logo & Branding Section */}
        <View style={{ alignItems: 'center', marginBottom: SPACING.large, paddingVertical: SPACING.base }}>
          <Text style={{ fontSize: TYPO.bodySize + 2, fontWeight: '700', color: '#0066CC', marginBottom: SPACING.small }}>
            💙 GCash Payment
          </Text>
          <Text style={{ fontSize: TYPO.smallSize, color: '#666', textAlign: 'center' }}>
            Fast • Secure • Instant Confirmation
          </Text>
        </View>

        {/* GCash Number Section */}
        {!gcashLoading && gcashNumber && (
          <View style={[styles.card, { backgroundColor: '#f0fff4', borderLeftWidth: 4, borderLeftColor: '#059669', marginBottom: SPACING.base }]}>
            <Text style={{ fontSize: TYPO.smallSize, color: '#666', marginBottom: SPACING.small }}>SEND TO</Text>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#059669', fontFamily: 'monospace', letterSpacing: 2 }}>
              {gcashNumber}
            </Text>
            <Text style={{ fontSize: TYPO.smallSize, color: '#666', marginTop: SPACING.small, fontWeight: '600' }}>
              {gcashName}
            </Text>
          </View>
        )}

        {/* Bill Summary Card */}
        <View style={[styles.card, { backgroundColor: '#f8fbff', borderLeftWidth: 4, borderLeftColor: '#0066CC', marginBottom: SPACING.base }]}>
          <View style={{ marginBottom: SPACING.base }}>
            <Text style={{ fontSize: TYPO.smallSize, color: '#666', marginBottom: SPACING.small }}>ACCOUNT</Text>
            <Text style={{ fontWeight: '800', color: COLORS.glowBlue, fontSize: TYPO.bodySize + 2, marginBottom: SPACING.base }}>
              {house}
            </Text>
          </View>

          <View style={{ marginBottom: SPACING.base }}>
            <Text style={{ fontSize: TYPO.smallSize, color: '#666', marginBottom: SPACING.small }}>BILLING PERIOD</Text>
            <Text style={{ fontWeight: '600', color: COLORS.text, fontSize: TYPO.bodySize }}>
              {billingPeriod}
            </Text>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: SPACING.base }}>
            <Text style={{ fontSize: TYPO.smallSize, color: '#666', marginBottom: SPACING.small }}>AMOUNT DUE</Text>
            <Text style={{ fontSize: 32, fontWeight: '900', color: '#0066CC' }}>₱{Number(amount).toFixed(2)}</Text>
          </View>
        </View>

        {/* Transaction Breakdown */}
        <View style={[styles.card, { marginBottom: SPACING.base }]}>
          <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.base }}>
            💰 Payment Breakdown
          </Text>
          <View style={{ marginBottom: SPACING.small }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.small }}>
              <Text style={{ color: '#666', fontSize: TYPO.smallSize }}>Water Bill Amount</Text>
              <Text style={{ color: COLORS.text, fontWeight: '600', fontSize: TYPO.smallSize }}>₱{Number(amount).toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.small }}>
              <Text style={{ color: '#666', fontSize: TYPO.smallSize }}>Processing Fee</Text>
              <Text style={{ color: COLORS.text, fontWeight: '600', fontSize: TYPO.smallSize }}>₱0.00</Text>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: '#ddd', paddingTopWidth: SPACING.small, marginTop: SPACING.small, paddingTop: SPACING.small }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#0066CC', fontWeight: '800', fontSize: TYPO.bodySize }}>Total to Pay</Text>
                <Text style={{ color: '#0066CC', fontWeight: '800', fontSize: TYPO.bodySize }}>₱{Number(amount).toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Primary Payment Button */}
        <TouchableOpacity 
          onPress={handleGCashPayment}
          disabled={loading}
          style={[
            styles.primaryButton, 
            { 
              opacity: loading ? 0.6 : 1, 
              width: '100%',
              backgroundColor: '#0066CC',
              paddingVertical: SPACING.base + 4,
              marginBottom: SPACING.base,
            }
          ]}
        >
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color="white" style={{ marginRight: SPACING.small }} />
              <Text style={[styles.primaryButtonText]}>Processing...</Text>
            </View>
          ) : (
            <Text style={[styles.primaryButtonText, { fontSize: TYPO.bodySize + 1 }]}>
              💙 Send ₱{Number(amount).toFixed(2)} via GCash
            </Text>
          )}
        </TouchableOpacity>

        {/* Step-by-Step Instructions */}
        <View style={[styles.card, { backgroundColor: '#f5f5f5', marginBottom: SPACING.base }]}>
          <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.base }}>
            📋 Payment Steps
          </Text>
          
          <View style={{ marginBottom: SPACING.base }}>
            <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                <Text style={{ color: 'white', fontWeight: '800', fontSize: TYPO.bodySize }}>1</Text>
              </View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '600', color: COLORS.text, fontSize: TYPO.smallSize }}>Tap Payment Button</Text>
                <Text style={{ color: '#666', fontSize: TYPO.smallSize - 2 }}>Click "Send via GCash" button above</Text>
              </View>
            </View>

            <View style={{ marginBottom: SPACING.small }}>
              <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                  <Text style={{ color: 'white', fontWeight: '800', fontSize: TYPO.bodySize }}>2</Text>
                </View>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Text style={{ fontWeight: '600', color: COLORS.text, fontSize: TYPO.smallSize }}>Open GCash App</Text>
                  <Text style={{ color: '#666', fontSize: TYPO.smallSize - 2 }}>Send to admin's GCash account</Text>
                </View>
              </View>

              <View style={{ marginBottom: SPACING.small }}>
                <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: TYPO.bodySize }}>3</Text>
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={{ fontWeight: '600', color: COLORS.text, fontSize: TYPO.smallSize }}>Use Reference Number</Text>
                    <Text style={{ color: '#666', fontSize: TYPO.smallSize - 2 }}>Include reference in GCash notes</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: TYPO.bodySize }}>4</Text>
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={{ fontWeight: '600', color: COLORS.text, fontSize: TYPO.smallSize }}>Admin Confirms</Text>
                    <Text style={{ color: '#666', fontSize: TYPO.smallSize - 2 }}>Payment verified in your account</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Security & Trust Section */}
        <View style={[styles.card, { backgroundColor: '#f0fff4', marginBottom: SPACING.large }]}>
          <Text style={{ fontSize: TYPO.bodySize - 2, fontWeight: '700', color: '#059669', marginBottom: SPACING.base }}>
            🔒 Secure Payment
          </Text>
          <View style={{ marginBottom: SPACING.small }}>
            <Text style={{ fontSize: TYPO.smallSize, color: '#666', marginBottom: SPACING.small }}>
              ✓ PCI-DSS Compliant • 256-bit Encryption • Verified Merchant
            </Text>
          </View>
          <Text style={{ fontSize: TYPO.smallSize - 2, color: '#666', lineHeight: 18 }}>
            Your payment is protected by industry-standard security. Your GCash account will not be charged until payment is successfully processed.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
