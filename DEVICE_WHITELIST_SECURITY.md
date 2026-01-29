# Device Whitelist Security Implementation

## Overview
Implemented a **whitelist-based device registration system** to prevent users from registering random/non-existent devices. Only pre-configured devices can be linked to user accounts.

---

## Changes Made

### 1. Added ALLOWED_DEVICES Whitelist
**Location:** [server/index.js](server/index.js#L24-L31)

```javascript
const ALLOWED_DEVICES = [
  { deviceId: 'ESP32-001', houseId: 'house1', location: 'Main House' },
  { deviceId: 'ESP32-002', houseId: 'house2', location: 'Secondary House' },
  { deviceId: 'ESP32-003', houseId: 'house3', location: 'Office' },
  { deviceId: 'ESP32-004', houseId: 'house4', location: 'Warehouse' },
  { deviceId: 'ESP32-005', houseId: 'house5', location: 'Garden House' }
]
```

**Purpose:** Defines all physically deployed devices that users can register.

---

### 2. Enhanced `/devices/register` Endpoint
**Location:** [server/index.js lines 1147-1179](server/index.js#L1147-L1179)

**Validations Added:**

1. **Whitelist Check**
   - Rejects any `deviceId` not in `ALLOWED_DEVICES`
   - Returns list of available devices in error response
   - Error: 400 Bad Request

2. **Ownership Check**
   - Prevents multiple users from claiming same device
   - Returns clear error if device already claimed by another user
   - Error: 409 Conflict

3. **Auto-assign House ID**
   - Uses device's pre-configured `houseId` from whitelist
   - Stores device location for reference

**Example Error Response:**
```json
{
  "error": "Device 'RANDOM-123' is not registered in the system",
  "availableDevices": [
    { "deviceId": "ESP32-001", "location": "Main House" },
    { "deviceId": "ESP32-002", "location": "Secondary House" }
  ]
}
```

---

### 3. New Endpoints for Device Management

#### `GET /devices/available` (Authenticated)
**Purpose:** List all devices and their availability status

**Response:**
```json
{
  "availableDevices": [
    {
      "deviceId": "ESP32-001",
      "location": "Main House",
      "houseId": "house1",
      "available": true,
      "claimedBy": null,
      "claimedAt": null
    },
    {
      "deviceId": "ESP32-002",
      "location": "Secondary House",
      "houseId": "house2",
      "available": false,
      "claimedBy": "user-123",
      "claimedAt": "2026-01-29T10:30:00Z"
    }
  ]
}
```

#### `GET /devices/my-devices` (Authenticated)
**Purpose:** Get all devices owned by current user

**Response:**
```json
{
  "devices": [
    {
      "deviceId": "ESP32-001",
      "ownerUserId": "user-123",
      "houseId": "house1",
      "location": "Main House",
      "status": "registered",
      "lastSeen": "2026-01-29T10:35:00Z",
      "createdAt": "2026-01-29T10:00:00Z"
    }
  ]
}
```

---

### 4. Existing Device Validation (Already in Place)
**Location:** [server/index.js lines 882-885](server/index.js#L882-L885)

The `/api/readings` endpoint already validates that:
- Device exists in `devices.json` before accepting readings
- Only registered devices can submit data
- Prevents phantom readings from unregistered devices

---

## Security Improvements

| Issue | Before | After |
|-------|--------|-------|
| **Random device registration** | ✗ Accepted any ID | ✓ Only whitelisted devices |
| **Multiple users claiming same device** | ✗ First user wins | ✓ Conflict error returned |
| **Phantom readings** | ✗ Possible from fake devices | ✓ Device must exist + be registered |
| **Device discovery** | ✗ Users guessed IDs | ✓ API shows available devices |
| **Data integrity** | ✗ Database pollution | ✓ Only real devices allowed |

---

## Testing

### Test Case 1: Register Non-existent Device
```bash
curl -X POST http://localhost:4000/devices/register \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"FAKE-DEVICE"}'
```

**Expected Response (400):**
```json
{
  "error": "Device 'FAKE-DEVICE' is not registered in the system",
  "availableDevices": [...]
}
```

### Test Case 2: Register Valid Device
```bash
curl -X POST http://localhost:4000/devices/register \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"ESP32-001"}'
```

**Expected Response (201):**
```json
{
  "device": {
    "deviceId": "ESP32-001",
    "owner": "user-123",
    "houseId": "house1"
  },
  "deviceToken": "eyJhbG..."
}
```

### Test Case 3: Second User Claims Already-Claimed Device
```bash
curl -X POST http://localhost:4000/devices/register \
  -H "Authorization: Bearer <other_user_token>" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"ESP32-001"}'
```

**Expected Response (409):**
```json
{
  "error": "Device 'ESP32-001' is already claimed by another user"
}
```

---

## Configuration

To add/remove devices, edit `ALLOWED_DEVICES` in [server/index.js](server/index.js#L24-L31):

```javascript
const ALLOWED_DEVICES = [
  { deviceId: 'DEVICE-ID', houseId: 'house-ref', location: 'Physical Location' },
  // Add more devices here
]
```

**Fields:**
- `deviceId`: Unique identifier (e.g., ESP32 MAC address or serial)
- `houseId`: Reference to house/location in system
- `location`: Human-readable description

---

## Migration Notes

- Existing registered devices in `devices.json` are preserved
- If a registered device's ID is NOT in `ALLOWED_DEVICES`, readings will fail at `/api/readings` validation
- Admin should verify all active devices are in the whitelist before deploying

---

## Future Enhancements

1. **Database-driven whitelist:** Store allowed devices in database instead of hardcoded
2. **Device approval workflow:** Admin approves new devices before users can claim
3. **Hardware serial binding:** Link device token to ESP32 MAC address
4. **Device transfer:** Allow users to transfer devices to other users with admin approval
5. **Device revocation:** Admin can disable compromised devices
