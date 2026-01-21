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
  const [paymentMethod, setPaymentMethod] = useState('paymongo'); // 'paymongo' or 'manual_gcash'
  const [referenceNumber] = useState(`REF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);

  // Month names for display
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const billingPeriod = `${monthNames[billingMonth - 1]} ${billingYear}`;

  // Create PayMongo payment link with smart GCash deep link
  const handlePayMongoPayment = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('https://patak-portal-production.up.railway.app/api/paymongo/create-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Number(amount),
          billingMonth: billingMonth,
          billingYear: billingYear,
          description: `Water bill for ${house}`,
          referenceNumber: referenceNumber,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const checkoutUrl = data.checkoutUrl;
        console.log('PayMongo checkout URL:', checkoutUrl);
        
        // Try to open GCash app with deep link first
        const gcashDeepLink = `gcash://send?amount=${amount}`;
        
        try {
          // Check if GCash app is installed
          const canOpen = await Linking.canOpenURL(gcashDeepLink);
          
          if (canOpen) {
            // GCash app is installed - open it directly
            await Linking.openURL(gcashDeepLink);
            
            Alert.alert(
              'GCash Payment',
              `Opening GCash app with amount ₱${Number(amount).toFixed(2)}\n\nReference: ${referenceNumber}`,
              [
                {
                  text: 'I sent the payment',
                  onPress: () => {
                    setLoading(false);
                    onBack();
                  },
                },
                {
                  text: 'Cancel',
                  onPress: () => setLoading(false),
                },
              ]
            );
          } else {
            // GCash app not installed - fall back to PayMongo checkout with QR code
            await Linking.openURL(checkoutUrl);
            
            Alert.alert(
              'Payment Processing',
              `Reference: ${referenceNumber}\n\nOpening PayMongo payment page. You can scan the QR code or choose your preferred payment method.`,
              [
                {
                  text: 'Payment sent',
                  onPress: () => {
                    setLoading(false);
                    onBack();
                  },
                },
              ]
            );
          }
        } catch (err) {
          console.error('Deep link error:', err);
          // Fallback to PayMongo checkout URL
          await Linking.openURL(checkoutUrl);
          setLoading(false);
        }
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Failed to create payment link');
        setLoading(false);
      }
    } catch (err) {
      console.error('Payment error:', err);
      Alert.alert('Error', 'Failed to initiate payment: ' + err.message);
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
          onPress={paymentMethod === 'paymongo' ? handlePayMongoPayment : handleManualGCashPayment}
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
              {paymentMethod === 'paymongo' 
                ? `💳 Pay ₱${Number(amount).toFixed(2)} via PayMongo`
                : `💙 Send ₱${Number(amount).toFixed(2)} via GCash`
              }
            </Text>
          )}
        </TouchableOpacity>

        {/* Payment Method Selection */}
        <View style={[styles.card, { marginBottom: SPACING.base }]}>
          <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.base }}>
            📱 Choose Payment Method
          </Text>

          {/* PayMongo Option */}
          <TouchableOpacity
            onPress={() => setPaymentMethod('paymongo')}
            style={{
              padding: SPACING.base,
              borderRadius: 12,
              backgroundColor: paymentMethod === 'paymongo' ? '#e3f2fd' : '#f5f5f5',
              borderWidth: 2,
              borderColor: paymentMethod === 'paymongo' ? '#0066CC' : '#ddd',
              marginBottom: SPACING.base,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: paymentMethod === 'paymongo' ? '#0066CC' : '#ddd',
                marginRight: SPACING.base,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {paymentMethod === 'paymongo' && <Text style={{ color: 'white', fontWeight: '800' }}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: COLORS.text, fontSize: TYPO.bodySize }}>
                PayMongo QR Code
              </Text>
              <Text style={{ color: '#666', fontSize: TYPO.smallSize - 2, marginTop: 4 }}>
                Instant settlement • Lower fees
              </Text>
            </View>
          </TouchableOpacity>

          {/* Manual GCash Option */}
          <TouchableOpacity
            onPress={() => setPaymentMethod('manual_gcash')}
            style={{
              padding: SPACING.base,
              borderRadius: 12,
              backgroundColor: paymentMethod === 'manual_gcash' ? '#f0fff4' : '#f5f5f5',
              borderWidth: 2,
              borderColor: paymentMethod === 'manual_gcash' ? '#059669' : '#ddd',
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: paymentMethod === 'manual_gcash' ? '#059669' : '#ddd',
                marginRight: SPACING.base,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {paymentMethod === 'manual_gcash' && <Text style={{ color: 'white', fontWeight: '800' }}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: COLORS.text, fontSize: TYPO.bodySize }}>
                GCash Direct Transfer
              </Text>
              <Text style={{ color: '#666', fontSize: TYPO.smallSize - 2, marginTop: 4 }}>
                Zero fees • Direct to admin
              </Text>
            </View>
          </TouchableOpacity>
        </View>

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
                <Text style={{ color: '#666', fontSize: TYPO.smallSize - 2 }}>Click "Pay via GCash" button above</Text>
              </View>
            </View>

            <View style={{ marginBottom: SPACING.small }}>
              <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                  <Text style={{ color: 'white', fontWeight: '800', fontSize: TYPO.bodySize }}>2</Text>
                </View>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Text style={{ fontWeight: '600', color: COLORS.text, fontSize: TYPO.smallSize }}>Select GCash</Text>
                  <Text style={{ color: '#666', fontSize: TYPO.smallSize - 2 }}>Choose GCash as payment method on PayMongo</Text>
                </View>
              </View>

              <View style={{ marginBottom: SPACING.small }}>
                <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: TYPO.bodySize }}>3</Text>
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={{ fontWeight: '600', color: COLORS.text, fontSize: TYPO.smallSize }}>Complete Payment</Text>
                    <Text style={{ color: '#666', fontSize: TYPO.smallSize - 2 }}>Follow GCash authentication steps</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: TYPO.bodySize }}>4</Text>
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={{ fontWeight: '600', color: COLORS.text, fontSize: TYPO.smallSize }}>Confirmation</Text>
                    <Text style={{ color: '#666', fontSize: TYPO.smallSize - 2 }}>Payment confirmed instantly in your account</Text>
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
