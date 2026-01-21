import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import styles from './styles';
import { COLORS, SPACING, TYPO } from './variables';

export default function PayScreen({ payInfo, token, username, onBack, onPaymentSuccess }) {
  const amount = payInfo?.amount ?? 0;
  const house = payInfo?.house ?? username ?? 'Account';
  const billingMonth = payInfo?.billingMonth || new Date().getMonth() + 1;
  const billingYear = payInfo?.billingYear || new Date().getFullYear();
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
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

      const data = await response.json();
      if (data.qrCode) {
        setQrCode(data.qrCode);
        setShowQR(true);
      } else if (data.checkoutUrl) {
        // Fallback to checkout URL if QR not available
        setQrCode(data.checkoutUrl);
        setShowQR(true);
      } else {
        Alert.alert('Error', 'Failed to generate QR code');
      }
    } catch (err) {
      console.error('Failed to fetch QR code:', err);
      Alert.alert('Error', 'Failed to generate QR code: ' + err.message);
    } finally {
      setQrLoading(false);
    }
  };

  // Download QR Code to Gallery
  const downloadQRCode = async () => {
    try {
      setDownloadLoading(true);
      
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need permission to save files to your gallery.');
        setDownloadLoading(false);
        return;
      }

      // Create filename
      const filename = `PATAK-Water-Bill-${referenceNumber}-${Date.now()}.jpg`;
      const filepath = FileSystem.documentDirectory + filename;

      // Download the QR code image
      const downloadResult = await FileSystem.downloadAsync(qrCode, filepath);

      if (downloadResult.status === 200) {
        // Save to gallery
        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
        await MediaLibrary.createAlbumAsync('PATAK Portal', asset, false);

        Alert.alert('✅ Success', `QR Code saved to Gallery!\n\nFile: ${filename}`);
      } else {
        Alert.alert('Error', 'Failed to download QR code');
      }
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Error', 'Failed to save QR code: ' + err.message);
    } finally {
      setDownloadLoading(false);
    }
  };

  const handlePaymentSubmit = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://patak-portal-production.up.railway.app/api/paymongo/submit-payment', {
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
          `Amount: ₱${Number(amount).toFixed(2)}\nReference: ${referenceNumber}\n\nScan the QR code above with any payment app (GCash, Maya, etc.)`,
          [
            {
              text: 'OK',
              onPress: () => {
                onBack();
                if (onPaymentSuccess) onPaymentSuccess();
              },
            },
          ]
        );
        setLoading(false);
      } else {
        Alert.alert('Error', data.error || 'Failed to submit payment');
        setLoading(false);
      }
    } catch (err) {
      console.error('Payment error:', err);
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

        {/* Submit Payment Button - Only after QR generated */}
        {showQR && (
          <>
            {/* Download QR Button */}
            <TouchableOpacity
              onPress={downloadQRCode}
              disabled={downloadLoading}
              style={[
                styles.secondaryButton,
                {
                  opacity: downloadLoading ? 0.6 : 1,
                  width: '100%',
                  backgroundColor: '#f0f0f0',
                  borderWidth: 2,
                  borderColor: '#059669',
                  paddingVertical: SPACING.base + 2,
                  marginBottom: SPACING.small,
                }
              ]}
            >
              {downloadLoading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color="#059669" style={{ marginRight: SPACING.small }} />
                  <Text style={[styles.secondaryButtonText, { color: '#059669', fontWeight: '700' }]}>Saving...</Text>
                </View>
              ) : (
                <Text style={[styles.secondaryButtonText, { color: '#059669', fontWeight: '700', fontSize: TYPO.bodySize }]}>
                  📥 Download QR Code
                </Text>
              )}
            </TouchableOpacity>

            {/* Confirm Payment Button */}
            <TouchableOpacity
              onPress={handlePaymentSubmit}
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
                  ✓ Confirm & Submit Payment
                </Text>
              )}
            </TouchableOpacity>
          </>
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
