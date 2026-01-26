import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Linking } from 'react-native';
import styles from './styles';
import { COLORS, SPACING, TYPO } from './variables';

export default function PayScreen({ payInfo, token, username, onBack, onPaymentSuccess }) {
  // Validate inputs
  if (!payInfo) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: SPACING.base }}>
        <Text style={{ color: '#ff6b6b', fontSize: 16, fontWeight: 'bold', marginBottom: SPACING.base }}>⚠️ Payment Information Missing</Text>
        <Text style={{ color: '#666', textAlign: 'center', marginBottom: SPACING.large }}>No bill selected. Please go back and try again.</Text>
        <TouchableOpacity style={[styles.primaryButton]} onPress={onBack}>
          <Text style={styles.primaryButtonText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!token) {
    console.error('[PayScreen] ❌ FATAL: token is missing!', { payInfo, username, token: token ? 'EXISTS' : 'NULL' });
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: SPACING.base }}>
        <Text style={{ color: '#ff6b6b', fontSize: 16, fontWeight: 'bold', marginBottom: SPACING.base }}>⚠️ Authentication Error</Text>
        <Text style={{ color: '#666', textAlign: 'center', marginBottom: SPACING.large }}>You are not authenticated. Your session may have expired. Please log in again.</Text>
        <TouchableOpacity style={[styles.primaryButton]} onPress={onBack}>
          <Text style={styles.primaryButtonText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const amount = Number(payInfo?.amount) || 0;
  const house = payInfo?.house ?? username ?? 'Account';
  const billingMonth = payInfo?.billingMonth || new Date().getMonth() + 1;
  const billingYear = payInfo?.billingYear || new Date().getFullYear();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [referenceNumber] = useState(`REF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);

  // Validate amount
  if (amount <= 0 || isNaN(amount)) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: SPACING.base }}>
        <Text style={{ color: '#ff6b6b', fontSize: 16, fontWeight: 'bold', marginBottom: SPACING.base }}>⚠️ Invalid Amount</Text>
        <Text style={{ color: '#666', textAlign: 'center', marginBottom: SPACING.large }}>The bill amount is invalid (₱{amount}). Please check your data and try again.</Text>
        <TouchableOpacity style={[styles.primaryButton]} onPress={onBack}>
          <Text style={styles.primaryButtonText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Month names for display
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startMonth = monthNames[billingMonth - 1] || 'Jan';
  const nextMonth = billingMonth === 12 ? monthNames[0] : monthNames[billingMonth] || 'Jan';
  const nextYear = billingMonth === 12 ? billingYear + 1 : billingYear;
  const billingPeriod = `${startMonth} ${billingYear} - ${nextMonth} ${nextYear}`;

  // Request checkout URL and redirect to PayMongo
  const initiatePayment = async () => {
    let timeoutId = null;
    try {
      console.log('[PayScreen] Starting payment initiation...');
      console.log('[PayScreen] Token:', token ? `✓ (${token.substring(0, 20)}...)` : '❌ MISSING');
      console.log('[PayScreen] Amount:', amount, 'Centavos:', Math.round(Number(amount) * 100));
      
      setPaymentLoading(true);
      const amountCentavos = Math.round(Number(amount) * 100);
      if (amountCentavos <= 0) {
        Alert.alert('Error', 'Invalid amount. Bill amount must be greater than 0.');
        setPaymentLoading(false);
        return;
      }
      
      // Add timeout to prevent app hanging on slow networks
      // 10 seconds is reasonable for payment API - if longer, likely network issue
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      console.log('[PayScreen] Sending request to backend...');
      const response = await fetch('https://patak-portal-production.up.railway.app/api/paymongo/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amountCentavos, // PayMongo uses centavos
          description: `Water Bill - ${house} (${billingMonth}/${billingYear})`,
          reference: referenceNumber,
          billingMonth: billingMonth,
          billingYear: billingYear,
        }),
        signal: controller.signal, // Add abort signal for timeout
      });
      
      console.log('[PayScreen] Backend response status:', response.status);
      if (timeoutId) {
        clearTimeout(timeoutId); // Clear timeout if request completes
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || 'Unknown server error' };
        }
        console.error('[PayScreen] ❌ Server error:', response.status, errorData);
        Alert.alert('Error', `Server error: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const data = await response.json();
      console.log('[PayScreen] ✓ Checkout response received:', { checkoutUrl: data.checkoutUrl ? 'EXISTS' : 'MISSING', qrCode: data.qrCode ? 'EXISTS' : 'MISSING' });
      
      // Get checkout URL (either checkoutUrl or fallback to qrCode)
      const checkoutUrl = data.checkoutUrl || data.qrCode;
      
      if (checkoutUrl) {
        try {
          // Open PayMongo checkout in browser
          await Linking.openURL(checkoutUrl);
          Alert.alert('Payment', 'Opening payment page...\n\nAfter payment, the status will update automatically when you return to the app.');
        } catch (linkErr) {
          console.error('Failed to open URL:', linkErr);
          Alert.alert('Error', 'Could not open payment link. Please try again.');
        }
      } else {
        console.error('No checkout URL in response:', data);
        Alert.alert('Error', 'Failed to get payment link. Please try again.');
      }
    } catch (err) {
      if (timeoutId) {
        clearTimeout(timeoutId); // Ensure timeout is cleared on error
      }
      console.error('[PayScreen] ❌ Payment initiation failed:', err.name, err.message);
      
      // Handle timeout error specifically
      if (err.name === 'AbortError') {
        Alert.alert('Payment Timeout', 'The payment request took too long. Please check your internet connection and try again.');
      } else {
        Alert.alert('Error', 'Failed to process payment: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  // Payment verification happens automatically via webhook after user completes payment in browser

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
            💳 Online Payment
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

        {/* Pay Now Button */}
        <TouchableOpacity
          onPress={initiatePayment}
          disabled={paymentLoading}
          style={[
            styles.primaryButton,
            {
              backgroundColor: paymentLoading ? '#ccc' : '#0066CC',
              marginBottom: SPACING.large,
              padding: SPACING.base + 4,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}
        >
          {paymentLoading ? (
            <>
              <ActivityIndicator size="small" color="white" style={{ marginRight: SPACING.small }} />
              <Text style={[styles.primaryButtonText, { color: 'white' }]}>Processing...</Text>
            </>
          ) : (
            <Text style={[styles.primaryButtonText, { color: 'white', fontSize: TYPO.bodySize + 2, fontWeight: '800' }]}>
              💳 Pay Now
            </Text>
          )}
        </TouchableOpacity>

        {/* Info: Payment will be processed in browser */}
        <View style={[styles.card, { backgroundColor: '#f0fff4', borderLeftWidth: 4, borderLeftColor: '#059669', marginBottom: SPACING.base }]}>
          <Text style={{ fontSize: TYPO.smallSize, color: '#059669', fontWeight: '600' }}>
            ℹ️ You will be redirected to PayMongo to complete payment securely.
          </Text>
          <Text style={{ fontSize: TYPO.smallSize - 1, color: '#666', marginTop: SPACING.small }}>
            After payment, return to the app and your billing status will update automatically.
          </Text>
        </View>

        {/* Payment Instructions */}
        <View style={[styles.card, { backgroundColor: '#f8fbff', borderLeftWidth: 4, borderLeftColor: '#0066CC', marginBottom: SPACING.base }]}>
          <Text style={{ fontSize: TYPO.bodySize + 1, fontWeight: '800', color: '#0057b8', marginBottom: SPACING.base }}>
            📋 Accepted Payment Methods
          </Text>

          <View style={{ marginBottom: SPACING.small }}>
            <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
              <Text style={{ marginRight: SPACING.small }}>💳</Text>
              <Text style={{ flex: 1, color: '#555' }}>Credit/Debit Cards (Visa, Mastercard)</Text>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
              <Text style={{ marginRight: SPACING.small }}>📱</Text>
              <Text style={{ flex: 1, color: '#555' }}>GCash</Text>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
              <Text style={{ marginRight: SPACING.small }}>💰</Text>
              <Text style={{ flex: 1, color: '#555' }}>Maya (formerly PayMaya)</Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ marginRight: SPACING.small }}>🏦</Text>
              <Text style={{ flex: 1, color: '#555' }}>Bank Transfers</Text>
            </View>
          </View>
        </View>

        {/* QR Code Instructions */}
        <View style={[styles.card, { backgroundColor: '#f8fbff', borderLeftWidth: 4, borderLeftColor: '#0066CC', marginBottom: SPACING.base }]}>
          <Text style={{ fontSize: TYPO.bodySize + 1, fontWeight: '800', color: '#0057b8', marginBottom: SPACING.base }}>
            📖 How to Pay
          </Text>

          <View style={{ marginBottom: SPACING.small }}>
            <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                <Text style={{ color: 'white', fontWeight: '800' }}>1</Text>
              </View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '700', color: '#0057b8', fontSize: TYPO.smallSize + 1 }}>Click Pay Now</Text>
                <Text style={{ color: '#555', fontSize: TYPO.smallSize - 1, marginTop: 2 }}>You will be taken to PayMongo</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                <Text style={{ color: 'white', fontWeight: '800' }}>2</Text>
              </View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '700', color: '#0057b8', fontSize: TYPO.smallSize + 1 }}>Scan QR Code</Text>
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

        {/* Payment Instructions */}
        <View style={[styles.card, { backgroundColor: '#f8fbff', borderLeftWidth: 4, borderLeftColor: '#0066CC', marginBottom: SPACING.base }]}>
          <Text style={{ fontSize: TYPO.bodySize + 1, fontWeight: '800', color: '#0057b8', marginBottom: SPACING.base }}>
            Accepted Payment Methods
          </Text>

          <View style={{ marginBottom: SPACING.small }}>
            <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
              <Text style={{ marginRight: SPACING.small }}>•</Text>
              <Text style={{ flex: 1, color: '#555' }}>Credit/Debit Cards (Visa, Mastercard)</Text>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
              <Text style={{ marginRight: SPACING.small }}>•</Text>
              <Text style={{ flex: 1, color: '#555' }}>GCash</Text>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
              <Text style={{ marginRight: SPACING.small }}>•</Text>
              <Text style={{ flex: 1, color: '#555' }}>Maya (formerly PayMaya)</Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ marginRight: SPACING.small }}>•</Text>
              <Text style={{ flex: 1, color: '#555' }}>Bank Transfers</Text>
            </View>
          </View>
        </View>

        {/* How to Pay Instructions */}
        <View style={[styles.card, { backgroundColor: '#f8fbff', borderLeftWidth: 4, borderLeftColor: '#0066CC', marginBottom: SPACING.base }]}>
          <Text style={{ fontSize: TYPO.bodySize + 1, fontWeight: '800', color: '#0057b8', marginBottom: SPACING.base }}>
            How to Pay
          </Text>

          <View style={{ marginBottom: SPACING.small }}>
            <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                <Text style={{ color: 'white', fontWeight: '800' }}>1</Text>
              </View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '700', color: '#0057b8', fontSize: TYPO.smallSize + 1 }}>Click Pay Now</Text>
                <Text style={{ color: '#555', fontSize: TYPO.smallSize - 1, marginTop: 2 }}>Redirected to PayMongo checkout</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: SPACING.small }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                <Text style={{ color: 'white', fontWeight: '800' }}>2</Text>
              </View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '700', color: '#0057b8', fontSize: TYPO.smallSize + 1 }}>Choose Payment Method</Text>
                <Text style={{ color: '#555', fontSize: TYPO.smallSize - 1, marginTop: 2 }}>Card, GCash, Maya, or Bank Transfer</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.base }}>
                <Text style={{ color: 'white', fontWeight: '800' }}>3</Text>
              </View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '700', color: '#0057b8', fontSize: TYPO.smallSize + 1 }}>Confirm Payment</Text>
                <Text style={{ color: '#555', fontSize: TYPO.smallSize - 1, marginTop: 2 }}>Your bill updates automatically</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Security Info */}
        <View style={[styles.card, { backgroundColor: '#f0fff4', marginBottom: SPACING.large }]}>
          <Text style={{ fontSize: TYPO.bodySize - 1, fontWeight: '700', color: '#059669', marginBottom: SPACING.base }}>
            Secure Payment
          </Text>
          <Text style={{ fontSize: TYPO.smallSize - 1, color: '#666', lineHeight: 18 }}>
            All transactions are encrypted and processed securely through PayMongo. Your payment information is never stored on our servers.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
