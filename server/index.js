// All imports at the very top
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { fileURLToPath } from 'url';

// App initialization
const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const READINGS_FILE = path.join(DATA_DIR, 'readings.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const ADMIN_USERS = [process.env.ADMIN_USER || 'admin'];

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  if (!fs.existsSync(DEVICES_FILE)) fs.writeFileSync(DEVICES_FILE, JSON.stringify([]));
  if (!fs.existsSync(READINGS_FILE)) fs.writeFileSync(READINGS_FILE, JSON.stringify([]));
}

function readJSON(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function writeJSON(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = h.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = h.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!ADMIN_USERS.includes(payload.username)) return res.status(403).json({ error: 'Admin only' });
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

ensureDataFiles();
app.use(express.static(path.join(__dirname, 'public')));

// Admin-only endpoint to list all users (for deployment/admin verification)
app.get('/admin/users', adminOnly, (req, res) => {
  const users = readJSON(USERS_FILE);
  const safeUsers = users.map(({ passwordHash, ...u }) => u);
  res.json({ users: safeUsers });
});

// Accept ESP32 readings (no auth, public endpoint)
app.post('/api/readings', (req, res) => {
  const { house, totalLiters, cubicMeters, timestamp } = req.body || {};
  if (!house || typeof totalLiters !== 'number' || typeof cubicMeters !== 'number') {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }
  const readings = readJSON(READINGS_FILE);
  const reading = {
    id: generateId('r'),
    house,
    totalLiters,
    cubicMeters,
    timestamp: timestamp || new Date().toISOString(),
    receivedAt: new Date().toISOString()
  };
  readings.push(reading);
  writeJSON(READINGS_FILE, readings);
  res.json({ ok: true, reading });
});

app.get('/api/readings/:houseId', (req, res) => {
  const { houseId } = req.params;
  const readings = readJSON(READINGS_FILE);
  const filtered = (Array.isArray(readings) ? readings : readings.readings || []).filter(r => (r.houseId || r.house) == houseId);
  const byDevice = {};
  for (const r of filtered) {
    const dev = r.deviceId || 'unknown';
    if (!byDevice[dev]) byDevice[dev] = [];
    byDevice[dev].push(r);
  }
  res.json({ houseId, byDevice });
});

app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const users = readJSON(USERS_FILE);
  if (users.find(u => u.username === username)) return res.status(409).json({ error: 'User exists' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: generateId('user'), username, passwordHash, createdAt: new Date().toISOString() };
  users.push(user);
  writeJSON(USERS_FILE, users);
  // Automatically assign a device to this user
  const devices = readJSON(DEVICES_FILE);
  const deviceId = generateId('esp32');
  const deviceToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(deviceToken, 10);
  const device = { deviceId, tokenHash, ownerUserId: user.id, houseId: user.id, meta: { assignedAt: new Date().toISOString() }, status: 'registered', lastSeen: null, createdAt: new Date().toISOString() };
  devices.push(device);
  writeJSON(DEVICES_FILE, devices);
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
  res.status(201).json({ token, user: { id: user.id, username: user.username }, device: { deviceId, deviceToken } });
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, user: { id: user.id, username: user.username } });
});

app.get('/api/houses', authMiddleware, (req, res) => {
  const userId = req.user.userId;
  const devices = readJSON(DEVICES_FILE);
  const readings = readJSON(READINGS_FILE);
  
  // Get all devices owned by this user
  const userDevices = devices.filter(d => d.ownerUserId === userId);
  
  // Group readings by house/device
  const summary = {};
  for (const device of userDevices) {
    const houseId = device.houseId || device.ownerUserId;
    if (!summary[houseId]) {
      summary[houseId] = {
        deviceId: device.deviceId,
        cubicMeters: 0,
        totalLiters: 0,
        last: null,
        lastUpdated: null
      };
    }
    
    // Get latest reading for this device
    const deviceReadings = readings.filter(r => (r.deviceId || r.houseId) === device.deviceId);
    if (deviceReadings.length > 0) {
      const latest = deviceReadings[deviceReadings.length - 1];
      summary[houseId].cubicMeters = latest.data?.cubicMeters || latest.cubicMeters || 0;
      summary[houseId].totalLiters = latest.data?.totalLiters || latest.totalLiters || 0;
      summary[houseId].last = latest;
      summary[houseId].lastUpdated = latest.receivedAt;
    }
  }
  
  res.json({ summary });
});

app.get('/users/:id/devices', authMiddleware, (req, res) => {
  const { id } = req.params;
  if (req.user.userId !== id) return res.status(403).json({ error: 'Forbidden' });
  const devices = readJSON(DEVICES_FILE);
  const mine = devices.filter(d => d.ownerUserId === id);
  res.json({ devices: mine });
});

app.post('/devices/register', authMiddleware, async (req, res) => {
  const { deviceId, houseId, meta } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  const devices = readJSON(DEVICES_FILE);
  const exists = devices.find(d => d.deviceId === deviceId);
  if (exists) {
    if (exists.ownerUserId && exists.ownerUserId !== req.user.userId) return res.status(409).json({ error: 'Device owned by another user' });
    if (exists.ownerUserId === req.user.userId) return res.json({ device: { deviceId: exists.deviceId, owner: exists.ownerUserId } });
  }
  const deviceToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(deviceToken, 10);
  const device = { deviceId, tokenHash, ownerUserId: req.user.userId, houseId: houseId || null, meta: meta || {}, status: 'registered', lastSeen: null, createdAt: new Date().toISOString() };
  const filtered = devices.filter(d => d.deviceId !== deviceId);
  filtered.push(device);
  writeJSON(DEVICES_FILE, filtered);
  res.status(201).json({ device: { deviceId: device.deviceId, owner: device.ownerUserId, houseId: device.houseId }, deviceToken });
});

async function verifyDeviceToken(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing device token' });
  const token = h.slice(7);
  const devices = readJSON(DEVICES_FILE);
  for (const d of devices) {
    if (!d.tokenHash) continue;
    try {
      const ok = await bcrypt.compare(token, d.tokenHash);
      if (ok) {
        req.device = d;
        return next();
      }
    } catch (e) { /* ignore and continue */ }
  }
  return res.status(401).json({ error: 'Invalid device token' });
}

app.post('/devices/heartbeat', verifyDeviceToken, async (req, res) => {
  const device = req.device;
  device.lastSeen = new Date().toISOString();
  device.lastIP = req.ip;
  device.status = 'online';
  const devices = readJSON(DEVICES_FILE).filter(d => d.deviceId !== device.deviceId);
  devices.push(device);
  writeJSON(DEVICES_FILE, devices);
  const payload = req.body || {};
  const readings = readJSON(READINGS_FILE);
  const reading = {
    id: generateId('r'),
    deviceId: device.deviceId,
    houseId: device.houseId || device.ownerUserId,
    timestamp: payload.timestamp || Date.now(),
    data: payload.data || { cubicMeters: payload.cubicMeters, totalLiters: payload.totalLiters },
    receivedAt: new Date().toISOString()
  };
  readings.push(reading);
  writeJSON(READINGS_FILE, readings);
  res.json({ ok: true, readingId: reading.id });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on http://0.0.0.0:${PORT}`));
