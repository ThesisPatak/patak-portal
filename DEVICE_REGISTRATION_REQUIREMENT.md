# Device Registration Requirement Implementation

## Overview
The mobile app now requires users to register at least one device before accessing the dashboard. This ensures that users have a device configured to collect water usage data.

## Implementation Details

### 1. **New Screen: DeviceRegistrationScreen**
**File:** `mobile/screens/DeviceRegistrationScreen.js`

A dedicated screen that appears immediately after user login to collect:
- **Device ID** (required): A unique identifier for the device (e.g., ESP32-001, METER-001)
- **House/Location** (optional): A descriptive name for where the device is located

**Features:**
- Input validation for Device ID
- Real-time error feedback
- Loading state during registration
- Success confirmation with device details
- Option to skip (with warning alert)
- Visual design consistent with the app theme (green/blue glow effect)
- Responsive design for different screen sizes

### 2. **Updated App.js Flow**

**New State Variables:**
```javascript
const [deviceRegistered, setDeviceRegistered] = useState(false);
const [checkingDevice, setCheckingDevice] = useState(true);
```

**New Screen: 'device-check'**
- After user login, the app routes to 'device-check' instead of directly to 'dashboard'
- This screen checks the user's device registration status
- If user has no devices, it displays the DeviceRegistrationScreen
- If user has devices, it automatically navigates to the dashboard

**Flow:**
```
Login/Register → Check Device Status → 
  ├─ If No Device: Show DeviceRegistrationScreen
  │  ├─ User registers device → Dashboard
  │  └─ User skips → Dashboard (can register later)
  └─ If Has Device: Dashboard
```

### 3. **New API Function**

**Function:** `Api.checkDeviceRegistration(token)`
**File:** `mobile/api/Api.js`

Checks if a user has any registered devices:
- Makes GET request to `/devices/list` endpoint
- Returns object with:
  - `devices`: Array of device objects
  - `hasDevices`: Boolean indicating if user has at least one device

```javascript
{
  devices: [
    {
      deviceId: "ESP32-001",
      houseId: "Main House",
      owner: "user_id",
      // ... other device properties
    }
  ],
  hasDevices: true
}
```

### 4. **Device Registration Process**

When user registers a device:
1. User enters Device ID and optional House name
2. App sends POST to `/devices/register` endpoint
3. Backend validates and registers the device
4. Success alert shows device details
5. App navigates to dashboard

### 5. **User Scenarios**

**Scenario 1: New User After Registration**
```
RegisterScreen → LoginScreen credentials sent
↓
Device Check (API call to /devices/list)
↓
No devices found
↓
DeviceRegistrationScreen displayed
↓
User registers device OR skips
↓
Dashboard
```

**Scenario 2: Returning User with Device**
```
LoginScreen → Token received
↓
Device Check (API call to /devices/list)
↓
Devices found
↓
Dashboard (skip DeviceRegistrationScreen)
```

**Scenario 3: User Skips Registration**
```
DeviceRegistrationScreen with "Skip for Now" button
↓
Alert warning user they need to register later
↓
Dashboard (can access Devices screen later to register)
```

## Files Modified

1. **mobile/App.js**
   - Added DeviceRegistrationScreen import
   - Added Api import
   - Added deviceRegistered and checkingDevice state
   - Added checkDeviceRegistration() function
   - Added 'device-check' screen handling in renderContent
   - Changed login flow to route through 'device-check'

2. **mobile/api/Api.js**
   - Added checkDeviceRegistration() function to check if user has devices

3. **mobile/screens/DeviceRegistrationScreen.js** (NEW)
   - Complete device registration interface
   - Device ID and House name input fields
   - Form validation
   - Integration with Api.registerDevice()

## Error Handling

- Network errors during device check: App allows continuation but deviceRegistered stays false
- Registration timeout: User receives timeout error message
- HTTP errors: Backend error messages displayed to user
- Invalid device ID: Frontend validation prevents empty submission

## Testing Checklist

- [ ] New user can register a device after signup
- [ ] Device registration validates Device ID is not empty
- [ ] Successfully registered device takes user to dashboard
- [ ] Returning user with existing device skips registration screen
- [ ] User can skip device registration (warning alert shown)
- [ ] Error handling for network/server issues works
- [ ] Device screen still accessible from dashboard
- [ ] Logout clears device registration state

## Future Enhancements

1. Multi-device support (currently supports one device per flow)
2. Device linking after registration
3. QR code scanning for device ID
4. Device management UI improvements
5. Device status monitoring (active/inactive)
