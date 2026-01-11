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

function initializeData() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  // Initialize users with admin if not exists
  if (!fs.existsSync(USERS_FILE)) {
    const adminUser = {
      id: 'user-1767835763822',
      email: null,
      username: 'adminpatak',
      passwordHash: '$2a$10$qDrVTftYp3wCLmhehP2xrOzDGItHkJXdI1Y0.ucQD0pksh6ZhLMOO',
      isAdmin: true,
      createdAt: '2026-01-08T01:29:23.822Z',
      lastPasswordChange: '2026-01-08T01:53:31.451Z'
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify([adminUser], null, 2))
    console.log('✓ Initialized admin user')
  }

  // Initialize devices if not exists
  if (!fs.existsSync(DEVICES_FILE)) {
    fs.writeFileSync(DEVICES_FILE, JSON.stringify([], null, 2))
  }
}

function ensureDataFiles() {
  initializeData()
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

// Admin login endpoint (same as regular login, but with admin role checking)
app.post('/auth/admin-login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'username and password required' })
  const users = readJSON(USERS_FILE)
  const user = users.find(u => u.username === username)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
  // For now, any user can be admin. In production, add an isAdmin flag to users
  const token = jwt.sign({ userId: user.id, username: user.username, isAdmin: true }, JWT_SECRET, { expiresIn: '24h' })
  res.json({ token, user: { id: user.id, username: user.username } })
})

// Change password endpoint (requires authentication)
app.post('/auth/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword required' })
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' })
  
  const users = readJSON(USERS_FILE)
  const user = users.find(u => u.id === req.user.userId)
  if (!user) return res.status(401).json({ error: 'User not found' })
  
  const ok = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' })
  
  user.passwordHash = await bcrypt.hash(newPassword, 10)
  user.lastPasswordChange = new Date().toISOString()
  writeJSON(USERS_FILE, users)
  
  res.json({ message: 'Password changed successfully' })
})

app.get('/users/:id/devices', authMiddleware, (req, res) => {
  const { id } = req.params
  if (req.user.userId !== id) return res.status(403).json({ error: 'Forbidden' })
  const devices = readJSON(DEVICES_FILE)
  const mine = devices.filter(d => d.ownerUserId === id)
  res.json({ devices: mine })
})

// Dashboard: Return comprehensive user dashboard with devices, readings, and billing
app.get('/api/houses', authMiddleware, (req, res) => {
  const userId = req.user.userId
  const devices = readJSON(DEVICES_FILE)
  const userDevices = devices.filter(d => d.ownerUserId === userId)
  
  // Mock readings file path
  const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
  let allReadings = []
  try {
    if (fs.existsSync(READINGS_FILE)) {
      allReadings = JSON.parse(fs.readFileSync(READINGS_FILE, 'utf8'))
    }
  } catch (e) {
    console.error('Failed to load readings:', e)
  }
  
  // Build comprehensive summary for each device
  const summary = {}
  let totalBill = 0
  
  userDevices.forEach(device => {
    const deviceReadings = allReadings.filter(r => r.deviceId === device.deviceId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    const lastReading = deviceReadings[0]
    const readingsThisMonth = deviceReadings.filter(r => {
      const date = new Date(r.timestamp)
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    })
    
    const currentUsage = lastReading ? (lastReading.cubicMeters || 0) : 0
    const monthlyUsage = readingsThisMonth.reduce((sum, r) => sum + (r.cubicMeters || 0), 0)
    const ratePerCubicMeter = 50 // PHP per m³
    const monthlyBill = monthlyUsage * ratePerCubicMeter
    const estimatedMonthlyBill = monthlyBill * (30 / (new Date().getDate()))
    
    const isOnline = device.lastSeen && (Date.now() - new Date(device.lastSeen).getTime()) < 5 * 60 * 1000 // 5 min threshold
    const abnormalUsage = monthlyUsage > 100 // Alert if usage > 100 m³
    
    summary[device.deviceId] = {
      deviceId: device.deviceId,
      status: isOnline ? 'online' : 'offline',
      lastSeen: device.lastSeen,
      isOnline: isOnline,
      cubicMeters: currentUsage,
      totalLiters: currentUsage * 1000,
      monthlyUsage: monthlyUsage,
      monthlyBill: monthlyBill,
      estimatedMonthlyBill: Math.ceil(estimatedMonthlyBill),
      hasAlert: abnormalUsage,
      alertMessage: abnormalUsage ? 'High water consumption detected' : null,
      lastReading: lastReading ? {
        timestamp: lastReading.timestamp,
        cubicMeters: lastReading.cubicMeters,
        liters: (lastReading.cubicMeters || 0) * 1000
      } : null,
      readingsCount: deviceReadings.length
    }
    
    totalBill += monthlyBill
  })
  
  res.json({
    summary,
    totalBill: Math.ceil(totalBill),
    estimatedTotalBill: Math.ceil(Object.values(summary).reduce((sum, s) => sum + s.estimatedMonthlyBill, 0)),
    deviceCount: userDevices.length,
    daysInMonth: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(),
    currentDay: new Date().getDate()
  })
})

// ESP32 Device readings submission (no auth for now, can add device token validation later)
app.post('/api/readings', async (req, res) => {
  // Authenticate with device token (from ESP32)
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Device token required' })
  }
  
  const token = authHeader.slice(7)
  let deviceId = null
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (payload.type === 'device') {
      deviceId = payload.deviceId
    } else {
      return res.status(401).json({ error: 'Invalid token type' })
    }
  } catch (e) {
    return res.status(401).json({ error: 'Invalid device token' })
  }
  
  const { house, totalLiters, cubicMeters, timestamp } = req.body || {}
  if (!house || totalLiters === undefined || cubicMeters === undefined) {
    return res.status(400).json({ error: 'house, totalLiters, and cubicMeters required' })
  }
  
  const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
  let readings = []
  try {
    if (fs.existsSync(READINGS_FILE)) {
      readings = JSON.parse(fs.readFileSync(READINGS_FILE, 'utf8'))
    }
  } catch (e) {
    console.error('Failed to load readings:', e)
  }
  
  const reading = {
    id: generateId('reading'),
    deviceId,
    house,
    totalLiters: parseFloat(totalLiters),
    cubicMeters: parseFloat(cubicMeters),
    timestamp: timestamp || new Date().toISOString(),
    receivedAt: new Date().toISOString()
  }
  
  readings.push(reading)
  writeJSON(READINGS_FILE, readings)
  res.status(201).json({ ok: true, reading })
})

// Endpoint to get historical readings for charts
app.get('/api/readings/:deviceId', authMiddleware, (req, res) => {
  const { deviceId } = req.params
  const devices = readJSON(DEVICES_FILE)
  const device = devices.find(d => d.deviceId === deviceId)
  
  if (!device || device.ownerUserId !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  
  const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
  let readings = []
  try {
    if (fs.existsSync(READINGS_FILE)) {
      readings = JSON.parse(fs.readFileSync(READINGS_FILE, 'utf8'))
    }
  } catch (e) {
    console.error('Failed to load readings:', e)
  }
  
  const deviceReadings = readings.filter(r => r.deviceId === deviceId)
  res.json({ readings: deviceReadings })
})

app.post('/devices/register', authMiddleware, async (req, res) => {
  const { deviceId, houseId, meta } = req.body || {}
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' })
  
  const devices = readJSON(DEVICES_FILE)
  const exists = devices.find(d => d.deviceId === deviceId)
  
  // Generate device token (JWT that ESP32 can use to authenticate)
  const deviceToken = jwt.sign(
    { deviceId, type: 'device' },
    JWT_SECRET,
    { expiresIn: '1y' }
  )
  
  // Create or update device record
  const device = {
    deviceId,
    ownerUserId: req.user.userId,
    houseId: houseId || null,
    meta: meta || {},
    status: 'registered',
    lastSeen: null,
    createdAt: exists ? exists.createdAt : new Date().toISOString()
  }
  
  const filtered = devices.filter(d => d.deviceId !== deviceId)
  filtered.push(device)
  writeJSON(DEVICES_FILE, filtered)
  
  res.status(201).json({
    device: {
      deviceId: device.deviceId,
      owner: device.ownerUserId,
      houseId: device.houseId
    },
    deviceToken
  })
})

app.get('/devices/list', authMiddleware, (req, res) => {
  const userId = req.user.userId
  const devices = readJSON(DEVICES_FILE)
  const userDevices = devices.filter(d => d.ownerUserId === userId)
  res.json({ devices: userDevices })
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

// Admin dashboard endpoint
app.get('/api/admin/dashboard', authMiddleware, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' })
  
  const users = readJSON(USERS_FILE)
  const devices = readJSON(DEVICES_FILE)
  const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
  let allReadings = []
  try {
    if (fs.existsSync(READINGS_FILE)) {
      allReadings = JSON.parse(fs.readFileSync(READINGS_FILE, 'utf8'))
      if (!Array.isArray(allReadings)) allReadings = []
    }
  } catch (e) {
    console.error('Failed to load readings:', e)
    allReadings = []
  }

  const userList = users
    .filter(user => !user.isAdmin) // Exclude admin account from user list
    .map(user => {
    const userDevices = devices.filter(d => d.ownerUserId === user.id)
    const deviceReadings = allReadings.filter(r => userDevices.some(d => d.deviceId === r.deviceId))
    const monthlyReadings = deviceReadings.filter(r => {
      const date = new Date(r.timestamp)
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    })

    const totalUsage = monthlyReadings.reduce((sum, r) => sum + (r.cubicMeters || 0), 0)
    const totalBill = totalUsage * 50 // PHP per m³

    return {
      id: user.id,
      username: user.username,
      cubicMeters: totalUsage,
      totalLiters: totalUsage * 1000,
      deviceCount: userDevices.length,
      lastReading: deviceReadings[0] ? deviceReadings[0].timestamp : null,
      devices: userDevices.map(d => ({
        deviceId: d.deviceId,
        status: d.status,
        lastSeen: d.lastSeen
      })),
      monthlyBill: totalBill
    }
  })

  res.json({ users: userList })
})

// Admin: Get user readings
app.get('/api/admin/users/:userId/readings', authMiddleware, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' })
  
  const { userId } = req.params
  const devices = readJSON(DEVICES_FILE)
  const userDevices = devices.filter(d => d.ownerUserId === userId)
  
  const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
  let allReadings = []
  try {
    if (fs.existsSync(READINGS_FILE)) {
      allReadings = JSON.parse(fs.readFileSync(READINGS_FILE, 'utf8'))
    }
  } catch (e) {
    console.error('Failed to load readings:', e)
  }

  const readings = allReadings.filter(r => userDevices.some(d => d.deviceId === r.deviceId))
  res.json({ readings })
})

// Admin: Delete user
app.delete('/api/admin/users/:userId', authMiddleware, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' })
  
  const { userId } = req.params
  const users = readJSON(USERS_FILE)
  const devices = readJSON(DEVICES_FILE)
  
  const filtered = users.filter(u => u.id !== userId)
  writeJSON(USERS_FILE, filtered)
  
  // Also remove their devices
  const userDevices = devices.filter(d => d.ownerUserId !== userId)
  writeJSON(DEVICES_FILE, userDevices)
  
  res.json({ ok: true, message: 'User deleted' })
})

// Serve a minimal web UI for account and device management (must be AFTER API routes)
app.use(express.static(path.join(__dirname, 'public')))

// Admin: Reset all readings (admin only)
app.post('/admin/reset-readings', authMiddleware, (req, res) => {
  // Check if user is admin
  const users = readJSON(USERS_FILE)
  const user = users.find(u => u.id === req.user.userId)
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
  writeJSON(READINGS_FILE, [])
  res.json({ ok: true, message: 'All readings cleared' })
})

// Admin: Reset readings for a specific device
app.post('/admin/reset-device-readings', authMiddleware, (req, res) => {
  const { deviceId } = req.body || {}
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' })

  // Check if user is admin
  const users = readJSON(USERS_FILE)
  const user = users.find(u => u.id === req.user.userId)
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
  let readings = readJSON(READINGS_FILE)
  const filtered = readings.filter(r => r.deviceId !== deviceId)
  writeJSON(READINGS_FILE, filtered)
  res.json({ ok: true, message: `Readings cleared for device ${deviceId}` })
})

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

