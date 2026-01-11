# Production Sync Fix - Mobile & Web App Consistency

## Problem
When registering users from the mobile app, the web dashboard was not displaying the newly registered accounts. This was caused by:

1. **Mobile app** had a manual server URL override field that could be set to `localhost` or custom URLs
2. **Web app** was hardcoded to always use the Railway production server
3. If a user registered via mobile using a custom/local server URL, it wouldn't sync with the web app's Railway database

## Solution Applied
Locked the mobile app to **always use Railway production** in production builds:

### Changes Made:

#### 1. `/mobile/api/Api.js`
- **Removed**: `serverBaseUrl` variable and `setServerUrl()` function
- **Removed**: `customServerUrl` parameter from `login()` method
- **Locked**: Hardcoded `DEFAULT_SERVER_URL` to `'https://patak-portal-production.up.railway.app'`
- **Result**: Mobile app can no longer override the server URL

#### 2. `/mobile/screens/LoginScreen.js`
- **Removed**: `serverUrl` state variable
- **Removed**: Server URL auto-detection on component mount
- **Removed**: Server URL override in login handler
- **Updated**: Simplified to always use Railway (`Api.login(username, password)`)

#### 3. `/mobile/screens/RegisterScreen.js`
- **Updated**: Clarified log message to state "Registering at Railway production"
- **Locked**: Uses `Api.getServerUrl()` which always returns Railway

## Result
✅ **Mobile and web apps now use the same Railway backend**
- Users registered via mobile app are immediately visible in the web dashboard
- No more data sync issues due to different backends
- Single source of truth for user data

## For Development
If you need to test locally in the future, you would need to:
1. Temporarily modify `DEFAULT_SERVER_URL` in `/mobile/api/Api.js` to `'http://localhost:4000'`
2. Also update web app URLs to match
3. Revert before deploying to production

**Note:** Current production build is now locked to Railway only.
