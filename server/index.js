import express from 'express'
import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cors from 'cors'
import compression from 'compression'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json')

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
app.use(compression())
app.use(express.json({ limit: '10mb' }))

// JSON error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body', details: err.message })
  }
  if (err) {
    console.error('Server error:', err)
    return res.status(500).json({ error: 'Internal server error', message: err.message })
  }
  next()
})

// Lightweight health endpoint for uptime checks and keepalive pings
app.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0-json-fix' })
})

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
  const { email, username, password } = req.body || {}
  if ((!email && !username) || !password) return res.status(400).json({ error: 'email or username, and password required' })
  const users = readJSON(USERS_FILE)
  const exists = users.find(u => (email && u.email === email) || (username && u.username === username))
  if (exists) return res.status(409).json({ error: 'User exists' })
  const passwordHash = await bcrypt.hash(password, 10)
  const user = { id: generateId('user'), email: email || null, username: username || null, passwordHash, createdAt: new Date().toISOString() }
  users.push(user)
  writeJSON(USERS_FILE, users)
  const token = jwt.sign({ userId: user.id, email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '1h' })
  res.status(201).json({ token, user: { id: user.id, email: user.email, username: user.username } })
})

app.post('/auth/login', async (req, res) => {
  const { email, username, password } = req.body || {}
  if ((!email && !username) || !password) return res.status(400).json({ error: 'email or username, and password required' })
  const users = readJSON(USERS_FILE)
  const user = users.find(u => (email && u.email === email) || (username && u.username === username))
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
  const token = jwt.sign({ userId: user.id, email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '1h' })
  res.json({ token, user: { id: user.id, email: user.email, username: user.username } })
})

app.get('/users/:id/devices', authMiddleware, (req, res) => {
  const { id } = req.params
  if (req.user.userId !== id) return res.status(403).json({ error: 'Forbidden' })
  const devices = readJSON(DEVICES_FILE)
  const mine = devices.filter(d => d.ownerUserId === id)
  res.json({ devices: mine })
})

// Dashboard: Return user's houses/devices summary
app.get('/api/houses', authMiddleware, (req, res) => {
  const userId = req.user.userId
  const devices = readJSON(DEVICES_FILE)
  const userDevices = devices.filter(d => d.ownerUserId === userId)
  
  // Build summary for each device
  const summary = {}
  userDevices.forEach(device => {
    summary[device.deviceId] = {
      deviceId: device.deviceId,
      status: device.status,
      lastSeen: device.lastSeen,
      cubicMeters: 0,
      totalLiters: 0,
      last: null
    }
  })
  
  res.json({ summary })
})

app.post('/devices/register', authMiddleware, async (req, res) => {
  const { deviceId, deviceKey } = req.body || {}
  if (!deviceId || !deviceKey) return res.status(400).json({ error: 'deviceId and deviceKey required' })
  const devices = readJSON(DEVICES_FILE)
  const exists = devices.find(d => d.deviceId === deviceId)
  if (exists) {
    if (exists.ownerUserId && exists.ownerUserId !== req.user.userId) return res.status(409).json({ error: 'Device owned by another user' })
    if (exists.ownerUserId === req.user.userId) return res.json({ device: { deviceId: exists.deviceId, owner: exists.ownerUserId } })
  }
  const deviceKeyHash = await bcrypt.hash(deviceKey, 10)
  const device = { deviceId, deviceKeyHash, ownerUserId: req.user.userId, status: 'registered', lastSeen: null, createdAt: new Date().toISOString() }
  const filtered = devices.filter(d => d.deviceId !== deviceId)
  filtered.push(device)
  writeJSON(DEVICES_FILE, filtered)
  res.status(201).json({ device: { deviceId: device.deviceId, owner: device.ownerUserId } })
})

app.post('/devices/heartbeat', async (req, res) => {
  const { deviceId, deviceKey } = req.body || {}
  if (!deviceId || !deviceKey) return res.status(400).json({ error: 'deviceId and deviceKey required' })
  const devices = readJSON(DEVICES_FILE)
  const device = devices.find(d => d.deviceId === deviceId)
  if (!device) return res.status(404).json({ error: 'Unknown device' })
  const ok = await bcrypt.compare(deviceKey, device.deviceKeyHash)
  if (!ok) return res.status(401).json({ error: 'Invalid device credentials' })
  device.lastSeen = new Date().toISOString()
  device.lastIP = req.ip
  device.status = 'online'
  writeJSON(DEVICES_FILE, devices)
  res.json({ ok: true })
})

// Admin endpoint to clear all users (dev only)
app.post('/admin/clear-users', (req, res) => {
  writeJSON(USERS_FILE, [])
  res.json({ ok: true, message: 'All users cleared' })
})

// Serve a minimal web UI for account and device management (must be AFTER API routes)
app.use(express.static(path.join(__dirname, 'public')))

// 404 catch-all handler (must be AFTER all other routes and static files)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path, method: req.method })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`)
  console.log(`✅ Server started successfully`)
  console.log(`📡 Listening on http://0.0.0.0:${PORT}`)
  console.log(`🔐 JWT Secret: ${JWT_SECRET !== 'dev_secret_change_me' ? 'Production' : 'Development'}`)
  console.log(`📁 Data directory: ${DATA_DIR}`)
  console.log(`========================================\n`)
})

