# User Approval Status Check Implementation

## Overview
Added comprehensive user account approval status checks to all user-facing endpoints to ensure that only approved users can access sensitive features like device registration, payment submission, and reading access.

## Changes Made

### 1. Fixed Critical Build Error
**File:** `mobile/screens/BillingHistoryScreen.js`
- **Issue:** Duplicate `export default function BillingHistoryScreen` declarations causing syntax error
- **Fix:** Removed the incomplete/duplicate first declaration (lines 8-179)
- **Result:** Build error resolved - component now exports correctly

### 2. Added Reusable Helper Function
**File:** `server/index.js` (Lines 471-505)
- **Function:** `checkUserApprovalStatus(userId, logPrefix)`
- **Purpose:** Centralized approval status validation for all endpoints
- **Returns:** Object with `{ isApproved: boolean, statusCode: number, error: string }`
- **Features:**
  - Auto-approves existing users without status field (backward compatibility)
  - Handles three status states: `approved`, `pending`, `rejected`
  - Provides appropriate HTTP status codes and error messages
  - Includes logging for debugging

### 3. Updated User-Facing Endpoints with Approval Checks

#### Reading Endpoints
1. **`GET /api/readings/:deviceId`** (Line 1114)
   - Prevents reading access until account approved
   - Returns 403 Forbidden for pending accounts
   - Returns appropriate error message

2. **`GET /api/user/readings`** (Line 1148)
   - Same approval check as device readings
   - Filters readings by user's approved account status

#### Device Management Endpoints
3. **`POST /devices/send-token`** (Line 1455)
   - Requires approval before sending token to ESP32
   - Prevents device linking for unapproved accounts
   - Returns 403 if account pending or rejected

4. **`POST /devices/link`** (Line 1511)
   - Requires approval before creating pending device tokens
   - Cloud-based device linking blocked for unapproved users
   - Returns clear error messages

#### Payment Endpoints
5. **`POST /api/paymongo/create-checkout`** (Line 2052)
   - Prevents payment checkout creation for unapproved accounts
   - Ensures only approved users can initiate payments
   - Returns 403 with appropriate error message

6. **`POST /api/gcash/submit-payment`** (Line 2314)
   - Prevents GCash payment submissions from unapproved accounts
   - All payment submissions blocked until account approval
   - Returns 403 Forbidden for pending/rejected accounts

### 4. Existing Approval Status Checks (Already Implemented)
The following endpoints already had approval status checks:
- **`POST /auth/register`** - New users created with `status: 'pending'`
- **`POST /auth/login`** - Login blocked for pending/rejected users
- **`POST /devices/register`** - Device registration blocked for unapproved users (lines 1220-1229)
- **`GET /api/houses`** - House data hidden from unapproved users (lines 750-754)

## Approval Status Flow

### User States
1. **pending** - User registered but not yet approved by admin
2. **approved** - User approved and can access all features
3. **rejected** - User rejected by admin, cannot use account
4. **undefined/null** - Existing users auto-migrated to 'approved' (backward compatibility)

### API Responses

#### For Pending Accounts
```json
{
  "error": "Account pending admin approval. Please wait for the admin to approve your registration."
}
```
Status Code: 403 Forbidden

#### For Rejected Accounts
```json
{
  "error": "Your account registration was rejected by admin."
}
```
Status Code: 403 Forbidden

## Security Benefits

1. **Registration Control** - Admins can review and approve new registrations
2. **Device Protection** - Unapproved users cannot register or control devices
3. **Payment Protection** - Only approved accounts can submit payments
4. **Data Access Control** - Reading data only accessible to approved users
5. **Clear User Feedback** - Descriptive error messages for rejected/pending accounts

## Testing Endpoints

### Test Pending Account Flow
```bash
# 1. Register new user (account created as pending)
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass1234"}'

# 2. Try to access device features (should fail)
curl -X GET http://localhost:4000/api/readings/ESP32-001 \
  -H "Authorization: Bearer <token>"
# Expected: 403 Forbidden - "Account pending admin approval..."

# 3. Admin approves account
curl -X POST http://localhost:4000/api/admin/users/testuser/approve \
  -H "Authorization: Bearer <admin-token>"

# 4. User can now access features
curl -X GET http://localhost:4000/api/readings/ESP32-001 \
  -H "Authorization: Bearer <token>"
# Expected: 200 OK - readings data
```

## Admin Management Endpoints

Existing admin endpoints for approval management:
- **`POST /api/admin/users/:username/approve`** - Approve pending user
- **`POST /api/admin/users/:username/reject`** - Reject pending user
- **`GET /api/admin/users`** - View all users and their approval status
- **`GET /api/admin/dashboard`** - View pending approvals in dashboard

## Backward Compatibility

- Existing users without `status` field are auto-approved on first login/access
- No migration script needed - field added automatically
- Existing functionality preserved for approved accounts

## Implementation Summary

| Component | Status | Details |
|-----------|--------|---------|
| Helper Function | ✅ Complete | `checkUserApprovalStatus()` added and working |
| Reading Endpoints | ✅ Complete | 2 endpoints updated |
| Device Endpoints | ✅ Complete | 2 endpoints updated |
| Payment Endpoints | ✅ Complete | 2 endpoints updated |
| Error Messages | ✅ Complete | Clear user-facing feedback |
| Logging | ✅ Complete | Debug logging for admin troubleshooting |
| Build Errors | ✅ Fixed | BillingHistoryScreen duplicate export resolved |

## Notes

- All endpoints use consistent error response format
- Approval check is the first validation (before other logic)
- Logging includes endpoint prefix for easy tracing
- Helper function can be easily extended for future endpoints
- No database migrations needed - JSON-based system

