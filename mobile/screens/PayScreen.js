import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Linking } from 'react-native';
import styles from './styles';
import { COLORS, SPACING, TYPO } from './variables';

export default function PayScreen({ payInfo, token, username, onBack, onPaymentSuccess }) {
  const amount = payInfo?.amount ?? 0;
  const house = payInfo?.house ?? 'Unnamed';
  const billingMonth = payInfo?.billingMonth || new Date().getMonth() + 1;
  const billingYear = payInfo?.billingYear || new Date().getFullYear();
  const [loading, setLoading] = useState(false);
  const [referenceNumber] = useState(`REF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);

  // Month names for display
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const billingPeriod = `${monthNames[billingMonth - 1]} ${billingYear}`;

  // Create PayMongo payment link
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
        console.log('PayMongo checkout URL:', data.checkoutUrl);
        
        // Open PayMongo checkout
        await Linking.openURL(data.checkoutUrl);
        
        Alert.alert(
          'Payment Processing',
          `Reference: ${referenceNumber}\n\nYou will be redirected to PayMongo to complete your payment. Your payment will be confirmed automatically once processed.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setLoading(false);
                // Payment will be confirmed via webhook
                onBack();
              },
            },
          ]
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Failed to create payment link');
        setLoading(false);
      }
    } catch (err) {
      console.error('PayMongo error:', err);
      Alert.alert('Error', 'Failed to initiate PayMongo payment: ' + err.message);
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

        {/* Transaction Reference */}
        <View style={[styles.card, { backgroundColor: '#fff9e6', borderRadius: 12, marginBottom: SPACING.base }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: TYPO.smallSize, color: '#666', marginBottom: SPACING.small }}>REFERENCE #</Text>
              <Text style={{ fontFamily: 'monospace', fontSize: TYPO.smallSize + 1, fontWeight: '600', color: COLORS.text }}>
                {referenceNumber}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={handleCopyReference}
              style={{ padding: SPACING.small, backgroundColor: '#0066CC', borderRadius: 8 }}
            >
              <Text style={{ color: 'white', fontWeight: '600', fontSize: TYPO.smallSize }}>📋 Copy</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: TYPO.smallSize - 2, color: '#999', marginTop: SPACING.small, fontStyle: 'italic' }}>
            Use this to track your payment
          </Text>
        </View>

        {/* GCash Wallet Status */}
        <View style={[styles.card, { backgroundColor: '#e6f7ff', borderRadius: 12, marginBottom: SPACING.base }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: TYPO.bodySize - 2, fontWeight: '700', color: '#0066CC', marginBottom: SPACING.small }}>
                📱 GCash Wallet
              </Text>
              <Text style={{ fontSize: TYPO.smallSize, color: '#666', lineHeight: 20 }}>
                Please ensure your GCash wallet has sufficient balance before paying.
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={{ marginTop: SPACING.base, paddingVertical: SPACING.small, borderTopWidth: 1, borderTopColor: '#bdd9f1' }}
            onPress={() => Alert.alert('GCash', 'Open your GCash app to check balance')}
          >
            <Text style={{ color: '#0066CC', fontWeight: '600', fontSize: TYPO.smallSize, textAlign: 'center' }}>
              Check Balance in GCash App →
            </Text>
          </TouchableOpacity>
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
          onPress={handlePayMongoPayment}
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
              💳 Pay ₱{Number(amount).toFixed(2)} via GCash
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

        {/* Support Section */}
        <View style={[styles.card, { backgroundColor: '#fef3f2', marginBottom: SPACING.large }]}>
          <Text style={{ fontSize: TYPO.bodySize - 2, fontWeight: '700', color: '#dc2626', marginBottom: SPACING.base }}>
            ❓ Need Help?
          </Text>
          <Text style={{ fontSize: TYPO.smallSize, color: '#666', lineHeight: 20, marginBottom: SPACING.base }}>
            If you encounter any issues during payment, please:
          </Text>
          <Text style={{ fontSize: TYPO.smallSize, color: '#666', lineHeight: 20 }}>
            • Verify sufficient GCash balance{'\n'}
            • Check your internet connection{'\n'}
            • Contact support with Reference #{'\n'}
            <Text style={{ fontWeight: '600', fontFamily: 'monospace' }}>{referenceNumber}</Text>
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
