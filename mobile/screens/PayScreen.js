import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import styles from './styles';
import { COLORS, SPACING, TYPO } from './variables';

export default function PayScreen({ payInfo, token, username, onBack, onPaymentSuccess }) {
  const amount = payInfo?.amount ?? 0;
  const house = payInfo?.house ?? username ?? 'Account';
  const billingMonth = payInfo?.billingMonth || new Date().getMonth() + 1;
  const billingYear = payInfo?.billingYear || new Date().getFullYear();
  const [qrCode, setQrCode] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [referenceNumber] = useState(`REF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);

  // Month names for display
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startMonth = monthNames[billingMonth - 1];
  const nextMonth = billingMonth === 12 ? monthNames[0] : monthNames[billingMonth];
  const nextYear = billingMonth === 12 ? billingYear + 1 : billingYear;
  const billingPeriod = `${startMonth} ${billingYear} - ${nextMonth} ${nextYear}`;

  // Fetch PayMongo QR code
  const generateQRCode = async () => {
    try {
      setQrLoading(true);
      const response = await fetch('https://patak-portal-production.up.railway.app/api/paymongo/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Number(amount) * 100, // PayMongo uses centavos
          description: `Water Bill - ${house} (${billingMonth}/${billingYear})`,
          reference: referenceNumber,
          billingMonth: billingMonth,
          billingYear: billingYear,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', response.status, errorData);
        Alert.alert('Error', `Server error: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const data = await response.json();
      console.log('QR Code Response:', data);
      
      if (data.qrCode) {
        setQrCode(data.qrCode);
        setShowQR(true);
      } else if (data.checkoutUrl) {
        // Fallback to checkout URL if QR not available
        setQrCode(data.checkoutUrl);
        setShowQR(true);
      } else {
        console.error('No QR code or checkout URL in response:', data);
        Alert.alert('Error', 'Failed to generate QR code - no payment URL returned');
      }
    } catch (err) {
      console.error('Failed to fetch QR code:', err);
      Alert.alert('Error', 'Failed to generate QR code: ' + err.message);
    } finally {
      setQrLoading(false);
    }
  };

  // Payment verification happens automatically via webhook after user scans QR and completes payment

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ padding: SPACING.base, paddingTop: SPACING.large }}>
        {/* Header with Back Button */}
        <TouchableOpacity onPress={onBack} style={[styles.secondaryButton, { alignSelf: 'flex-start', marginBottom: SPACING.base }]}>
          <Text style={styles.secondaryButtonText}>← Back</Text>
        </TouchableOpacity>

        {/* Payment Method Title */}
        <View style={{ alignItems: 'center', marginBottom: SPACING.large, paddingVertical: SPACING.base }}>
          <Text style={{ fontSize: TYPO.bodySize + 2, fontWeight: '700', color: '#0066CC', marginBottom: SPACING.small }}>
            💳 QR Code Payment
          </Text>
          <Text style={{ fontSize: TYPO.smallSize, color: '#666', textAlign: 'center' }}>
            Fast • Secure • Instant
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
            <Text style={{ fontSize: TYPO.smallSize, color: '#555', fontWeight: '600', marginBottom: SPACING.small }}>BILLING PERIOD</Text>
            <Text style={{ fontWeight: '700', color: '#0057b8', fontSize: TYPO.bodySize + 1 }}>
              {billingPeriod}
            </Text>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: SPACING.base }}>
            <Text style={{ fontSize: TYPO.smallSize, color: '#666', marginBottom: SPACING.small }}>AMOUNT DUE</Text>
            <Text style={{ fontSize: 32, fontWeight: '900', color: '#0066CC' }}>₱{Number(amount).toFixed(2)}</Text>
          </View>
        </View>

        {/* QR Code Section */}
        {showQR && (
          <>
            {qrLoading ? (
              <View style={[styles.card, { alignItems: 'center', padding: SPACING.large, marginBottom: SPACING.base }]}>
                <ActivityIndicator size="large" color={COLORS.glowBlue} />
                <Text style={{ marginTop: SPACING.base, color: '#666' }}>Generating QR Code...</Text>
              </View>
            ) : qrCode ? (
              <View style={[styles.card, { backgroundColor: '#f0fff4', borderLeftWidth: 4, borderLeftColor: '#059669', marginBottom: SPACING.base, alignItems: 'center', padding: SPACING.large }]}>
                <Text style={{ fontSize: TYPO.bodySize, fontWeight: '700', color: '#059669', marginBottom: SPACING.base }}>
                  📱 Scan to Pay
                </Text>
                <Image
                  source={{ uri: qrCode }}
                  style={{ width: 250, height: 250, marginBottom: SPACING.base, borderRadius: 8 }}
                />
                <Text style={{ fontSize: TYPO.smallSize, color: '#666', textAlign: 'center', marginTop: SPACING.base }}>
                  Use any payment app: GCash, Maya, OnePay, etc.
                </Text>
              </View>
            ) : null}
          </>
        )}

        {/* Payment Instructions */}
        <View style={[styles.card, { backgroundColor: '#f8fbff', borderLeftWidth: 4, borderLeftColor: '#0066CC', marginBottom: SPACING.base }]}>
          <Text style={{ fontSize: TYPO.bodySize + 1, fontWeight: '800', color: '#0057b8', marginBottom: SPACING.base }}>
            📋 How to Pay
          </Text>

          <View style={{ marginBottom: SPACING.small }}>
            <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                <Text style={{ color: 'white', fontWeight: '800' }}>1</Text>
              </View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '700', color: '#0057b8', fontSize: TYPO.smallSize + 1 }}>Open Your Payment App</Text>
                <Text style={{ color: '#555', fontSize: TYPO.smallSize - 1, marginTop: 2 }}>GCash, Maya, OnePay, etc.</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                <Text style={{ color: 'white', fontWeight: '800' }}>2</Text>
              </View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '700', color: '#0057b8', fontSize: TYPO.smallSize + 1 }}>Scan This QR Code</Text>
                <Text style={{ color: '#555', fontSize: TYPO.smallSize - 1, marginTop: 2 }}>Point your camera at the code</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                <Text style={{ color: 'white', fontWeight: '800' }}>3</Text>
              </View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '700', color: '#0057b8', fontSize: TYPO.smallSize + 1 }}>Complete Payment</Text>
                <Text style={{ color: '#555', fontSize: TYPO.smallSize - 1, marginTop: 2 }}>Confirm amount and send</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Generate QR Button - Primary Action */}
        {!showQR && (
          <TouchableOpacity
            onPress={generateQRCode}
            disabled={qrLoading}
            style={[
              styles.primaryButton,
              {
                opacity: qrLoading ? 0.6 : 1,
                width: '100%',
                backgroundColor: '#059669',
                paddingVertical: SPACING.base + 4,
                marginBottom: SPACING.base,
              }
            ]}
          >
            {qrLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color="white" style={{ marginRight: SPACING.small }} />
                <Text style={[styles.primaryButtonText]}>Generating...</Text>
              </View>
            ) : (
              <Text style={[styles.primaryButtonText, { fontSize: TYPO.bodySize + 1 }]}>
                📱 Generate QR Code & Pay
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Info: After QR is scanned, payment will be verified automatically */}
        {showQR && (
          <View style={[styles.card, { backgroundColor: '#dbeafe', borderLeftWidth: 4, borderLeftColor: '#0066CC', marginBottom: SPACING.base }]}>
            <Text style={{ fontSize: TYPO.smallSize, color: '#0057b8', fontWeight: '700', marginBottom: SPACING.small }}>
              ℹ️ Payment Processing
            </Text>
            <Text style={{ fontSize: TYPO.smallSize - 1, color: '#0057b8', lineHeight: 18 }}>
              After you scan and complete payment in your payment app, your account will be automatically updated within 1-2 minutes.
            </Text>
          </View>
        )}

        {/* Security Info */}
        <View style={[styles.card, { backgroundColor: '#f0fff4', marginBottom: SPACING.large }]}>
          <Text style={{ fontSize: TYPO.bodySize - 2, fontWeight: '700', color: '#059669', marginBottom: SPACING.base }}>
            🔒 Secure Payment
          </Text>
          <Text style={{ fontSize: TYPO.smallSize - 2, color: '#666', lineHeight: 18 }}>
            Your payment is protected by PayMongo's secure payment gateway. Your account will not be charged until payment is successfully confirmed.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
