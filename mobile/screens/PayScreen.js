import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Linking, ActivityIndicator } from 'react-native';
import QRCode from 'qrcode.react';
import styles from './styles';
import { COLORS, SPACING, TYPO } from './variables';

export default function PayScreen({ payInfo, onBack }) {
  const amount = payInfo?.amount ?? 0;
  const house = payInfo?.house ?? 'Unnamed';
  const [qrValue, setQrValue] = useState('');

  // PayPal.Me username for Rodney Delgado
  const PAYPAL_ID = 'PatakSupplier';

  useEffect(() => {
    // Generate PayPal payment link with amount
    const paypalLink = `https://www.paypal.com/paypalme/${PAYPAL_ID}/${Number(amount).toFixed(2)}`;
    setQrValue(paypalLink);
  }, [amount]);

  const handlePayPalPress = () => {
    if (PAYPAL_ID === 'YOUR_PAYPAL_ID') {
      alert('Please update PAYPAL_ID in PayScreen.js with your PayPal.Me username');
      return;
    }
    Linking.openURL(qrValue);
  };

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
        {/* PayPal QR Code */}
        {qrValue ? (
          <View style={{ width: 220, height: 220, backgroundColor: 'white', borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', padding: SPACING.small }}>
            <QRCode
              value={qrValue}
              size={200}
              color={COLORS.primary}
              backgroundColor="white"
              level="H"
              includeMargin={false}
            />
          </View>
        ) : (
          <ActivityIndicator size="large" color={COLORS.primary} />
        )}

        <View style={{ height: SPACING.base }} />
        <TouchableOpacity onPress={handlePayPalPress} style={[styles.primaryButton]}>
          <Text style={[styles.primaryButtonText]}>Open PayPal</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.small }} />
        <Text style={[styles.subtitle, { color: COLORS.muted, marginTop: SPACING.base }]}>
          Scan the QR code above with your phone camera or PayPal app to pay ₱{Number(amount).toFixed(2)}
        </Text>
      </View>
    </View>
  );
}
