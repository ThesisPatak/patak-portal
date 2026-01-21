# PATAK Portal - 1-Month Deployment Checklist

**Current Date:** January 21, 2026  
**Status:** Ready with Configuration Required

---

## ✅ COMPLETED FEATURES

### Web Admin Dashboard
- ✅ User account management (create, view, delete)
- ✅ Real-time water usage monitoring
- ✅ Billing history (12-month dynamic view)
- ✅ Bill status calculation (Current/Pending/Overdue)
- ✅ Admin password change functionality
- ✅ Responsive mobile-friendly design
- ✅ GCash payments removed (PayMongo QR only)
- ✅ **Dynamic year calculation** (Fixed Jan 21, 2026)

### Mobile App
- ✅ User registration & login
- ✅ Real-time dashboard with current consumption
- ✅ Billing history view
- ✅ Payment integration (PayMongo QR code)
- ✅ Device linkage & management

### Backend Server
- ✅ User authentication (JWT)
- ✅ Meter reading ingestion (ESP32)
- ✅ Billing calculation (tiered rates)
- ✅ Payment tracking
- ✅ Persistent storage (JSON + Railway volume)
- ✅ SSE streaming for real-time updates

---

## 🔴 CRITICAL - REQUIRED BEFORE DEPLOYMENT

### 1. Set Railway Environment Variables
**Location:** Railway Dashboard → Project Settings → Variables

```
JWT_SECRET=<generate-a-strong-secret>
PAYMONGO_PUBLIC_KEY=<your-paymongo-public-key>
PAYMONGO_SECRET_KEY=<your-paymongo-secret-key>
DATA_DIR=/data
NODE_ENV=production
```

**How to generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Get PayMongo Live Keys
- Go to https://dashboard.paymongo.com
- Get Live Public Key (starts with `pk_live_`)
- Get Live Secret Key (starts with `sk_live_`)
- Add both to Railway environment variables

### 3. Test Admin Credentials
- **Default Username:** `adminpatak`
- **Default Password:** Change immediately after first login
- Change in Admin Dashboard → "Change Password" button

---

## 🟠 HIGH PRIORITY - BEFORE LIVE USERS

### Security Hardening
- [ ] Enable HTTPS only (Railway auto-provides)
- [ ] Set up rate limiting on `/auth/login` endpoint
- [ ] Implement CORS whitelist for mobile app origin
- [ ] Validate all meter readings for sanity (no 999m³ spikes)
- [ ] Rotate admin password monthly

### Testing
- [ ] Test meter reading ingestion from ESP32
- [ ] Test payment QR code generation
- [ ] Test billing calculation with sample data
- [ ] Test 1-month bill cycle transitions
- [ ] Verify data persistence after server restart

### Mobile App
- [ ] Build and test EAS APK generation
- [ ] Test on real Android device (not just emulator)
- [ ] Test on various network conditions (mobile data, WiFi)
- [ ] Test offline mode behavior

---

## 🟡 MEDIUM PRIORITY - DURING DEPLOYMENT

### Monitoring
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Monitor API response times
- [ ] Set up disk space alerts (JSON file growth)
- [ ] Log rotation for server logs

### User Management
- [ ] Create test user accounts
- [ ] Test household device linkage
- [ ] Verify meter reading synchronization
- [ ] Test bill generation for 30-day cycle

### Backup & Recovery
- [ ] Set up daily backups of `/data` volume
- [ ] Document disaster recovery procedure
- [ ] Test backup restoration process

---

## 📋 BILLING CYCLE DETAILS

### Current Implementation
- **Billing Period:** 1st to last day of calendar month
- **Due Date:** 1st of next month + grace period (if configured)
- **Bill Status:**
  - 🟢 **Current:** Within current billing month
  - ⏳ **Pending:** Past due date but not yet overdue
  - 🔴 **Overdue:** Payment past due date
  - ⚪ **Not Yet Active:** No meter readings

### Testing Dates
For 1-month test (Jan 21 - Feb 21, 2026):
- January 21: Check current month (January) status
- February 1: Verify rollover to February billing
- February 20: Test upcoming month visibility
- February 21: Verify overdue status if unpaid

---

## 🚀 DEPLOYMENT STEPS

1. **Push Code**
   ```bash
   git add -A
   git commit -m "Deploy: Fix dynamic year calculation and add PayMongo config"
   git push origin main
   ```

2. **Configure Railway**
   - Add 4 environment variables (see above)
   - Redeploy from GitHub

3. **Test Endpoints**
   ```bash
   # Admin login
   curl -X POST https://patak-portal-production.up.railway.app/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"adminpatak","password":"<password>"}'
   
   # Get dashboard
   curl https://patak-portal-production.up.railway.app/api/admin/dashboard \
     -H "Authorization: Bearer <token>"
   ```

4. **Build Mobile APK**
   ```bash
   cd mobile
   eas build --platform android --build-profile preview
   ```

5. **Notify Users**
   - Share APK link or Play Store link
   - Provide admin dashboard URL
   - Send device linkage instructions

---

## 📞 SUPPORT CONTACTS

### PayMongo Support
- Email: support@paymongo.com
- Dashboard: https://dashboard.paymongo.com

### Railway Support
- Dashboard: https://railway.app
- Docs: https://docs.railway.app

### ESP32 Device
- Ensure correct API endpoint in WaterESP32_network.ino
- Baud rate: 115200
- Test readings: Submit via `/api/readings` endpoint

---

## ✨ KEY CHANGES MADE (Jan 21, 2026)

1. ✅ **Dynamic Year Calculation**
   - Billing history now uses current year
   - Months roll forward (Jan 21 starts from Jan 2026)
   - Works indefinitely without hardcoded dates

2. ✅ **Environment Variables**
   - railway.json updated with JWT_SECRET, PayMongo keys
   - NODE_ENV set to production
   - DATA_DIR explicitly configured

3. ✅ **Footer Year**
   - Copyright year now dynamic using `new Date().getFullYear()`

---

**Last Updated:** January 21, 2026  
**Next Review:** Before February 1, 2026
