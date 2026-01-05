# Patak Mobile

Quick scaffold for a minimal Expo app to let each house view usage.

Run locally:

```bash
cd mobile
npm install
npx expo start
```

Notes:
- The API base URL is configured in `mobile/api/Api.js`. For Android emulator use `http://10.0.2.2:3000`.
- Endpoints assumed: `POST /login` (body {houseId}) returns `{ token }`; `GET /dashboard` and `GET /usage` require `Authorization: Bearer <token>` and return JSON.
- Update `BASE_URL` in `mobile/api/Api.js` to match your backend.

Want me to wire this to your actual server endpoints, add navigation, or convert to TypeScript?
