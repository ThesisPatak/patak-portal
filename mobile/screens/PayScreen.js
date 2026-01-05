import React from 'react';
import { View, Text, TouchableOpacity, Image, Linking } from 'react-native';
import styles from './styles';
import { COLORS, SPACING, TYPO } from './variables';

export default function PayScreen({ payInfo, onBack }) {
  const amount = payInfo?.amount ?? 0;
  const house = payInfo?.house ?? 'Unnamed';

  // Placeholder PayPal URL - replace YOUR_ID with actual merchant/paypal.me id
  const paypalUrl = `https://www.paypal.com/paypalme/YOUR_ID/${Number(amount).toFixed(2)}`;

  return (
    <View style={{ flex: 1, padding: SPACING.base }}>
      <TouchableOpacity onPress={onBack} style={[styles.secondaryButton, { alignSelf: 'flex-start', marginBottom: SPACING.small }]}>
        <Text style={styles.secondaryButtonText}>← Back</Text>
      </TouchableOpacity>

      <View style={[styles.card, { alignItems: 'center' }]}>
        <Text style={{ fontWeight: '800', color: COLORS.primary, fontSize: TYPO.subtitleSize + 3 }}>{house}</Text>
        <Text style={[styles.subtitle, { marginTop: SPACING.base }]}>Amount Due</Text>
        <Text style={{ fontSize: TYPO.bodySize + 8, fontWeight: '900', color: COLORS.link, marginTop: SPACING.small }}>₱{Number(amount).toFixed(2)}</Text>

        <View style={{ height: SPACING.base }} />
        {/* Placeholder QR area - replace with actual QR image */}
        <View style={{ width: 200, height: 200, backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: COLORS.primary }}>QR</Text>
        </View>

        <View style={{ height: SPACING.base }} />
        <TouchableOpacity onPress={() => Linking.openURL(paypalUrl)} style={[styles.primaryButton]}>
          <Text style={[styles.primaryButtonText]}>Open PayPal (placeholder)</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.small }} />
        <Text style={[styles.subtitle, { color: COLORS.muted, marginTop: SPACING.base }]}>Scan the QR above with your PayPal app to pay the shown amount.</Text>
      </View>
    </View>
  );
}
