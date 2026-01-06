import express from 'express'
import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cors from 'cors'
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

const PORT = process.env.PORT || 4000
app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on http://0.0.0.0:${PORT}`))
