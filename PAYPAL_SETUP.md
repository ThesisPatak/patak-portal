# PayPal Integration Setup

## Overview
PayPal has replaced PayMongo. Payment flow is now:
1. User clicks "Pay with PayPal" → creates order
2. User redirected to PayPal login
3. User confirms payment
4. App captures order → payment recorded

## Quick Setup (5 minutes)

### Step 1: Get PayPal Credentials

#### Option A: Production (Real Money)
1. Go to https://www.paypal.com/merchant
2. Log in or create business account
3. Click **Settings** → **API Signature**
4. Get your:
   - Client ID
   - Client Secret

#### Option B: Sandbox (Testing - Recommended for Demo)
1. Go to https://developer.paypal.com
2. Sign up or log in
3. Navigate to **Apps & Credentials**
4. Make sure **Sandbox** tab is selected
5. Under **REST API apps**, click your app
6. Copy:
   - Client ID
   - Secret

### Step 2: Add to Railway Environment

1. Go to **Railway Dashboard** → Your patak-portal-production service
2. Click **Variables** tab
3. Add these environment variables:
   ```
   PAYPAL_CLIENT_ID=YOUR_CLIENT_ID_HERE
   PAYPAL_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
   FRONTEND_URL=https://patak-portal-production.up.railway.app
   ```
4. Click **Save** → Wait 30 seconds for auto-deploy

### Step 3: Test

**For Sandbox Testing:**
1. Open mobile app
2. Go to **Billing → Pay**
3. Click **Pay with PayPal**
4. Use sandbox buyer account:
   - Email: `sb-xxxxx@business.example.com` (from PayPal sandbox)
   - Password: (check PayPal sandbox settings)
5. Confirm payment
6. Check mobile app → payment should be recorded

**For Production:**
1. Same steps but use real PayPal account
2. Real money will be charged

## API Endpoints

### Create Order
```
POST /api/paypal/create-order
Headers: Authorization: Bearer {token}
Body: {
  amount: "100.00",
  description: "Water Bill - house1",
  billingMonth: 1,
  billingYear: 2026
}
Response: {
  ok: true,
  orderId: "3AW...",
  approvalUrl: "https://www.sandbox.paypal.com/...",
  amountDisplay: "₱100.00"
}
```

### Capture Order (Auto-called by mobile app)
```
POST /api/paypal/capture-order
Headers: Authorization: Bearer {token}
Body: {
  orderId: "3AW...",
  billingMonth: 1,
  billingYear: 2026
}
Response: {
  ok: true,
  payment: { id, userId, amount, status: "confirmed", ... }
}
```

## Troubleshooting

### "PayPal not configured" error
- ✓ Check Railway Variables page
- ✓ Ensure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are set
- ✓ Wait 1 minute for deployment to complete
- ✓ Refresh mobile app

### Payment not completing
- ✓ Check browser console (F12) for errors
- ✓ Make sure you're using correct sandbox/production credentials
- ✓ PayPal timeout = user took too long → try again
- ✓ Check server logs in Railway for API errors

### Order not capturing
- ✓ Wait 2-3 seconds after user approves on PayPal
- ✓ Check if payment is in `/api/payments/{username}` endpoint

## Testing with 3 Houses

Create 3 test users in admin dashboard:
1. **house1** - ₱500 bill
2. **house2** - ₱750 bill
3. **house3** - ₱1,200 bill

Then have each pay with PayPal to verify all 3 work.

## Payment Recording

All payments are recorded in `data/payments.json`:
```json
{
  "id": "payment-1234567890",
  "userId": "user-123",
  "username": "house1",
  "amount": 500.00,
  "paymentDate": "2026-01-22T...",
  "billingMonth": 1,
  "billingYear": 2026,
  "paymentMethod": "paypal",
  "status": "confirmed",
  "paypalOrderId": "3AW4568..."
}
```

## Webhook (Optional)

PayPal webhooks are configured but optional for manual verification.

To enable webhooks in production:
1. Go to PayPal merchant account
2. Settings → Webhooks
3. Add endpoint: `https://patak-portal-production.up.railway.app/api/paypal/webhook`
4. Subscribe to: `CHECKOUT.ORDER.COMPLETED`

## Environment Variables Reference

| Variable | Value | Required |
|----------|-------|----------|
| PAYPAL_CLIENT_ID | From PayPal | ✅ Yes |
| PAYPAL_CLIENT_SECRET | From PayPal | ✅ Yes |
| FRONTEND_URL | https://patak-portal-production.up.railway.app | ❌ Optional (has default) |
| PAYPAL_WEBHOOK_ID | From PayPal | ❌ Optional |

## Switching Back to PayMongo

If you need to revert to PayMongo:
1. Restore from git: `git checkout HEAD -- server/index.js mobile/screens/PayScreen.js`
2. Or ask for backup

---

**Last Updated:** January 22, 2026
**Status:** Ready for demo with 3 test houses
