// Get all readings for a house, grouped by device
app.get('/api/readings/:houseId', (req, res) => {
  const { houseId } = req.params;
  const readings = readJSON(READINGS_FILE);
  // Accept both string and numeric houseId
  const filtered = (Array.isArray(readings) ? readings : readings.readings || []).filter(r => (r.houseId || r.house) == houseId);
  // Group by deviceId
  const byDevice = {};
  for (const r of filtered) {
    const dev = r.deviceId || 'unknown';
    if (!byDevice[dev]) byDevice[dev] = [];
    byDevice[dev].push(r);
  }
  res.json({ houseId, byDevice });
});
import express from 'express'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cors from 'cors'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json')
const READINGS_FILE = path.join(DATA_DIR, 'readings.json')

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me'

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]))
  if (!fs.existsSync(DEVICES_FILE)) fs.writeFileSync(DEVICES_FILE, JSON.stringify([]))
}

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { return [] }
}

function writeJSON(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2))
}

ensureDataFiles()

const app = express()
app.use(cors())
app.use(express.json())

// Serve a minimal web UI for account and device management
app.use(express.static(path.join(__dirname, 'public')))

function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random()*1000)}`
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' })
  const token = h.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })
  const users = readJSON(USERS_FILE)
  if (users.find(u => u.email === email)) return res.status(409).json({ error: 'User exists' })
  const passwordHash = await bcrypt.hash(password, 10)
  const user = { id: generateId('user'), email, passwordHash, createdAt: new Date().toISOString() }
  users.push(user)
  writeJSON(USERS_FILE, users)
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' })
  res.status(201).json({ token, user: { id: user.id, email: user.email } })
})

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })
  const users = readJSON(USERS_FILE)
  const user = users.find(u => u.email === email)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' })
  res.json({ token, user: { id: user.id, email: user.email } })
})

app.get('/users/:id/devices', authMiddleware, (req, res) => {
  const { id } = req.params
  if (req.user.userId !== id) return res.status(403).json({ error: 'Forbidden' })
  const devices = readJSON(DEVICES_FILE)
  const mine = devices.filter(d => d.ownerUserId === id)
  res.json({ devices: mine })
})

app.post('/devices/register', authMiddleware, async (req, res) => {
  const { deviceId, houseId, meta } = req.body || {}
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' })
  const devices = readJSON(DEVICES_FILE)
  const exists = devices.find(d => d.deviceId === deviceId)
  if (exists) {
    if (exists.ownerUserId && exists.ownerUserId !== req.user.userId) return res.status(409).json({ error: 'Device owned by another user' })
    if (exists.ownerUserId === req.user.userId) return res.json({ device: { deviceId: exists.deviceId, owner: exists.ownerUserId } })
  }
  // generate device token and store only a hash
  const deviceToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(deviceToken, 10)
  const device = { deviceId, tokenHash, ownerUserId: req.user.userId, houseId: houseId || null, meta: meta || {}, status: 'registered', lastSeen: null, createdAt: new Date().toISOString() }
  const filtered = devices.filter(d => d.deviceId !== deviceId)
  filtered.push(device)
  writeJSON(DEVICES_FILE, filtered)
  // return raw token once
  res.status(201).json({ device: { deviceId: device.deviceId, owner: device.ownerUserId, houseId: device.houseId }, deviceToken })
})
// middleware to verify device token from Authorization header
async function verifyDeviceToken(req, res, next) {
  const h = req.headers.authorization
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing device token' })
  const token = h.slice(7)
  const devices = readJSON(DEVICES_FILE)
  for (const d of devices) {
    if (!d.tokenHash) continue
    try {
      // compare token to stored hash
      // eslint-disable-next-line no-await-in-loop
      const ok = await bcrypt.compare(token, d.tokenHash)
      if (ok) {
        req.device = d
        return next()
      }
    } catch (e) { /* ignore and continue */ }
  }
  return res.status(401).json({ error: 'Invalid device token' })
}

app.post('/devices/heartbeat', verifyDeviceToken, async (req, res) => {
  const device = req.device
  device.lastSeen = new Date().toISOString()
  device.lastIP = req.ip
  device.status = 'online'
  // persist device state
  const devices = readJSON(DEVICES_FILE).filter(d => d.deviceId !== device.deviceId)
  devices.push(device)
  writeJSON(DEVICES_FILE, devices)

  // optionally record reading payload
  const payload = req.body || {}
  const readings = readJSON(READINGS_FILE)
  const reading = {
    id: generateId('r'),
    deviceId: device.deviceId,
    houseId: device.houseId || device.ownerUserId,
    timestamp: payload.timestamp || Date.now(),
    data: payload.data || { cubicMeters: payload.cubicMeters, totalLiters: payload.totalLiters },
    receivedAt: new Date().toISOString()
  }
  readings.push(reading)
  writeJSON(READINGS_FILE, readings)
  res.json({ ok: true, readingId: reading.id })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on http://0.0.0.0:${PORT}`))
