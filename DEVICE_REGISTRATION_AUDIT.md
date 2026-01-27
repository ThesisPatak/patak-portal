# Device Registration and ESP32 Code Audit

## Summary
Found **7 issues** with device registration and ESP32 linking. The main flow works but has fragility points and security concerns.

---

## ✅ WORKING: Device Linking Flow

The cloud-based device linking actually **WORKS**:
1. User clicks "LINK DEVICE" in app
2. App calls `POST /devices/link` with deviceId
3. Server stores token in `device.pendingToken`
4. ESP32 calls `pollForToken()` every 30 seconds
5. ESP32 claims token from `GET /devices/claim-token`
6. ESP32 saves token to flash storage (Preferences)
7. ESP32 sends readings with `Bearer ${token}` header

---

## 🔴 CRITICAL ISSUES

### ISSUE 1: Fragile String-Based JSON Parsing in ESP32

**Location:** [WaterESP32_network.ino lines 348-365](WaterESP32_network.ino#L348-L365)

**Problem:**
```cpp
int tokenStart = response.indexOf("\"token\":\"") + 9;
int tokenEnd = response.indexOf("\"", tokenStart);
if (tokenStart > 8 && tokenEnd > tokenStart) {
  DEVICE_TOKEN = response.substring(tokenStart, tokenEnd);
}
```

**Risks:**
- Silently fails if JSON format changes
- Breaks on escaped quotes in token: `"token":"abc\"def"` → gets `abc\` only
- No error logging when parsing fails
- Whitespace in response breaks parsing
- No validation that extracted string is a valid token

**Impact:** Device gets corrupted token, readings rejected with 401 errors

**Fix:** Use ArduinoJson library for robust parsing with error handling

---

### ISSUE 2: Unencrypted Token Transmission on Local WiFi

**Location:** [server/index.js lines 1188-1196](server/index.js#L1188-L1196)

**Problem:**
```javascript
const url = `http://${espIP}:${port}/api/token`  // ← HTTP not HTTPS
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: deviceToken })  // ← Sent in plaintext
})
```

**Risks:**
- Anyone on local WiFi can sniff the token with Wireshark
- Attacker can replay token to send fake readings from other meters
- Device credentials exposed on every local linking attempt

**Impact:** Security vulnerability for multi-user WiFi networks

**Fix:** Either use HTTPS on local network OR require manual confirmation on ESP32 display

---

### ISSUE 3: Missing Device Existence Validation on Reading Submit

**Location:** [server/index.js lines 850-880](server/index.js#L850-L880)

**Problem:**
```javascript
// Server only validates JWT signature, NOT if device actually exists
const payload = jwt.verify(token, JWT_SECRET)
if (payload.type === 'device') {
  deviceId = payload.deviceId
}
// ✗ Missing: Check if deviceId exists in devices.json
```

**Risks:**
- Any leaked/stolen token can submit readings for fake devices
- No audit trail of which device sent each reading
- Database pollution with phantom readings
- Admin can't control which devices are allowed to submit data

**Impact:** Data integrity and security vulnerability

**Fix:** Add device existence check before accepting readings:
```javascript
const devices = readJSON(DEVICES_FILE)
const device = devices.find(d => d.deviceId === deviceId)
if (!device) {
  return res.status(403).json({ error: 'Device not registered' })
}
```

---

### ISSUE 4: No Automatic Device Registration During Account Creation

**Location:** 
- [RegisterScreen.js](mobile/screens/RegisterScreen.js#L36-L51) (user registration)
- [server/index.js lines 439-500](server/index.js#L439-L500) (`/auth/register`)
- [server/index.js lines 1106-1150](server/index.js#L1106-L1150) (`/devices/register`)

**Problem:**
- User registers account via mobile app
- App only creates user account, NOT device record
- Device must be manually registered later
- Multi-step process confuses users

**Current Flow (manual):**
1. User creates account: `POST /auth/register`
2. User must manually run `POST /devices/register` with hardcoded deviceId
3. Device registration is a separate, undiscoverable step

**Impact:** Users don't know how to link devices; abandoned registrations

**Fix:** Auto-register device during account creation:
```javascript
// In /auth/register endpoint, after creating user:
const device = {
  deviceId: `device-${user.id}`,
  ownerUserId: user.id,
  status: 'registered',
  createdAt: new Date().toISOString()
}
devices.push(device)
writeJSON(DEVICES_FILE, devices)
// Return device info to client
```

---

## 🟡 MEDIUM ISSUES

### ISSUE 5: Hardcoded WiFi Credentials in ESP32

**Location:** [WaterESP32_network.ino lines 172-177](WaterESP32_network.ino#L172-L177)

**Problem:**
```cpp
const char* WIFI_SSID = "PLDTHOMEFIBRBsDd4";
const char* WIFI_PASS = "PLDTWIFITd5XU";
```

**Issues:**
- Every device has same WiFi credentials (not portable)
- Different deployments need different WiFi networks
- Can't change without reflashing entire device
- Credentials in source code is security anti-pattern

**Fix:** Make configurable via serial command (already have infrastructure):
```cpp
// Extend handleSerial() to support:
// "wifi SSID password" → Store in Preferences, reconnect
```

---

### ISSUE 6: Hardcoded Device ID

**Location:** [WaterESP32_network.ino line 45](WaterESP32_network.ino#L45)

**Problem:**
```cpp
String DEVICE_ID = "ESP32-001";  // ← Same for all devices!
```

**Issues:**
- All ESP32s would have identical ID unless manually edited
- No auto-discovery mechanism
- Comment says "use MAC address" but not implemented
- Multi-device deployments will collide

**Impact:** Can't deploy >1 ESP32 without modifying source code

**Fix:** Auto-detect MAC address:
```cpp
void setup() {
  // Use MAC address as device ID if available
  uint8_t mac[6];
  WiFi.macAddress(mac);
  DEVICE_ID = String(mac[3], HEX) + String(mac[4], HEX) + String(mac[5], HEX);
  // Or: DEVICE_ID = "ESP32-" + String((uint32_t)ESP.getEfuseMac(), HEX);
}
```

---

### ISSUE 7: No Real-Time Feedback on Device Linking

**Location:** Mobile app UI (no status component)

**Problem:**
- User clicks "LINK DEVICE" and sees no response
- No indication that backend is waiting for ESP32
- No timeout or retry mechanism
- Users don't know if linking succeeded

**Missing Features:**
1. Status indicator showing: "Waiting for device to claim token..."
2. Timeout message: "Device didn't respond in 2 minutes"
3. Success confirmation: "Device successfully linked!"
4. Error details: Why linking failed (device not found, etc)

**Impact:** Poor UX, users think app is broken

**Fix:** Add polling status endpoint and UI feedback:
```javascript
// Server endpoint to check device status
GET /devices/{deviceId}/status
→ Returns: { linked: true/false, lastSeen: "timestamp" }

// Mobile app polls this and shows status
```

---

## 🟢 LOW PRIORITY

### ISSUE 8: Excessive Token Poll Logging

**Location:** [WaterESP32_network.ino line 579](WaterESP32_network.ino#L579)

**Minor issue:** Token polling happens every 30 seconds and logs to serial even when no token is pending. Creates console spam.

**Fix:** Only log when polling starts or token is received

---

## Summary Table

| Priority | Issue | Impact | Fix Time |
|----------|-------|--------|----------|
| 🔴 CRITICAL | JSON parsing fragility | Device failures, silent errors | 30 min |
| 🔴 CRITICAL | Unencrypted token transmission | Security vulnerability | 20 min |
| 🔴 CRITICAL | Missing device validation | Data integrity, security | 15 min |
| 🔴 HIGH | No auto device registration | Poor UX, broken onboarding | 1 hour |
| 🟡 MEDIUM | Hardcoded WiFi credentials | Not portable | 30 min |
| 🟡 MEDIUM | Hardcoded device ID | Can't deploy >1 device | 20 min |
| 🟡 MEDIUM | No linking feedback | Poor UX | 1 hour |
| 🟢 LOW | Excessive poll logging | Console spam | 5 min |

---

## Recommended Fix Order

1. **Add device validation to `/api/readings`** (15 min) ← Do first, easy win
2. **Fix JSON parsing to use ArduinoJson** (30 min) ← Prevents silent failures
3. **Auto-register device on account creation** (1 hour) ← Fixes onboarding
4. **Add device status endpoint + feedback UI** (1 hour) ← Improves UX
5. **Make WiFi/DeviceID configurable** (1 hour) ← Enables multi-device deployments
6. **Fix unencrypted token transmission** (20 min) ← Security hardening

---

## Testing the Current Flow

To test if device linking works today:

```bash
# 1. Register user account
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'

# 2. Save the returned token, then register device
TOKEN="..." 
curl -X POST http://localhost:4000/devices/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"ESP32-001"}'

# 3. Link the device
curl -X POST http://localhost:4000/devices/link \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"ESP32-001"}'

# 4. ESP32 should now claim the token and start sending readings
# Check logs: tail -f server.log | grep "CLAIM-TOKEN"
```
