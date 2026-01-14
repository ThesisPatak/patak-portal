import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator, Share } from 'react-native';
import styles from './styles';
import { COLORS, SPACING, TYPO } from './variables';

export default function PayScreen({ payInfo, onBack }) {
  const amount = payInfo?.amount ?? 0;
  const house = payInfo?.house ?? 'Unnamed';
  const [loading, setLoading] = useState(false);

  // PayPal.Me username
  const PAYPAL_ID = 'PatakSupplier';

  const paypalLink = `https://www.paypal.com/paypalme/${PAYPAL_ID}/${Number(amount).toFixed(2)}`;

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
      await Share.share({
        message: `Pay ₱${Number(amount).toFixed(2)} via PayPal for ${house}:\n${paypalLink}`,
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
    <View style={{ flex: 1, padding: SPACING.base, backgroundColor: COLORS.background }}>
      <TouchableOpacity onPress={onBack} style={[styles.secondaryButton, { alignSelf: 'flex-start', marginBottom: SPACING.small }]}>
        <Text style={styles.secondaryButtonText}>← Back</Text>
      </TouchableOpacity>

      <View style={[styles.card, { alignItems: 'center' }]}>
        <Text style={{ fontWeight: '800', color: COLORS.glowBlue, fontSize: TYPO.subtitleSize + 3 }}>{house}</Text>
        <Text style={[styles.subtitle, { marginTop: SPACING.base }]}>Amount Due</Text>
        <Text style={{ fontSize: TYPO.bodySize + 8, fontWeight: '900', color: COLORS.glowBlue, marginTop: SPACING.small }}>₱{Number(amount).toFixed(2)}</Text>

        <View style={{ height: SPACING.base * 2 }} />
        
        {/* PayPal Payment Info */}
        <View style={{ width: '100%', padding: SPACING.base, backgroundColor: '#f0f7ff', borderRadius: 12, marginVertical: SPACING.base }}>
          <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: COLORS.glowBlue, textAlign: 'center', marginBottom: SPACING.small }}>PayPal Payment</Text>
          <Text style={{ fontSize: TYPO.bodySize - 2, color: '#666', textAlign: 'center', marginBottom: SPACING.small }}>
            Click below to open PayPal and complete your payment
          </Text>
          <Text style={{ fontSize: TYPO.bodySize - 3, color: '#999', textAlign: 'center', fontStyle: 'italic' }}>
            PayPal ID: {PAYPAL_ID}
          </Text>
        </View>

        <View style={{ height: SPACING.base }} />
        
        <TouchableOpacity 
          onPress={handleOpenPayPal} 
          disabled={loading}
          style={[styles.primaryButton, { opacity: loading ? 0.6 : 1 }]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={[styles.primaryButtonText]}>Open PayPal Payment</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: SPACING.small }} />
        
        <TouchableOpacity 
          onPress={handleShare}
          style={[styles.secondaryButton, { marginHorizontal: 0 }]}
        >
          <Text style={styles.secondaryButtonText}>Share Payment Link</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.small }} />
        <Text style={[styles.subtitle, { color: COLORS.muted, marginTop: SPACING.base, textAlign: 'center' }]}>
          Your payment of ₱{Number(amount).toFixed(2)} will be securely processed through PayPal.
        </Text>
      </View>
    </View>
  );
}
