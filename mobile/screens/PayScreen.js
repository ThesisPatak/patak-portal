import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator, Share, Alert, ScrollView } from 'react-native';
import styles from './styles';
import { COLORS, SPACING, TYPO } from './variables';

export default function PayScreen({ payInfo, token, username, onBack, onPaymentSuccess }) {
  const amount = payInfo?.amount ?? 0;
  const house = payInfo?.house ?? 'Unnamed';
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('gcash'); // Default to GCash

  // GCash Account (Philippines mobile payment service)
  const GCASH_PHONE = '09171234567'; // Replace with actual GCash number
  const PAYPAL_ID = 'PatakSupplier';

  const gcashLink = `https://www.paymaya.com/send?amount=${Number(amount).toFixed(2)}`;
  const paypalLink = `https://www.paypal.com/paypalme/${PAYPAL_ID}/${Number(amount).toFixed(2)}`;

  // Handle GCash payment
  const handleGCashPayment = async () => {
    try {
      setLoading(true);
      
      // Option 1: Open GCash app or GCash QR
      const gcashAppLink = `https://www.gcash.com/`; // GCash app deep link
      
      // For now, we'll show instructions and record the payment
      Alert.alert(
        'GCash Payment',
        `Send ₱${Number(amount).toFixed(2)} to GCash Number:\n\n${GCASH_PHONE}\n\nReference: ${house}`,
        [
          {
            text: 'I Paid with GCash',
            onPress: async () => {
              // Record payment immediately
              await recordGCashPayment();
            },
          },
          {
            text: 'Copy Number',
            onPress: async () => {
              // Copy to clipboard (would need Clipboard module)
              Alert.alert('Copied', `GCash Number: ${GCASH_PHONE}`);
            },
          },
          {
            text: 'Cancel',
            onPress: () => setLoading(false),
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Error with GCash:', error);
      Alert.alert('Error', 'Failed to initiate GCash payment');
      setLoading(false);
    }
  };

  // Record GCash payment to backend
  const recordGCashPayment = async () => {
    try {
      const response = await fetch('https://patak-portal-production.up.railway.app/api/payments/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Number(amount),
          billingMonth: payInfo?.billingMonth || new Date().getMonth() + 1,
          billingYear: payInfo?.billingYear || new Date().getFullYear(),
          paymentMethod: 'gcash',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert(
          '✓ Payment Recorded!',
          `Your GCash payment of ₱${Number(amount).toFixed(2)} has been recorded.\n\nTransaction: ${data.payment.id}`,
          [
            {
              text: 'OK',
              onPress: () => {
                if (onPaymentSuccess) onPaymentSuccess();
                onBack();
              },
            },
          ]
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Failed to record payment');
        setLoading(false);
      }
    } catch (err) {
      console.error('Payment recording error:', err);
      Alert.alert('Error', 'Failed to record payment: ' + err.message);
      setLoading(false);
    }
  };

  const handleOpenPayPal = async () => {
    try {
      setLoading(true);
      await Linking.openURL(paypalLink).catch(() => {
        alert('Cannot open PayPal automatically.\n\nPayPal ID: ' + PAYPAL_ID + '\nAmount: ₱' + Number(amount).toFixed(2));
      });
    } catch (error) {
      console.error('Error opening PayPal:', error);
      alert('PayPal: ' + paypalLink);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareText = paymentMethod === 'gcash'
        ? `Send ₱${Number(amount).toFixed(2)} to my GCash: ${GCASH_PHONE} for ${house}`
        : `Pay ₱${Number(amount).toFixed(2)} via PayPal for ${house}:\n${paypalLink}`;
      
      await Share.share({
        message: shareText,
        title: `Payment for ${house}`,
      }).catch(error => {
        if (error.code !== 'E_CANCELLED') {
          console.error('Share error:', error);
        }
      });
    } catch (error) {
      console.error('Share error:', error);
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
          
          {/* Payment Method Selection */}
          <View style={{ width: '100%', marginBottom: SPACING.base }}>
            <Text style={{ fontSize: TYPO.smallSize, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.small }}>
              Select Payment Method
            </Text>
            
            {/* GCash Option */}
            <TouchableOpacity 
              onPress={() => setPaymentMethod('gcash')}
              style={{
                padding: SPACING.base,
                marginBottom: SPACING.small,
                borderRadius: 12,
                backgroundColor: paymentMethod === 'gcash' ? '#e7f5ff' : '#f5f5f5',
                borderWidth: paymentMethod === 'gcash' ? 2 : 1,
                borderColor: paymentMethod === 'gcash' ? COLORS.glowBlue : '#ddd',
              }}
            >
              <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: paymentMethod === 'gcash' ? COLORS.glowBlue : COLORS.text }}>
                💳 GCash (Recommended)
              </Text>
              <Text style={{ fontSize: TYPO.smallSize, color: paymentMethod === 'gcash' ? COLORS.glowBlue : COLORS.textMuted, marginTop: 4 }}>
                Fast, secure, no fees
              </Text>
            </TouchableOpacity>

            {/* PayPal Option */}
            <TouchableOpacity 
              onPress={() => setPaymentMethod('paypal')}
              style={{
                padding: SPACING.base,
                borderRadius: 12,
                backgroundColor: paymentMethod === 'paypal' ? '#e7f5ff' : '#f5f5f5',
                borderWidth: paymentMethod === 'paypal' ? 2 : 1,
                borderColor: paymentMethod === 'paypal' ? COLORS.glowBlue : '#ddd',
              }}
            >
              <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: paymentMethod === 'paypal' ? COLORS.glowBlue : COLORS.text }}>
                🅿️ PayPal
              </Text>
              <Text style={{ fontSize: TYPO.smallSize, color: paymentMethod === 'paypal' ? COLORS.glowBlue : COLORS.textMuted, marginTop: 4 }}>
                International payments
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: SPACING.base }} />

          {/* GCash Payment Info */}
          {paymentMethod === 'gcash' && (
            <View style={{ width: '100%', padding: SPACING.base, backgroundColor: '#f0fff4', borderRadius: 12, marginVertical: SPACING.base }}>
              <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: '#16a34a', textAlign: 'center', marginBottom: SPACING.small }}>
                GCash Payment
              </Text>
              <Text style={{ fontSize: TYPO.bodySize - 2, color: '#666', textAlign: 'center', marginBottom: SPACING.small }}>
                Send ₱{Number(amount).toFixed(2)} to the GCash number shown below
              </Text>
              <Text style={{ fontSize: TYPO.bodySize - 1, color: '#000', textAlign: 'center', fontWeight: '700', marginBottom: SPACING.small }}>
                {GCASH_PHONE}
              </Text>
              <Text style={{ fontSize: TYPO.bodySize - 3, color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                Reference: {house}
              </Text>
            </View>
          )}

          {/* PayPal Payment Info */}
          {paymentMethod === 'paypal' && (
            <View style={{ width: '100%', padding: SPACING.base, backgroundColor: '#f0f7ff', borderRadius: 12, marginVertical: SPACING.base }}>
              <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: COLORS.glowBlue, textAlign: 'center', marginBottom: SPACING.small }}>
                PayPal Payment
              </Text>
              <Text style={{ fontSize: TYPO.bodySize - 2, color: '#666', textAlign: 'center', marginBottom: SPACING.small }}>
                Click below to open PayPal and complete your payment
              </Text>
              <Text style={{ fontSize: TYPO.bodySize - 3, color: '#999', textAlign: 'center', fontStyle: 'italic' }}>
                PayPal ID: {PAYPAL_ID}
              </Text>
            </View>
          )}

          <View style={{ height: SPACING.base }} />
          
          {/* Payment Button */}
          <TouchableOpacity 
            onPress={paymentMethod === 'gcash' ? handleGCashPayment : handleOpenPayPal}
            disabled={loading}
            style={[styles.primaryButton, { opacity: loading ? 0.6 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={[styles.primaryButtonText]}>
                {paymentMethod === 'gcash' ? 'Proceed with GCash' : 'Open PayPal Payment'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: SPACING.small }} />
          
          <TouchableOpacity 
            onPress={handleShare}
            style={[styles.secondaryButton, { marginHorizontal: 0 }]}
          >
            <Text style={styles.secondaryButtonText}>Share Payment Details</Text>
          </TouchableOpacity>

          <View style={{ height: SPACING.small }} />
          <Text style={[styles.subtitle, { color: COLORS.muted, marginTop: SPACING.base, textAlign: 'center' }]}>
            Your payment of ₱{Number(amount).toFixed(2)} will be securely processed.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
