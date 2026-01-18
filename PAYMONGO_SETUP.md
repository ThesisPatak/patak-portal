# PayMongo Integration Setup

## Issue
When clicking "Pay" on the mobile app, you get an error:
```
API key sk_live_9JD****mPU does not exist
```

This happens because the `PAYMONGO_SECRET_KEY` is not configured in your Railway environment.

## Solution

### Step 1: Get Your PayMongo API Keys
1. Go to [PayMongo Dashboard](https://dashboard.paymongo.com)
2. Log in to your account
3. Navigate to **Settings → API Keys**
4. Copy your:
   - **Secret Key** (starts with `sk_live_...` or `sk_test_...`)
   - **Public Key** (starts with `pk_live_...` or `pk_test_...`)

### Step 2: Add to Railway Environment
1. Go to your [Railway Project](https://railway.app/project)
2. Select your **patak-portal-production** service
3. Click **Variables** tab
4. Add these environment variables:
   ```
   PAYMONGO_SECRET_KEY=sk_live_XXXXXXXXXXXXXXX
   PAYMONGO_PUBLIC_KEY=pk_live_XXXXXXXXXXXXXXX
   ```
5. Click **Save** and wait for the deployment to restart

### Step 3: Verify Configuration
Once deployed, visit this debug endpoint to verify:
```
https://patak-portal-production.up.railway.app/debug/paymongo-config
```

You should see:
```json
{
  "paymongo": {
    "hasSecretKey": true,
    "hasPublicKey": true,
    "secretKeyPreview": "sk_live_XXXX...XXXX",
    "publicKeyPreview": "pk_live_XXXX...XXXX"
  }
}
```

### Step 4: Test Payment
1. Open the mobile app
2. Go to **Billing → Pay**
3. Click **Pay via GCash**
4. You should be redirected to PayMongo checkout (no more API key errors)

## Troubleshooting

### Still seeing API key error?
- ✓ Confirm both `PAYMONGO_SECRET_KEY` and `PAYMONGO_PUBLIC_KEY` are set in Railway
- ✓ Wait for the service to fully restart after adding variables
- ✓ Try clearing mobile app cache and restart
- ✓ Check Railway deployment logs for errors

### Test vs Live Keys
- Use `sk_test_...` and `pk_test_...` for testing
- Use `sk_live_...` and `pk_live_...` for production
- Both work the same way in the app

## How It Works

1. Mobile app calls `/api/paymongo/create-link` with amount & billing info
2. Backend creates a PayMongo checkout session using your Secret Key
3. Backend returns checkout URL to mobile app
4. Mobile app opens URL in browser for payment
5. After payment, PayMongo webhook confirms transaction on backend
6. Payment is recorded in system

