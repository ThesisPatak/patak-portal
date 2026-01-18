# PATAK PORTAL - Code Review & Issues Found

## Overview
Review of the entire PATAK Portal codebase (ESP32 firmware, Node.js backend, React frontend, React Native mobile).

---

## 🔴 CRITICAL ISSUES

### 1. **Billing Calculation Inconsistency - Multiple Different Rates** ✅ FIXED
**Severity:** HIGH  
**Location:** Multiple files
- **server/index.js**: Now uses tiered billing function `calculateWaterBill()`
- **AdminDashboard.tsx**: Now uses tiered billing function
- **UsageDashboard.tsx**: Now uses tiered billing function
- **mobile/screens/DashboardScreenMinimal.js**: Now uses tiered billing function
- **BillingTable.tsx**: Already had correct implementation

**Issue (RESOLVED):** The billing rate was inconsistent:
- ✅ Fixed by implementing proper tiered billing calculation
- ✅ Minimum charge: 255.00 PHP (covers up to 10 m³)
- ✅ Tier 1 (11-20 m³): 33.00 PHP per m³
- ✅ Tier 2 (21-30 m³): 40.50 PHP per m³
- ✅ Tier 3 (31-40 m³): 48.00 PHP per m³
- ✅ Tier 4 (41+ m³): 55.50 PHP per m³

**Implementation:**
- Created centralized `calculateWaterBill()` function in server and all client-side files
- All billing now uses the same official tiered rate schedule
- Consistent across web dashboard, mobile app, and admin panel

---

### 2. **No Input Validation for ESP32 Readings - Potential Data Corruption**
**Severity:** HIGH  
**Location:** server/index.js, lines 540-590

**Issue:** While there are some range checks, the validation is insufficient:
```javascript
if (cubicMeters < 0 || totalLiters < 0) { ... }
if (cubicMeters > 1000000 || totalLiters > 1000000000) { ... }
```

Problems:
- No validation that `cubicMeters === totalLiters / 1000` 
- No check for data type consistency (should be numbers, not strings)
- No validation that readings are monotonically increasing (ESP32 accumulates)
- Missing check for duplicate readings within same second

**Fix Required:**
```javascript
// Add these validations
if (typeof cubicMeters !== 'number' || typeof totalLiters !== 'number') {
  return res.status(400).json({ error: 'Readings must be numeric' })
}

// ESP32 sends cumulative totals - should only increase or stay same
const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
const lastReading = readings[readings.length - 1]
if (lastReading && lastReading.deviceId === deviceId) {
  if (cubicMeters < lastReading.cubicMeters) {
    return res.status(400).json({ error: 'Reading values cannot decrease' })
  }
}

// Verify relationship: cubicMeters = totalLiters / 1000
const expectedCubicMeters = totalLiters / 1000
if (Math.abs(cubicMeters - expectedCubicMeters) > 0.001) {
  return res.status(400).json({ error: 'cubicMeters and totalLiters mismatch' })
}
```

---

### 3. **Authentication Bypass Risk - Device Token Not Required for Some Operations**
**Severity:** MEDIUM  
**Location:** server/index.js, lines 919-943 (`/devices/check-commands` and `/devices/claim-token`)

**Issue:** 
```javascript
app.post('/devices/check-commands', async (req, res) => {
  // NO AUTHENTICATION - anyone can check commands for any device!
  
app.post('/devices/claim-token', async (req, res) => {
  // NO AUTHENTICATION - anyone can claim a token for any device!
```

An attacker can:
1. Claim any device's token (by knowing the device ID)
2. Use that token to submit fake readings
3. Check what commands a device has been issued

**Fix Required:**
Either:
- Require device authentication (implement secret/key for devices), OR
- Move these endpoints to internal-only, OR
- Rate-limit aggressively and log all access

---

### 4. **Admin Password Issue - Hardcoded Hash in Code**
**Severity:** MEDIUM  
**Location:** server/index.js, lines 41-48 and multiple other places

**Issue:** The admin password hash is visible in source code:
```javascript
passwordHash: '$2a$10$Y2gr8aro9OGKnOdo99uLcunL.T5ocLHiPKW835V84gQfNZBh2vBZa'
```

This hash will:
- Be exposed if code is accidentally committed to public repo
- Be visible to anyone with access to the codebase
- Make it impossible to change admin password securely

**Fix Required:**
- Use environment variables for initial admin credentials
- Store hash in a secure location, not in code
- Add admin password reset functionality

```javascript
// Instead of hardcoded:
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || null

if (!ADMIN_PASSWORD_HASH) {
  console.error('ERROR: ADMIN_PASSWORD_HASH not set in environment')
  process.exit(1)
}
```

---

## ⚠️ MEDIUM PRIORITY ISSUES

### 5. **Security: Missing Validation in Mobile Device Registration**
**Location:** mobile/screens/RegisterScreen.js  
**Issue:** No apparent password strength validation. Users could register with weak passwords.

**Fix:** Add client-side validation:
- Minimum 8 characters
- Mix of uppercase, lowercase, numbers
- No common passwords

---

### 6. **Missing Error Handling: File Read Operations**
**Location:** Multiple locations (server/index.js, lines 400+)

**Issue:** Several file read operations lack proper error handling:
```javascript
const readings = JSON.parse(fs.readFileSync(READINGS_FILE, 'utf8'))
// What if file is corrupted? JSON.parse will throw
```

Some places handle it (lines 431-433), but not consistently.

**Fix:** Wrap all JSON reads:
```javascript
function safeReadJSON(file) {
  try {
    if (!fs.existsSync(file)) return []
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    console.error(`Failed to read ${file}:`, e.message)
    return []
  }
}
```

---

### 7. **Memory Leak: SSE Clients Not Cleaned Up Properly**
**Location:** server/index.js, lines 368-451

**Issue:** 
```javascript
// Send keepalive every 30 seconds
const keepaliveInterval = setInterval(() => { ... }, 30000)

// If res.write throws, the interval may not be cleared properly
```

If many clients disconnect, old intervals might persist.

**Fix:**
```javascript
const keepaliveInterval = setInterval(() => {
  try {
    res.write(': keepalive\n\n')
  } catch (err) {
    clearInterval(keepaliveInterval)
    sseClients.get(userId)?.delete(client)
    res.end()
  }
}, 30000)

// Add error handler to res object
res.on('error', () => {
  clearInterval(keepaliveInterval)
  sseClients.get(userId)?.delete(client)
})
```

---

### 8. **Data Race: Concurrent File Writes**
**Location:** server/index.js, throughout

**Issue:** If multiple requests modify `devices.json` simultaneously:
```javascript
const devices = readJSON(DEVICES_FILE)      // Read
// ... process ...
writeJSON(DEVICES_FILE, devices)            // Write
```

Two concurrent requests could:
1. Both read the file
2. Both modify it
3. Both write it back
4. Second write overwrites first write (data loss)

**Fix:** Implement simple file locking or use database:
```javascript
// Option 1: Simple queue
const writeQueue = {}
function writeJSONSafe(file, data) {
  if (!writeQueue[file]) writeQueue[file] = Promise.resolve()
  writeQueue[file] = writeQueue[file].then(() => {
    return new Promise(resolve => {
      fs.writeFileSync(file, JSON.stringify(data, null, 2))
      resolve()
    })
  })
  return writeQueue[file]
}

// Option 2: Use database (recommended for production)
```

---

### 9. **No Rate Limiting on Auth Endpoints**
**Location:** server/index.js, lines 273-355 (login/register)

**Issue:** No rate limiting on:
- `/auth/register` - Could be abused for spam account creation
- `/auth/login` - Vulnerable to brute force attacks

**Fix:**
```javascript
import rateLimit from 'express-rate-limit'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts, please try again later'
})

app.post('/auth/login', loginLimiter, async (req, res) => { ... })
```

---

### 10. **JWT Token Expiration Inconsistency**
**Location:** server/index.js, lines 320, 341, 353

**Issue:** Token expiration times vary:
- Regular users: `expiresIn: '1h'` (line 320)
- Admin: `expiresIn: '24h'` (line 353)
- Device token: `expiresIn: '1y'` (line 845)

**Problem:**
- 1-hour expiration for regular users is too short (mobile app sessions break)
- 1-year expiration for device token is too long (security risk)
- Users and admin have different expiration (inconsistent)

**Fix:**
```javascript
const TOKEN_CONFIG = {
  user: { expiresIn: '7d' },      // 7 days
  admin: { expiresIn: '24h' },    // 24 hours (shorter for admin for security)
  device: { expiresIn: '1y' }     // 1 year (device tokens are lower risk)
}
```

---

### 11. **Missing CORS Configuration for Device/Mobile Apps**
**Location:** server/index.js, line 115

**Issue:**
```javascript
app.use(cors())  // Allows ALL origins
```

This is too permissive. Any website can call your API.

**Fix:**
```javascript
const ALLOWED_ORIGINS = [
  'https://patak-portal-production.up.railway.app',
  'http://localhost:3000',
  'http://192.168.1.100:8080'
]

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))
```

---

## 🟡 LOWER PRIORITY ISSUES

### 12. **Inconsistent Error Messages**
**Location:** Throughout server/index.js

Some endpoints return `{ error: '...' }`, others return `{ message: '...' }`

Example inconsistencies:
```javascript
res.status(400).json({ error: 'Missing fields' })      // Lines 273, 343
res.json({ message: 'Password changed successfully' })  // Line 363
res.status(500).json({ error: 'Server error' })        // Various places
```

**Fix:** Standardize to always use `error` for errors, `success` or `message` for success responses.

---

### 13. **No Logging for Sensitive Operations**
**Location:** Some endpoints missing logs

Example:
```javascript
app.post('/auth/login', async (req, res) => {
  // No logging of login attempts
  // If someone tries username 100 times, there's no audit trail
```

**Fix:** Add comprehensive logging for:
- All authentication attempts (success and failure)
- Device linking operations
- Payment operations
- Admin actions

---

### 14. **Missing Content-Type Validation**
**Location:** server/index.js, multiple POST endpoints

**Issue:** Accepts any Content-Type. Malformed requests could cause issues.

**Fix:**
```javascript
app.post('/api/readings', (req, res, next) => {
  if (req.get('content-type') !== 'application/json') {
    return res.status(400).json({ error: 'Content-Type must be application/json' })
  }
  next()
}, async (req, res) => { ... })
```

---

### 15. **Database Integrity Issues with Large Files**
**Location:** Data directory operations

**Issue:** All data stored as JSON files with NO transactions:
- If server crashes during write, file could be corrupted
- No backup mechanism
- No version control for data changes
- Slow performance as files grow

**Fix (Long-term):** Migrate to proper database (MongoDB, PostgreSQL)

**Short-term mitigation:**
```javascript
function writeJSONSafe(file, data) {
  const tempFile = file + '.tmp'
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2))
  fs.renameSync(tempFile, file) // Atomic operation
}
```

---

### 16. **No Pagination for Large Data Sets**
**Location:** server/index.js, `/api/houses`, `/api/readings`, etc.

**Issue:** Returns ALL readings/devices without pagination. As data grows:
- Response times become slow
- Memory usage increases
- Clients load unnecessarily large payloads

**Fix:** Add pagination:
```javascript
app.get('/api/readings/:deviceId', authMiddleware, (req, res) => {
  const { page = 1, limit = 100 } = req.query
  const start = (page - 1) * limit
  const end = start + limit
  
  const readings = allReadings.filter(...).slice(start, end)
  res.json({ 
    readings,
    pagination: { page, limit, total: allReadings.length }
  })
})
```

---

### 17. **Mobile App - Navigation State Issues**
**Location:** mobile/App.js, lines 38-85

**Issue:** Screen navigation doesn't properly save state:
```javascript
if (!screen) {
  return <LoadingScreen /> // But how does screen become set?
}
```

When navigating between screens, the full component tree might re-render, losing state.

**Fix:** Use React Navigation's built-in state management instead of useState.

---

### 18. **ESP32 Firmware - WiFi Credentials in Source Code**
**Location:** WaterESP32_network.ino, lines 278-279

**CRITICAL Security Issue:**
```cpp
const char* WIFI_SSID = "PLDTHOMEFIBRBsDd4";      // EXPOSED
const char* WIFI_PASS = "PLDTWIFITd5XU";         // EXPOSED
```

WiFi password is visible in firmware and in GitHub!

**Fix:**
1. Use Preferences storage for credentials
2. Add WiFi provisioning via BLE or web interface
3. Remove hardcoded credentials
4. If code is public: **CHANGE THESE PASSWORDS IMMEDIATELY**

```cpp
// Instead of hardcoded:
Preferences prefs;
String wifiSSID = prefs.getString("wifiSSID", "");
String wifiPass = prefs.getString("wifiPass", "");

if (wifiSSID.length() == 0) {
  // Start BLE provisioning mode or web config
}
```

---

### 19. **ESP32 Firmware - Backend URL Exposed**
**Location:** WaterESP32_network.ino, line 269

```cpp
const char* BACKEND_URL = "https://patak-portal-production.up.railway.app";
```

Not as critical but exposes your backend infrastructure.

---

### 20. **Missing Input Sanitization - Potential XSS**
**Location:** React components (AdminDashboard.tsx, etc.)

**Issue:** User data displayed without sanitization:
```tsx
<Text>{user.username}</Text>  // If username contains JS, could be issue
```

While React auto-escapes by default, be careful with:
```tsx
<div dangerouslySetInnerHTML={{ __html: userData }} />
```

**Fix:** Always sanitize HTML:
```javascript
import DOMPurify from 'dompurify'
const clean = DOMPurify.sanitize(userInput)
```

---

## ✅ WHAT'S WORKING WELL

1. ✅ **Good logging infrastructure** - Detailed console logs for debugging
2. ✅ **Password hashing** - Using bcrypt (except for hardcoded admin hash)
3. ✅ **JWT implementation** - Proper token generation
4. ✅ **Device status tracking** - Online/offline detection
5. ✅ **Real-time updates** - SSE implementation for live readings
6. ✅ **Admin dashboard** - Comprehensive user/device management

---

## 📋 RECOMMENDED FIX PRIORITY

### Immediate (This Week)
1. ✅ Fix billing rate inconsistency (#1) - COMPLETE
2. Add input validation for ESP32 readings (#2)
3. Change exposed WiFi credentials (#18)
4. Add authentication to device endpoints (#3)

### Short-term (This Month)
5. Fix data race conditions (#8)
6. Add rate limiting (#9)
7. Fix JWT expiration times (#10)
8. Implement CORS whitelist (#11)
9. Add error handling consistency (#5, #12)

### Medium-term (Next 2 Months)
10. Fix admin credentials management (#4)
11. Migrate to database (#15)
12. Add pagination (#16)
13. Implement mobile navigation state properly (#17)

### Long-term (Ongoing)
14. Regular security audits
15. Implement comprehensive logging (#13)
16. Add input validation everywhere (#14)
17. Implement backup/disaster recovery

---

## 🧪 TESTING RECOMMENDATIONS

- [ ] Test concurrent device reading submissions
- [ ] Test with corrupted JSON files
- [ ] Test SSE client disconnections
- [ ] Test billing calculations with various rates
- [ ] Brute force test login endpoint
- [ ] Test with devices sending negative/zero readings

---

Generated: 2026-01-18
