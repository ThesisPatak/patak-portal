Server (auth + device registry)

Run the simple Express server which provides:
- `POST /auth/register` -> registers a new user and returns a JWT
- `POST /auth/login` -> logs in and returns a JWT
- `POST /devices/register` -> registers a device to the authenticated user
- `POST /devices/heartbeat` -> device heartbeat (auth by deviceId+deviceKey)

Install dependencies at project root and run the server:

```bash
npm install
npm run start:server
```

For development set `JWT_SECRET` env var to a secure value.
# PATAK Minimal Server

Quick start:

1. cd server
2. npm install
3. npm start

Endpoints:
- POST /auth/register { email, password }
- POST /auth/login { email, password } -> { token }
- POST /devices/register (Authorization: Bearer <token>) { deviceId, deviceKey }
- POST /devices/heartbeat { deviceId, deviceKey }
- GET /users/:id/devices (Authorization: Bearer <token>)

This is a minimal example for local development only. Use TLS and secure secrets in production.
