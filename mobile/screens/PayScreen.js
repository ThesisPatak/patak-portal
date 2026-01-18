import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Linking } from 'react-native';
import styles from './styles';
import { COLORS, SPACING, TYPO } from './variables';

export default function PayScreen({ payInfo, token, username, onBack, onPaymentSuccess }) {
  const amount = payInfo?.amount ?? 0;
  const house = payInfo?.house ?? 'Unnamed';
  const [loading, setLoading] = useState(false);

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
          billingMonth: payInfo?.billingMonth || new Date().getMonth() + 1,
          billingYear: payInfo?.billingYear || new Date().getFullYear(),
          description: `Water bill for ${house}`
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('PayMongo checkout URL:', data.checkoutUrl);
        
        // Open PayMongo checkout
        await Linking.openURL(data.checkoutUrl);
        
        Alert.alert(
          'Payment Redirected',
          'You will be redirected to PayMongo to complete your payment. Please complete the transaction.',
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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ padding: SPACING.base, paddingTop: SPACING.large }}>
        <TouchableOpacity onPress={onBack} style={[styles.secondaryButton, { alignSelf: 'flex-start', marginBottom: SPACING.small }]}>
          <Text style={styles.secondaryButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={[styles.card, { alignItems: 'center' }]}>
          <Text style={{ fontWeight: '800', color: COLORS.glowBlue, fontSize: TYPO.subtitleSize + 3 }}>{house}</Text>
          <Text style={[styles.subtitle, { marginTop: SPACING.base }]}>Amount Due</Text>
          <Text style={{ fontSize: TYPO.bodySize + 8, fontWeight: '900', color: COLORS.glowBlue, marginTop: SPACING.small }}>₱{Number(amount).toFixed(2)}</Text>

          <View style={{ height: SPACING.base * 2 }} />

          {/* PayMongo Payment Info */}
          <View style={{ width: '100%', padding: SPACING.base, backgroundColor: '#f0f7ff', borderRadius: 12, marginVertical: SPACING.base }}>
            <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: COLORS.glowBlue, textAlign: 'center', marginBottom: SPACING.small }}>
              💳 Secure Payment via PayMongo
            </Text>
            <Text style={{ fontSize: TYPO.bodySize - 2, color: '#666', textAlign: 'center', marginBottom: SPACING.base }}>
              Pay securely with your GCash or Credit Card
            </Text>
            <Text style={{ fontSize: TYPO.smallSize, color: '#666', textAlign: 'center', fontStyle: 'italic' }}>
              Instant confirmation • Encrypted payment • PCI-DSS compliant
            </Text>
          </View>

          <View style={{ height: SPACING.base }} />
          
          {/* Payment Button - PayMongo */}
          <TouchableOpacity 
            onPress={handlePayMongoPayment}
            disabled={loading}
            style={[styles.primaryButton, { opacity: loading ? 0.6 : 1, width: '100%' }]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={[styles.primaryButtonText]}>
                💳 Pay Now with GCash/Card
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: SPACING.large }} />
          
          {/* Instructions */}
          <View style={[styles.card, { backgroundColor: '#f5f5f5', marginTop: SPACING.base }]}>
            <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.small }}>
              📱 How to Pay
            </Text>
            <Text style={{ fontSize: TYPO.smallSize, color: COLORS.text, lineHeight: 22 }}>
              1. Tap "Pay Now with GCash/Card"{'\n'}
              2. You'll be redirected to PayMongo{'\n'}
              3. Select your payment method{'\n'}
              4. Complete the payment{'\n'}
              5. Payment will be confirmed automatically
            </Text>
          </View>

          <View style={{ height: SPACING.small }} />
          <Text style={[styles.subtitle, { color: COLORS.muted, marginTop: SPACING.base, textAlign: 'center' }]}>
            Your payment of ₱{Number(amount).toFixed(2)} will be securely processed.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
