import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import styles from './styles';
import { COLORS, SPACING, TYPO } from './variables';

export default function PayScreen({ payInfo, token, username, onBack, onPaymentSuccess }) {
  const amount = payInfo?.amount ?? 0;
  const house = payInfo?.house ?? 'Unnamed';
  const [loading, setLoading] = useState(false);

  // GCash Account (Philippines mobile payment service)
  const GCASH_PHONE = '09171234567'; // Replace with actual GCash merchant number

  // Handle GCash payment
  const handleGCashPayment = async () => {
    try {
      setLoading(true);
      
      // Show GCash payment instructions
      Alert.alert(
        'GCash Payment',
        `Send ₱${Number(amount).toFixed(2)} to this GCash Number:\n\n${GCASH_PHONE}\n\nReference: ${house}`,
        [
          {
            text: 'I Paid with GCash',
            onPress: async () => {
              // Record payment
              await recordGCashPayment();
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

          {/* GCash Payment Info */}
          <View style={{ width: '100%', padding: SPACING.base, backgroundColor: '#f0fff4', borderRadius: 12, marginVertical: SPACING.base }}>
            <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: '#16a34a', textAlign: 'center', marginBottom: SPACING.small }}>
              💳 GCash Payment
            </Text>
            <Text style={{ fontSize: TYPO.bodySize - 2, color: '#666', textAlign: 'center', marginBottom: SPACING.base }}>
              Send ₱{Number(amount).toFixed(2)} to the GCash number below
            </Text>
            <View style={{ backgroundColor: '#fff', padding: SPACING.base, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: SPACING.base }}>
              <Text style={{ fontSize: TYPO.bodySize + 2, color: '#000', textAlign: 'center', fontWeight: '800', letterSpacing: 1 }}>
                {GCASH_PHONE}
              </Text>
            </View>
            <Text style={{ fontSize: TYPO.smallSize, color: '#666', textAlign: 'center', fontStyle: 'italic' }}>
              Reference: <Text style={{ fontWeight: '700' }}>{house}</Text>
            </Text>
          </View>

          <View style={{ height: SPACING.base }} />
          
          {/* Payment Button */}
          <TouchableOpacity 
            onPress={handleGCashPayment}
            disabled={loading}
            style={[styles.primaryButton, { opacity: loading ? 0.6 : 1, width: '100%' }]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={[styles.primaryButtonText]}>
                Send Payment via GCash
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: SPACING.large }} />
          
          {/* Instructions */}
          <View style={[styles.card, { backgroundColor: '#f5f5f5', marginTop: SPACING.base }]}>
            <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.small }}>
              📱 How to Pay via GCash
            </Text>
            <Text style={{ fontSize: TYPO.smallSize, color: COLORS.text, lineHeight: 22 }}>
              1. Open your GCash app{'\n'}
              2. Go to "Send Money"{'\n'}
              3. Enter the GCash number above{'\n'}
              4. Enter amount: ₱{Number(amount).toFixed(2)}{'\n'}
              5. Add reference: {house}{'\n'}
              6. Complete the transaction{'\n'}
              7. Return to this app and tap confirmation
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
