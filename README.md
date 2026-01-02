# Water Usage Mobile App (React Native)

This is a React Native Android app for water usage monitoring. Features:
- Username/password login
- Real-time water usage and billing for the logged-in house
- Connects to your existing backend API
- Android only

## Getting Started

1. Install Node.js and npm if not already installed.
2. Install React Native CLI:
   ```bash
   npm install -g react-native-cli
   ```
3. Install Android Studio and set up an Android emulator or connect a real device.
4. You can either use your existing generated project (WaterUsageApp) or use the files in this `mobile-app` folder.

To run the app from this folder:

```bash
# install deps
npm install
# start Metro
npm run start
# in another terminal, run on Android (emulator or connected device)
npm run android
```

If you used `npx @react-native-community/cli init WaterUsageApp`, you can copy the contents of `mobile-app/src` and `mobile-app/App.js` into the generated project's `App.js` and `src/` folder respectively.


## Notes
- This app is free to build and use. Publishing to the Play Store requires a Google developer account (one-time $25 fee).
- Update API endpoints in the code to match your backend server address.

## Local Network (workspace)
- **IPv4:** 192.168.1.11
- **Subnet Mask:** 255.255.255.0
- **Default Gateway:** 192.168.1.1
