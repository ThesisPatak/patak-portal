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

  // Initialize users with admin if not exists or if file is empty
  let needsInit = !fs.existsSync(USERS_FILE)
  if (!needsInit) {
    try {
      const existing = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))
      needsInit = !Array.isArray(existing) || existing.length === 0
    } catch (e) {
      needsInit = true
    }
  }
  
  if (needsInit) {
    const adminUser = initializeAdminUser()
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

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})

// JSON error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body' })
  }
  if (err) {
    console.error('Server error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
  next()
})

// Lightweight health endpoint for uptime checks and keepalive pings
app.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0-json-fix' })
})

// Debug endpoint - Check server state (users, devices, readings count)
app.get('/debug/state', (req, res) => {
  console.log(`[DEBUG] State check requested`)
  try {
    const users = readJSON(USERS_FILE)
    const devices = readJSON(DEVICES_FILE)
    const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
    let readings = []
    if (fs.existsSync(READINGS_FILE)) {
      readings = JSON.parse(fs.readFileSync(READINGS_FILE, 'utf8'))
    }
    
    console.log(`[DEBUG] State: ${users.length} users, ${devices.length} devices, ${readings.length} readings`)
    
    res.json({
      timestamp: new Date().toISOString(),
      dataDirectory: DATA_DIR,
      dataDirectoryExists: fs.existsSync(DATA_DIR),
      usersFileExists: fs.existsSync(USERS_FILE),
      devicesFileExists: fs.existsSync(DEVICES_FILE),
      volumeMounted: fs.existsSync(DATA_DIR),
      users: {
        count: users.length,
        list: users.map(u => ({ id: u.id, username: u.username, email: u.email, isAdmin: u.isAdmin, createdAt: u.createdAt }))
      },
      devices: {
        count: devices.length,
        list: devices.map(d => ({ deviceId: d.deviceId, ownerUserId: d.ownerUserId, houseId: d.houseId, status: d.status, lastSeen: d.lastSeen }))
      },
      readings: {
        count: readings.length,
        latestReadings: readings.slice(-5).map(r => ({ id: r.id, deviceId: r.deviceId, house: r.house, cubicMeters: r.cubicMeters, timestamp: r.timestamp, receivedAt: r.receivedAt }))
      }
    })
  } catch (err) {
    console.error(`[DEBUG] Error:`, err)
    res.status(500).json({ error: 'Failed to get state', message: err.message })
  }
})

// Debug endpoint - Test file writing capability
app.post('/debug/test-write', (req, res) => {
  console.log(`\n[DEBUG-WRITE] Testing file write capability...`)
  try {
    const testFile = path.join(DATA_DIR, 'test-write.txt')
    const testData = `Test write at ${new Date().toISOString()}`
    console.log(`[DEBUG-WRITE] Attempting to write to: ${testFile}`)
    fs.writeFileSync(testFile, testData)
    console.log(`[DEBUG-WRITE] ✓ Write successful`)
    
    const readBack = fs.readFileSync(testFile, 'utf8')
    console.log(`[DEBUG-WRITE] ✓ Read back: ${readBack}`)
    
    res.json({
      success: true,
      message: 'File write test passed',
      testFile,
      dataDirectory: DATA_DIR,
      directoryWritable: true
    })
  } catch (err) {
    console.error(`[DEBUG-WRITE] ✗ Write failed:`, err.message)
    res.status(500).json({
      success: false,
      message: 'File write test failed',
      error: err.message,
      dataDirectory: DATA_DIR
    })
  }
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
  const timestamp = new Date().toISOString()
  console.log(`\n[${timestamp}] [REGISTER] REQUEST - username: ${username}, email: ${email}, hasPassword: ${!!password}`)
  console.log(`[REGISTER] Full request body:`, JSON.stringify(req.body))
  
  if ((!email && !username) || !password) {
    console.log(`[REGISTER] ✗ FAILED - Missing email or username and/or password`)
    return res.status(400).json({ error: 'email or username, and password required' })
  }
  if (password.length < 8) {
    console.log(`[REGISTER] ✗ FAILED - Password too short (${password.length} chars)`)
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }
  if (username && (username.length < 3 || username.length > 30)) {
    console.log(`[REGISTER] ✗ FAILED - Username invalid length (${username.length} chars)`)
    return res.status(400).json({ error: 'Username must be 3-30 characters' })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.log(`[REGISTER] ✗ FAILED - Invalid email format: ${email}`)
    return res.status(400).json({ error: 'Invalid email format' })
  }
  
  try {
    const users = readJSON(USERS_FILE)
    console.log(`[REGISTER] Current users in database: ${users.length}`)
    users.forEach((u, idx) => console.log(`  [${idx}] id=${u.id}, username=${u.username}, email=${u.email}, isAdmin=${u.isAdmin}`))
    
    const exists = users.find(u => (email && u.email === email) || (username && u.username === username))
    if (exists) {
      console.log(`[REGISTER] ✗ FAILED - User already exists: ${exists.username || exists.email}`)
      return res.status(409).json({ error: 'User exists' })
    }
    
    console.log(`[REGISTER] Hashing password...`)
    const passwordHash = await bcrypt.hash(password, 10)
    const userId = generateId('user')
    const user = { id: userId, email: email || null, username: username || null, passwordHash, createdAt: new Date().toISOString() }
    
    console.log(`[REGISTER] Created user object:`, { id: user.id, username: user.username, email: user.email, createdAt: user.createdAt })
    users.push(user)
    console.log(`[REGISTER] Writing ${users.length} users to disk...`)
    writeJSON(USERS_FILE, users)
    console.log(`[REGISTER] ✓ SAVED - User file now contains ${users.length} users`)
    
    const token = jwt.sign({ userId: user.id, email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '1h' })
    console.log(`[REGISTER] ✓✓ SUCCESS - User registered: ${username} (${user.id}), token issued`)
    res.status(201).json({ token, user: { id: user.id, email: user.email, username: user.username, createdAt: user.createdAt } })
  } catch (err) {
    console.error(`[REGISTER] ✗ ERROR:`, err.message, err.stack)
    res.status(500).json({ error: 'Registration failed', message: err.message })
  }
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
  res.json({ token, user: { id: user.id, email: user.email, username: user.username, createdAt: user.createdAt } })
})

// Admin login endpoint (same as regular login, but with admin role checking)
app.post('/auth/admin-login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'username and password required' })
  console.log(`[ADMIN-LOGIN] Attempting login for username: ${username}`)
  const users = readJSON(USERS_FILE)
  console.log(`[ADMIN-LOGIN] Total users in file: ${users.length}`)
  console.log(`[ADMIN-LOGIN] Users list:`, users.map(u => ({id: u.id, username: u.username})))
  const user = users.find(u => u.username === username)
  if (!user) {
    console.log(`[ADMIN-LOGIN] User ${username} not found`)
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  console.log(`[ADMIN-LOGIN] User found. Comparing password...`)
  const ok = await bcrypt.compare(password, user.passwordHash)
  console.log(`[ADMIN-LOGIN] Password check result: ${ok}`)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
  // For now, any user can be admin. In production, add an isAdmin flag to users
  const token = jwt.sign({ userId: user.id, username: user.username, isAdmin: true }, JWT_SECRET, { expiresIn: '24h' })
  console.log(`[ADMIN-LOGIN] Admin login successful for ${username}`)
  res.json({ token, user: { id: user.id, username: user.username, createdAt: user.createdAt } })
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
      console.log('[HOUSES] Total readings in file:', allReadings.length)
    }
  } catch (e) {
    console.error('Failed to load readings:', e)
  }
  
  // Build comprehensive summary for each device
  const summary = {}
  let totalBill = 0
  
  userDevices.forEach(device => {
    const deviceReadings = allReadings.filter(r => r.deviceId === device.deviceId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    console.log('[HOUSES] Device', device.deviceId, 'has', deviceReadings.length, 'readings')
    const lastReading = deviceReadings[0]
    const readingsThisMonth = deviceReadings.filter(r => {
      const date = new Date(r.timestamp)
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    })
    
    const currentUsage = lastReading ? (lastReading.cubicMeters || 0) : 0
    // Since ESP32 sends cumulative totals, use latest reading value as monthly usage
    const monthlyUsage = currentUsage
    const ratePerCubicMeter = 15 // PHP per m³
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
  
  console.log('[HOUSES] Returning summary for', Object.keys(summary).length, 'devices')
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
  const timestamp = new Date().toISOString()
  console.log(`\n[${timestamp}] [ESP32-READING] =========== Incoming reading from ESP32 ===========`)
  console.log(`[ESP32-READING] Full request body:`, JSON.stringify(req.body))
  
  // Authenticate with device token (from ESP32)
  const authHeader = req.headers.authorization
  console.log(`[ESP32-READING] Authorization header present: ${!!authHeader}`)
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`[ESP32-READING] ✗ REJECTED - Missing or invalid device token`)
    return res.status(401).json({ error: 'Device token required' })
  }
  
  const token = authHeader.slice(7)
  let deviceId = null
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    console.log(`[ESP32-READING] Token verified successfully. Payload:`, { type: payload.type, deviceId: payload.deviceId })
    if (payload.type === 'device') {
      deviceId = payload.deviceId
    } else {
      console.log(`[ESP32-READING] ✗ REJECTED - Invalid token type: ${payload.type}`)
      return res.status(401).json({ error: 'Invalid token type' })
    }
  } catch (e) {
    console.log(`[ESP32-READING] ✗ REJECTED - Token verification failed:`, e.message)
    return res.status(401).json({ error: 'Invalid device token' })
  }
  
  const { house, totalLiters, cubicMeters, timestamp: reqTimestamp } = req.body || {}
  console.log(`[ESP32-READING] Parsed reading data: house=${house}, totalLiters=${totalLiters}, cubicMeters=${cubicMeters}, deviceId=${deviceId}`)
  
  if (!house || totalLiters === undefined || cubicMeters === undefined) {
    console.log(`[ESP32-READING] ✗ REJECTED - Missing required fields`)
    return res.status(400).json({ error: 'house, totalLiters, and cubicMeters required' })
  }
  if (cubicMeters < 0 || totalLiters < 0) {
    console.log(`[ESP32-READING] ✗ REJECTED - Negative reading values`)
    return res.status(400).json({ error: 'Readings cannot be negative' })
  }
  if (cubicMeters > 1000000 || totalLiters > 1000000000) {
    console.log(`[ESP32-READING] ✗ REJECTED - Reading value exceeds maximum`)
    return res.status(400).json({ error: 'Reading value exceeds maximum allowed' })
  }
  
  const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
  let readings = []
  try {
    if (fs.existsSync(READINGS_FILE)) {
      readings = JSON.parse(fs.readFileSync(READINGS_FILE, 'utf8'))
      console.log(`[ESP32-READING] Loaded ${readings.length} existing readings from disk`)
    } else {
      console.log(`[ESP32-READING] Readings file does not exist, creating new`)
    }
  } catch (e) {
    console.error(`[ESP32-READING] ✗ Failed to load readings:`, e.message)
  }
  
  const reading = {
    id: generateId('reading'),
    deviceId,
    house,
    totalLiters: parseFloat(totalLiters),
    cubicMeters: parseFloat(cubicMeters),
    timestamp: reqTimestamp || new Date().toISOString(),
    receivedAt: new Date().toISOString()
  }
  console.log(`[ESP32-READING] Created reading object:`, reading)
  
  readings.push(reading)
  console.log(`[ESP32-READING] Writing ${readings.length} readings to disk...`)
  writeJSON(READINGS_FILE, readings)
  console.log(`[ESP32-READING] ✓ Reading saved. Total readings now: ${readings.length}`)
  
  // Update device's lastSeen timestamp to mark it as online
  const devices = readJSON(DEVICES_FILE)
  const device = devices.find(d => d.deviceId === deviceId)
  if (device) {
    device.lastSeen = new Date().toISOString()
    console.log(`[ESP32-READING] Updated device '${deviceId}' lastSeen timestamp`)
    writeJSON(DEVICES_FILE, devices)
  } else {
    console.log(`[ESP32-READING] ⚠ Device '${deviceId}' not found in devices list`)
  }
  
  console.log(`[ESP32-READING] ✓✓ SUCCESS - Reading accepted and saved`)
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

// Endpoint to get all historical readings for the authenticated user
app.get('/api/user/readings', authMiddleware, (req, res) => {
  const userId = req.user.userId
  
  const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
  let allReadings = []
  try {
    if (fs.existsSync(READINGS_FILE)) {
      allReadings = JSON.parse(fs.readFileSync(READINGS_FILE, 'utf8'))
    }
  } catch (e) {
    console.error('Failed to load readings:', e)
  }
  
  // Try two approaches for filtering:
  // 1. Filter by user's registered devices
  const devices = readJSON(DEVICES_FILE)
  const userDevices = devices.filter(d => d.ownerUserId === userId)
  let userReadings = allReadings.filter(r => userDevices.some(d => d.deviceId === r.deviceId))
  
  // 2. Fallback: If no devices registered (Railway doesn't persist), return all readings
  //    This works because all readings from one installation will be from the same house
  if (userReadings.length === 0) {
    userReadings = allReadings
  }
  
  // Sort by timestamp descending (newest first)
  const sortedReadings = userReadings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  
  res.json({ 
    history: sortedReadings,
    summary: {
      totalReadings: sortedReadings.length,
      deviceCount: userDevices.length,
      latestReading: sortedReadings[0] || null
    }
  })
})

// Endpoint to get usage history with filtering and pagination
app.get('/api/usage/history', authMiddleware, (req, res) => {
  const userId = req.user.userId
  const { limit = '100', offset = '0', deviceId = null, startDate = null, endDate = null } = req.query
  const limitNum = Math.min(parseInt(limit) || 100, 1000)
  const offsetNum = parseInt(offset) || 0
  
  const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
  let allReadings = []
  try {
    if (fs.existsSync(READINGS_FILE)) {
      allReadings = JSON.parse(fs.readFileSync(READINGS_FILE, 'utf8'))
    }
  } catch (e) {
    console.error('Failed to load readings:', e)
  }
  
  // Filter by user's devices
  const devices = readJSON(DEVICES_FILE)
  const userDevices = devices.filter(d => d.ownerUserId === userId)
  let userReadings = allReadings.filter(r => userDevices.some(d => d.deviceId === r.deviceId))
  
  // Filter by specific device if requested
  if (deviceId) {
    const device = userDevices.find(d => d.deviceId === deviceId)
    if (!device) {
      return res.status(403).json({ error: 'Device not found or access denied' })
    }
    userReadings = userReadings.filter(r => r.deviceId === deviceId)
  }
  
  // Filter by date range if provided
  if (startDate) {
    const start = new Date(startDate).getTime()
    userReadings = userReadings.filter(r => new Date(r.timestamp).getTime() >= start)
  }
  if (endDate) {
    const end = new Date(endDate).getTime()
    userReadings = userReadings.filter(r => new Date(r.timestamp).getTime() <= end)
  }
  
  // Sort by timestamp descending (newest first)
  const sortedReadings = userReadings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  
  // Apply pagination
  const total = sortedReadings.length
  const paginated = sortedReadings.slice(offsetNum, offsetNum + limitNum)
  
  // Calculate statistics
  const stats = {
    totalReadings: total,
    currentPage: Math.floor(offsetNum / limitNum) + 1,
    pageSize: limitNum,
    hasMore: offsetNum + limitNum < total,
    minReading: paginated.length > 0 ? Math.min(...paginated.map(r => r.cubicMeters || 0)) : 0,
    maxReading: paginated.length > 0 ? Math.max(...paginated.map(r => r.cubicMeters || 0)) : 0,
    avgReading: paginated.length > 0 ? paginated.reduce((sum, r) => sum + (r.cubicMeters || 0), 0) / paginated.length : 0
  }
  
  res.json({
    history: paginated,
    stats,
    devices: userDevices.map(d => ({ deviceId: d.deviceId, houseId: d.houseId }))
  })
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

// Device: Check for pending commands (ESP32 polls this)
app.post('/devices/check-commands', async (req, res) => {
  const { deviceId } = req.body || {}
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' })
  
  const devices = readJSON(DEVICES_FILE)
  const device = devices.find(d => d.deviceId === deviceId)
  if (!device) return res.status(404).json({ error: 'Unknown device' })
  
  // Check if reset is requested
  const commands = []
  if (device.resetRequested) {
    commands.push('reset')
    device.resetRequested = false // Clear flag after sending
    writeJSON(DEVICES_FILE, devices)
  }
  
  res.json({ commands })
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

// Admin endpoint to clear all users (requires admin authentication)
app.post('/admin/clear-users', authMiddleware, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' })
  const adminUser = {
    id: 'user-1767835763822',
    email: null,
    username: 'adminpatak',
    passwordHash: '$2a$10$Y2gr8aro9OGKnOdo99uLcunL.T5ocLHiPKW835V84gQfNZBh2vBZa',
    isAdmin: true,
    createdAt: '2026-01-08T01:29:23.822Z',
    lastPasswordChange: '2026-01-08T01:53:31.451Z'
  }
  writeJSON(USERS_FILE, [adminUser])
  res.json({ ok: true, message: 'All users cleared and admin reset' })
})

// Admin: Get all users (for admin panel)
app.get('/api/admin/users', authMiddleware, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' })
  
  const users = readJSON(USERS_FILE)
  const userList = {}
  
  users.forEach(user => {
    if (!user.isAdmin) {
      // Use username as key, since that's what mobile app uses
      const key = user.username || user.email || user.id
      userList[key] = {
        role: 'user',
        id: user.id,
        createdAt: user.createdAt,
        email: user.email,
        username: user.username
      }
    }
  })
  
  res.json({ users: userList })
})

// Admin: Create a user (manual creation from admin panel)
app.post('/api/admin/users', authMiddleware, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' })
  
  const { houseId, password, role } = req.body || {}
  if (!houseId || !password) return res.status(400).json({ error: 'houseId and password required' })
  
  try {
    const users = readJSON(USERS_FILE)
    // Use houseId as username if creating from admin panel
    const exists = users.find(u => (u.username === houseId) || (u.email === houseId))
    if (exists) {
      return res.status(409).json({ error: 'User already exists' })
    }
    
    const passwordHash = await bcrypt.hash(password, 10)
    const user = { 
      id: generateId('user'), 
      email: null, 
      username: houseId,  // Use houseId as username
      passwordHash, 
      createdAt: new Date().toISOString() 
    }
    users.push(user)
    writeJSON(USERS_FILE, users)
    
    res.status(201).json({ ok: true, user: { id: user.id, username: user.username } })
  } catch (err) {
    console.error('User creation error:', err)
    res.status(500).json({ error: 'User creation failed' })
  }
})

// Admin: Delete a user by username
app.delete('/api/admin/users/:username', authMiddleware, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' })
  
  const { username } = req.params
  const users = readJSON(USERS_FILE)
  const devices = readJSON(DEVICES_FILE)
  
  const user = users.find(u => u.username === username || decodeURIComponent(username).includes(u.username))
  if (!user) return res.status(404).json({ error: 'User not found' })
  
  // Remove user and their devices
  const filtered = users.filter(u => u.id !== user.id)
  writeJSON(USERS_FILE, filtered)
  
  const userDevices = devices.filter(d => d.ownerUserId !== user.id)
  writeJSON(DEVICES_FILE, userDevices)
  
  res.json({ ok: true, message: 'User deleted' })
})

// Admin dashboard endpoint
app.get('/api/admin/dashboard', authMiddleware, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' })
  
  console.log('[DASHBOARD] Admin dashboard requested by:', req.user.username)
  const users = readJSON(USERS_FILE)
  console.log('[DASHBOARD] Total users in file:', users.length)
  console.log('[DASHBOARD] Users:', users.map(u => ({ id: u.id, username: u.username, isAdmin: u.isAdmin })))
  
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
    
    // Sort by timestamp descending to get latest reading
    const latestReading = deviceReadings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
    
    // Since ESP32 sends cumulative totals, use latest reading value
    const totalUsage = latestReading ? (latestReading.cubicMeters || 0) : 0
    const totalBill = totalUsage * 50 // PHP per m³

    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      cubicMeters: totalUsage,
      totalLiters: totalUsage * 1000,
      deviceCount: userDevices.length,
      lastReading: latestReading ? latestReading.timestamp : null,
      devices: userDevices.map(d => ({
        deviceId: d.deviceId,
        status: d.status,
        lastSeen: d.lastSeen
      })),
      monthlyBill: totalBill
    }
  })

  console.log('[DASHBOARD] Returning', userList.length, 'non-admin users')
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

// Admin: Reset all readings and set reset flag for all devices
app.post('/admin/reset-readings', authMiddleware, (req, res) => {
  // Check if user is admin
  const users = readJSON(USERS_FILE)
  const user = users.find(u => u.id === req.user.userId)
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
  writeJSON(READINGS_FILE, [])
  
  // Set reset flag on all devices
  const devices = readJSON(DEVICES_FILE)
  devices.forEach(d => d.resetRequested = true)
  writeJSON(DEVICES_FILE, devices)
  
  res.json({ ok: true, message: 'All readings cleared and device reset requested' })
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
  
  // Set reset flag on the device
  const devices = readJSON(DEVICES_FILE)
  const device = devices.find(d => d.deviceId === deviceId)
  if (device) {
    device.resetRequested = true
    writeJSON(DEVICES_FILE, devices)
  }
  
  res.json({ ok: true, message: `Readings cleared for device ${deviceId} and reset requested` })
})

// 404 catch-all handler (must be AFTER all other routes and static files)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path, method: req.method })
})

const PORT = process.env.PORT || 8080
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`)
  console.log(`✅ Server started successfully`)
  console.log(`📡 Listening on http://0.0.0.0:${PORT}`)
  console.log(`🔐 JWT Secret: ${JWT_SECRET !== 'dev_secret_change_me' ? 'Production' : 'Development'}`)
  console.log(`� Data directory: ${DATA_DIR}`)
  console.log(`========================================\n`)
})

