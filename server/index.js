import express from 'express'
import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cors from 'cors'
import compression from 'compression'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Use environment variable for data directory, default to /data for Railway volume
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data')
console.log(`[STARTUP] DATA_DIR environment variable: ${process.env.DATA_DIR}`)
console.log(`[STARTUP] Using DATA_DIR: ${DATA_DIR}`)
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json')
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json')

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me'

// Real-time SSE client tracking for broadcasting readings
const sseClients = new Map() // { userId: Set<{ res, sendEvent }> }

// Helper to broadcast readings to SSE clients
function broadcastToSSEClients(userId, reading) {
  const clients = sseClients.get(userId)
  if (clients) {
    clients.forEach(client => {
      try {
        client.res.write(`event: reading\ndata: ${JSON.stringify(reading)}\n\n`)
      } catch (err) {
        console.error(`[SSE] Error writing to client:`, err.message)
        clients.delete(client)
      }
    })
  }
}

function initializeAdminUser() {
  return {
    id: 'user-1767835763822',
    email: null,
    username: 'adminpatak',
    passwordHash: '$2a$10$Y2gr8aro9OGKnOdo99uLcunL.T5ocLHiPKW835V84gQfNZBh2vBZa',
    isAdmin: true,
    createdAt: '2026-01-08T01:29:23.822Z',
    lastPasswordChange: '2026-01-08T01:53:31.451Z'
  }
}

function initializeData() {
  if (!fs.existsSync(DATA_DIR)) {
    console.log(`[INIT] Creating data directory: ${DATA_DIR}`)
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  // Initialize users - preserve existing, only create if truly missing
  if (!fs.existsSync(USERS_FILE)) {
    console.log(`[INIT] Users file does not exist, creating with admin user...`)
    const adminUser = initializeAdminUser()
    fs.writeFileSync(USERS_FILE, JSON.stringify([adminUser], null, 2))
    console.log('✓ Initialized admin user')
  } else {
    console.log(`[INIT] Users file exists, loading...`)
    try {
      const existing = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'))
      if (Array.isArray(existing)) {
        console.log(`[INIT] ✓ Loaded ${existing.length} users from persistent storage`)
      } else {
        console.log(`[INIT] ⚠ Users file corrupted, resetting with admin only`)
        const adminUser = initializeAdminUser()
        fs.writeFileSync(USERS_FILE, JSON.stringify([adminUser], null, 2))
      }
    } catch (e) {
      console.log(`[INIT] ⚠ Failed to parse users file:`, e.message, `- resetting with admin only`)
      const adminUser = initializeAdminUser()
      fs.writeFileSync(USERS_FILE, JSON.stringify([adminUser], null, 2))
    }
  }

  // Initialize devices if not exists
  if (!fs.existsSync(DEVICES_FILE)) {
    console.log(`[INIT] Devices file does not exist, creating...`)
    fs.writeFileSync(DEVICES_FILE, JSON.stringify([], null, 2))
  } else {
    console.log(`[INIT] Devices file exists, loading...`)
    try {
      const existing = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'))
      if (Array.isArray(existing)) {
        console.log(`[INIT] ✓ Loaded ${existing.length} devices from persistent storage`)
      }
    } catch (e) {
      console.log(`[INIT] ⚠ Devices file corrupted:`, e.message)
    }
  }
}

function ensureDataFiles() {
  initializeData()
}

function readJSON(file) {
  try { 
    const data = fs.readFileSync(file, 'utf8')
    if (!data || !data.trim()) {
      console.warn(`[IO] Warning: File ${file} is empty, returning []`)
      return []
    }
    return JSON.parse(data)
  } catch (e) { 
    console.warn(`[IO] Error reading ${file}: ${e.message}, returning []`)
    return [] 
  }
}

function writeJSON(file, obj) {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log(`[IO] Created directory: ${dir}`)
    }
    
    // Write to temporary file first, then rename (atomic operation)
    const tempFile = file + '.tmp'
    const jsonStr = JSON.stringify(obj, null, 2)
    console.log(`[IO] Writing ${obj.length || Object.keys(obj).length} items to ${path.basename(file)}`)
    console.log(`[IO] JSON size: ${jsonStr.length} bytes`)
    
    // Make sure temp file is deleted if it exists
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile)
    }
    
    // Write to temp file
    fs.writeFileSync(tempFile, jsonStr, { flag: 'w' })
    console.log(`[IO] ✓ Wrote to temp file: ${tempFile}`)
    
    // Verify temp file was written
    if (!fs.existsSync(tempFile)) {
      throw new Error(`Temp file not created: ${tempFile}`)
    }
    const tempStats = fs.statSync(tempFile)
    console.log(`[IO] ✓ Temp file verified: ${tempStats.size} bytes`)
    
    // Atomic rename (overwrites original)
    fs.renameSync(tempFile, file)
    console.log(`[IO] ✓ Renamed temp to final: ${file}`)
    
    // Verify final file exists and has content
    if (!fs.existsSync(file)) {
      throw new Error(`Final file not found after rename: ${file}`)
    }
    const finalStats = fs.statSync(file)
    console.log(`[IO] ✓ Final file verified: ${finalStats.size} bytes`)
    
    // Double-check by reading back
    const readBack = JSON.parse(fs.readFileSync(file, 'utf8'))
    const itemCount = Array.isArray(readBack) ? readBack.length : Object.keys(readBack).length
    console.log(`[IO] ✓ READ VERIFICATION PASSED - File contains ${itemCount} items`)
  } catch (e) {
    console.error(`[IO] ✗ ERROR writing to ${file}: ${e.message}`)
    console.error(`[IO] Stack:`, e.stack)
    throw e // Rethrow to caller so they know write failed
  }
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

// PayMongo removed - using GCash manual payment only

// Debug endpoint - Verify token validity
app.post('/debug/verify-token', (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`[DEBUG-TOKEN] No token provided`)
    return res.status(400).json({ valid: false, error: 'No token provided' })
  }
  
  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    console.log(`[DEBUG-TOKEN] ✓ Token is valid:`, payload)
    res.json({ valid: true, payload })
  } catch (err) {
    console.log(`[DEBUG-TOKEN] ✗ Token is invalid:`, err.message)
    res.status(400).json({ valid: false, error: err.message })
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

// Tiered water billing calculation based on official schedule
// Minimum: 255.00 PHP for up to 10 m³
// Excess rates: 11-20: 33.00, 21-30: 40.50, 31-40: 48.00, 41+: 55.50 PHP per m³
function calculateWaterBill(cubicMeters) {
  const MINIMUM_CHARGE = 255.00
  const FREE_USAGE = 10 // cubic meters included in minimum
  
  if (cubicMeters <= FREE_USAGE) {
    return MINIMUM_CHARGE
  }
  
  const excess = cubicMeters - FREE_USAGE
  let excessCharge = 0
  
  // Apply tiered rates for usage above 10 m³
  const tier1 = Math.min(excess, 10)           // 11-20 m³: 33.00 per m³
  const tier2 = Math.min(Math.max(excess - 10, 0), 10)  // 21-30 m³: 40.50 per m³
  const tier3 = Math.min(Math.max(excess - 20, 0), 10)  // 31-40 m³: 48.00 per m³
  const tier4 = Math.max(excess - 30, 0)      // 41+ m³: 55.50 per m³
  
  excessCharge = (tier1 * 33.00) + (tier2 * 40.50) + (tier3 * 48.00) + (tier4 * 55.50)
  
  return Math.round((MINIMUM_CHARGE + excessCharge) * 100) / 100 // Round to 2 decimals
}

function authMiddleware(req, res, next) {
  // Support token from both Authorization header and query string
  // Query string is needed for EventSource which doesn't support custom headers
  let token = null
  
  const h = req.headers.authorization
  if (h && h.startsWith('Bearer ')) {
    token = h.slice(7)
  } else if (req.query.token) {
    token = req.query.token
  }
  
  if (!token) {
    console.log(`[AUTH] ✗ REJECTED - Missing token (no Authorization header or query string token)`)
    return res.status(401).json({ error: 'Missing token' })
  }
  
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    console.log(`[AUTH] ✓ Token verified - userId: ${payload.userId}, username: ${payload.username}, isAdmin: ${payload.isAdmin}`)
    req.user = payload
    next()
  } catch (e) {
    console.log(`[AUTH] ✗ Token verification failed:`, e.message)
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Public: Get GCash configuration
app.get('/api/config/gcash', (req, res) => {
  const gcashNumber = process.env.GCASH_NUMBER || null
  const gcashName = process.env.GCASH_NAME || null
  const isConfigured = !!gcashNumber
  
  res.json({
    gcash: {
      number: gcashNumber,
      name: gcashName,
      configured: isConfigured,
      displayNumber: gcashNumber ? gcashNumber.replace(/(\d{4})(\d{3})(\d{4})/, '$1-$2-$3') : null,
      displayName: gcashName || 'Admin Account'
    }
  })
})

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
    const user = { id: userId, email: email || null, username: username || null, passwordHash, isAdmin: false, createdAt: new Date().toISOString() }
    
    console.log(`[REGISTER] Created user object:`, { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin, createdAt: user.createdAt })
    users.push(user)
    console.log(`[REGISTER] Users array after push: ${users.length} users`)
    console.log(`[REGISTER] Array contents:`, users.map(u => ({ id: u.id, username: u.username, isAdmin: u.isAdmin })))
    
    console.log(`[REGISTER] About to write ${users.length} users to disk (${USERS_FILE})...`)
    writeJSON(USERS_FILE, users)
    console.log(`[REGISTER] ✓ SAVED - User file now contains ${users.length} users`)
    
    // Verify the write was successful by reading back
    const verifyRead = readJSON(USERS_FILE)
    console.log(`[REGISTER] ✓ VERIFICATION: Read back ${verifyRead.length} users from disk`)
    if (verifyRead.length !== users.length) {
      console.error(`[REGISTER] ✗ CRITICAL: Written ${users.length} users but read back ${verifyRead.length}!`)
    }
    
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

// Real-time SSE endpoint for real-time reading updates
app.get('/api/stream', authMiddleware, (req, res) => {
  const userId = req.user.userId
  console.log(`[SSE] Client connecting for userId: ${userId}`)
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering
  
  // Send initial connection message with current summary
  const devices = readJSON(DEVICES_FILE)
  const userDevices = devices.filter(d => d.ownerUserId === userId)
  
  const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
  let allReadings = []
  try {
    if (fs.existsSync(READINGS_FILE)) {
      allReadings = JSON.parse(fs.readFileSync(READINGS_FILE, 'utf8'))
    }
  } catch (e) {
    console.error('[SSE] Failed to load readings:', e)
  }
  
  // Build summary
  const summary = {}
  userDevices.forEach(device => {
    const deviceReadings = allReadings.filter(r => r.deviceId === device.deviceId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    const lastReading = deviceReadings[0]
    const houseId = device.houseId || 'unknown'
    
    summary[houseId] = {
      totalLiters: lastReading ? lastReading.totalLiters : 0,
      cubicMeters: lastReading ? lastReading.cubicMeters : 0,
      last: lastReading || null
    }
  })
  
  res.write(`event: summary\ndata: ${JSON.stringify({ summary })}\n\n`)
  
  // Register this client for real-time updates
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set())
  }
  
  const client = { res, userId }
  sseClients.get(userId).add(client)
  console.log(`[SSE] Client registered. Total clients for user: ${sseClients.get(userId).size}`)
  
  // Send keepalive every 30 seconds to prevent timeout
  const keepaliveInterval = setInterval(() => {
    try {
      res.write(': keepalive\n\n')
    } catch (err) {
      console.error('[SSE] Keepalive failed:', err.message)
      clearInterval(keepaliveInterval)
      sseClients.get(userId).delete(client)
    }
  }, 30000)
  
  // Handle client disconnect
  req.on('close', () => {
    console.log(`[SSE] Client disconnecting for userId: ${userId}`)
    clearInterval(keepaliveInterval)
    sseClients.get(userId).delete(client)
    if (sseClients.get(userId).size === 0) {
      sseClients.delete(userId)
    }
    res.end()
  })
})

// Dashboard: Return comprehensive user dashboard with devices, readings, and billing
app.get('/api/houses', authMiddleware, (req, res) => {
  try {
    const userId = req.user.userId
    const users = readJSON(USERS_FILE)
    if (!Array.isArray(users)) {
      console.error('[HOUSES] ERROR: users is not an array, got:', typeof users)
      return res.status(500).json({ error: 'Corrupted user data' })
    }
    
    const user = users.find(u => u.id === userId)
    if (!user) {
      console.warn(`[HOUSES] User ${userId} not found in ${users.length} users`)
      return res.status(404).json({ error: 'User not found' })
    }
    
    const userCreatedAt = user?.createdAt || new Date().toISOString()
    
    const devices = readJSON(DEVICES_FILE)
    if (!Array.isArray(devices)) {
      console.error('[HOUSES] ERROR: devices is not an array, got:', typeof devices)
      return res.status(500).json({ error: 'Corrupted device data' })
    }
    
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
    const deviceReadings = allReadings.filter(r => r.deviceId === device.deviceId).sort((a, b) => new Date(b.receivedAt || b.timestamp) - new Date(a.receivedAt || a.timestamp))
    console.log('[HOUSES] Device', device.deviceId, 'has', deviceReadings.length, 'readings')
    const lastReading = deviceReadings[0]
    const sortedReadings = deviceReadings.sort((a, b) => new Date(b.receivedAt || b.timestamp) - new Date(a.receivedAt || a.timestamp))
    
    const readingsThisMonth = deviceReadings.filter(r => {
      // Use receivedAt (server timestamp) instead of timestamp (which may be 1970 due to NTP sync issues)
      const date = new Date(r.receivedAt || r.timestamp)
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    })
    
    const currentConsumptionValue = lastReading ? (lastReading.cubicMeters || 0) : 0
    
    // Calculate consumption by billing period (billing starts from user's account createdAt day each month)
    // Get the user's billing start day
    const userCreatedDate = new Date(device.createdAt || Date.now())
    const billingStartDay = userCreatedDate.getDate()
    
    // Get readings for current billing period (from day 19 of current month to now)
    const now = new Date()
    let currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), billingStartDay)
    if (now < currentPeriodStart) {
      // If today is before the billing day, go back to previous month's billing date
      currentPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, billingStartDay)
    }
    
    // Calculate previous period start
    let previousPeriodStart = new Date(currentPeriodStart)
    previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1)
    
    const currentPeriodReadings = sortedReadings.filter(r => {
      // Use receivedAt (server timestamp) instead of timestamp (which may be 1970 due to NTP sync issues)
      const date = new Date(r.receivedAt || r.timestamp)
      return date >= currentPeriodStart && date <= now
    })
    const previousPeriodReadings = sortedReadings.filter(r => {
      // Use receivedAt (server timestamp) instead of timestamp (which may be 1970 due to NTP sync issues)
      const date = new Date(r.receivedAt || r.timestamp)
      return date >= previousPeriodStart && date < currentPeriodStart
    })
    
    // Current Consumption = latest meter reading from ESP32 (cumulative total)
    const currentConsumption = currentConsumptionValue
    
    // Previous Consumption = readings in previous period (latest in period - oldest in period)
    const previousConsumption = previousPeriodReadings.length > 0
      ? Math.max(0, (previousPeriodReadings[0].cubicMeters || 0) - (previousPeriodReadings[previousPeriodReadings.length - 1].cubicMeters || 0))
      : 0
    
    // Total Consumption = sum of current and previous consumption
    const totalConsumptionValue = currentConsumption + previousConsumption
    
    // Since ESP32 sends cumulative totals, use latest reading value as monthly consumption
    const monthlyConsumption = currentConsumptionValue
    const monthlyBill = calculateWaterBill(monthlyConsumption)
    const estimatedMonthlyBill = calculateWaterBill(monthlyConsumption * (30 / (new Date().getDate())))
    
    const isOnline = device.lastSeen && (Date.now() - new Date(device.lastSeen).getTime()) < 5 * 60 * 1000 // 5 min threshold
    const hasAlert = monthlyConsumption > 100 // Alert if consumption > 100 m³
    
    summary[device.deviceId] = {
      deviceId: device.deviceId,
      status: isOnline ? 'online' : 'offline',
      lastSeen: device.lastSeen,
      isOnline: isOnline,
      cubicMeters: currentConsumptionValue,
      currentConsumption: currentConsumption,
      previousConsumption: previousConsumption,
      totalConsumption: totalConsumptionValue,
      totalLiters: currentConsumptionValue * 1000,
      monthlyConsumption: monthlyConsumption,
      monthlyBill: monthlyBill,
      estimatedMonthlyBill: Math.ceil(estimatedMonthlyBill),
      hasAlert: hasAlert,
      alertMessage: hasAlert ? 'High water consumption detected' : null,
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
    currentDay: new Date().getDate(),
    userCreatedAt: userCreatedAt
  })
  } catch (err) {
    console.error('[HOUSES] ERROR:', err.message, err.stack)
    res.status(500).json({ error: 'Failed to load dashboard: ' + err.message })
  }
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
  
  // Broadcast reading to SSE clients for all users with devices for this house
  const deviceList = readJSON(DEVICES_FILE)
  const deviceOwnerIds = new Set()
  deviceList.forEach(d => {
    if (d.deviceId === deviceId) {
      deviceOwnerIds.add(d.ownerUserId)
    }
  })
  
  // Send real-time update to connected clients
  deviceOwnerIds.forEach(userId => {
    broadcastToSSEClients(userId, reading)
  })
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
  // Return in byDevice format as expected by UsageDashboard component
  res.json({ 
    readings: deviceReadings,
    byDevice: { [deviceId]: deviceReadings }
  })
})

// Endpoint to get all historical readings for the authenticated user
app.get('/api/user/readings', authMiddleware, (req, res) => {
  try {
    const userId = req.user.userId
    
    const READINGS_FILE = path.join(DATA_DIR, 'readings.json')
    let allReadings = []
    try {
      if (fs.existsSync(READINGS_FILE)) {
        allReadings = JSON.parse(fs.readFileSync(READINGS_FILE, 'utf8'))
      }
    } catch (e) {
      console.warn('[READINGS] Failed to load readings:', e.message)
    }
    
    // Filter by user's registered devices only
    const devices = readJSON(DEVICES_FILE)
    if (!Array.isArray(devices)) {
      console.error('[READINGS] ERROR: devices is not an array')
      return res.status(500).json({ error: 'Corrupted device data' })
    }
    
    const userDevices = devices.filter(d => d.ownerUserId === userId)
    let userReadings = allReadings.filter(r => userDevices.some(d => d.deviceId === r.deviceId))
    
    // Security: Do NOT return all readings if no devices registered
    // Users must explicitly register a device to see readings
    
    // Sort by receivedAt descending (newest first)
    // Use receivedAt instead of timestamp since timestamp may be stuck at 1970 due to ESP32 NTP issues
    const sortedReadings = userReadings.sort((a, b) => new Date(b.receivedAt || b.timestamp) - new Date(a.receivedAt || a.timestamp))
    
    res.json({ 
      history: sortedReadings,
      summary: {
        totalReadings: sortedReadings.length,
        deviceCount: userDevices.length,
        latestReading: sortedReadings[0] || null,
        deviceRegistered: userDevices.length > 0
      }
  })
  } catch (err) {
    console.error('[READINGS] ERROR:', err.message, err.stack)
    res.status(500).json({ error: 'Failed to load readings: ' + err.message })
  }
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
  // Use receivedAt (server timestamp) instead of timestamp (which may be 1970 due to ESP32 NTP issues)
  if (startDate) {
    const start = new Date(startDate).getTime()
    userReadings = userReadings.filter(r => new Date(r.receivedAt || r.timestamp).getTime() >= start)
  }
  if (endDate) {
    const end = new Date(endDate).getTime()
    userReadings = userReadings.filter(r => new Date(r.receivedAt || r.timestamp).getTime() <= end)
  }
  
  // Sort by receivedAt descending (newest first)
  // Use receivedAt instead of timestamp since timestamp may be stuck at 1970 due to ESP32 NTP issues
  const sortedReadings = userReadings.sort((a, b) => new Date(b.receivedAt || b.timestamp) - new Date(a.receivedAt || a.timestamp))
  
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
  const timestamp = new Date().toISOString()
  const { deviceId, houseId, meta } = req.body || {}
  console.log(`\n[${timestamp}] [DEVICE-REGISTER] Request from user ${req.user.userId}`)
  console.log(`[DEVICE-REGISTER] deviceId: ${deviceId}, houseId: ${houseId}`)
  
  if (!deviceId) {
    console.log(`[DEVICE-REGISTER] ✗ REJECTED - deviceId required`)
    return res.status(400).json({ error: 'deviceId required' })
  }
  
  try {
    const devices = readJSON(DEVICES_FILE)
    const exists = devices.find(d => d.deviceId === deviceId)
    console.log(`[DEVICE-REGISTER] Device already exists: ${!!exists}`)
    
    // Generate device token (JWT that ESP32 can use to authenticate)
    const deviceToken = jwt.sign(
      { deviceId, type: 'device' },
      JWT_SECRET,
      { expiresIn: '1y' }
    )
    console.log(`[DEVICE-REGISTER] Generated device token`)
    
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
    console.log(`[DEVICE-REGISTER] Created device object:`, device)
    
    const filtered = devices.filter(d => d.deviceId !== deviceId)
    filtered.push(device)
    writeJSON(DEVICES_FILE, filtered)
    console.log(`[DEVICE-REGISTER] ✓ Saved to devices file. Total devices: ${filtered.length}`)
    
    res.status(201).json({
      device: {
        deviceId: device.deviceId,
        owner: device.ownerUserId,
        houseId: device.houseId
      },
      deviceToken
    })
    console.log(`[DEVICE-REGISTER] ✓✓ SUCCESS - Device registered for user`)
  } catch (err) {
    console.error(`[DEVICE-REGISTER] ✗ ERROR:`, err.message)
    res.status(500).json({ error: 'Failed to register device: ' + err.message })
  }
})

// Send device token to ESP32 via HTTP request (one-click linking)
app.post('/devices/send-token', authMiddleware, async (req, res) => {
  const timestamp = new Date().toISOString()
  const { deviceId, espIP, espPort } = req.body || {}
  console.log(`\n[${timestamp}] [SEND-TOKEN] Request to send token to ESP32`)
  console.log(`[SEND-TOKEN] deviceId: ${deviceId}, ESP IP: ${espIP}:${espPort}`)
  
  if (!deviceId || !espIP) {
    return res.status(400).json({ error: 'deviceId and espIP required' })
  }
  
  const devices = readJSON(DEVICES_FILE)
  const device = devices.find(d => d.deviceId === deviceId && d.ownerUserId === req.user.userId)
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found or not owned by user' })
  }
  
  // Generate fresh device token
  const deviceToken = jwt.sign(
    { deviceId, type: 'device' },
    JWT_SECRET,
    { expiresIn: '1y' }
  )
  
  try {
    const port = espPort || 80
    const url = `http://${espIP}:${port}/api/token`
    
    console.log(`[SEND-TOKEN] Sending token to ${url}`)
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: deviceToken })
    })
    
    if (!response.ok) {
      throw new Error(`ESP32 returned ${response.status}`)
    }
    
    console.log(`[SEND-TOKEN] ✓ Token sent successfully to ESP32`)
    res.json({ ok: true, message: 'Token sent to device', deviceToken })
  } catch (err) {
    console.error(`[SEND-TOKEN] ✗ Failed to send token:`, err.message)
    res.status(500).json({ error: 'Failed to send token to device: ' + err.message })
  }
})

// Link device via backend (cloud-based, works over internet)
app.post('/devices/link', authMiddleware, async (req, res) => {
  const timestamp = new Date().toISOString()
  const { deviceId } = req.body || {}
  console.log(`\n[${timestamp}] [DEVICE-LINK] Request from user ${req.user.userId}`)
  console.log(`[DEVICE-LINK] deviceId: ${deviceId}`)
  
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId required' })
  }
  
  const devices = readJSON(DEVICES_FILE)
  const device = devices.find(d => d.deviceId === deviceId && d.ownerUserId === req.user.userId)
  
  if (!device) {
    console.log(`[DEVICE-LINK] ✗ Device not found or not owned by user`)
    return res.status(404).json({ error: 'Device not found or not owned by user' })
  }
  
  // Generate fresh device token
  const deviceToken = jwt.sign(
    { deviceId, type: 'device' },
    JWT_SECRET,
    { expiresIn: '1y' }
  )
  
  // Store as pending token - ESP32 will claim it when it connects
  device.pendingToken = deviceToken
  device.pendingTokenCreatedAt = new Date().toISOString()
  console.log(`[DEVICE-LINK] ✓ Stored pending token for ESP32 to claim`)
  
  writeJSON(DEVICES_FILE, devices)
  
  res.status(200).json({
    ok: true,
    message: 'Device token pending. ESP32 will claim it when it connects.',
    deviceId
  })
  
  console.log(`[DEVICE-LINK] ✓✓ SUCCESS - Token ready for ESP32 to claim`)
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

// Endpoint for ESP32 to claim its token (works over internet, not just local WiFi)
app.post('/devices/claim-token', async (req, res) => {
  const timestamp = new Date().toISOString()
  const { deviceId } = req.body || {}
  
  if (!deviceId) {
    console.log(`[CLAIM-TOKEN] ✗ deviceId required`)
    return res.status(400).json({ error: 'deviceId required' })
  }
  
  console.log(`\n[${timestamp}] [CLAIM-TOKEN] ESP32 claiming token for deviceId: ${deviceId}`)
  
  const devices = readJSON(DEVICES_FILE)
  const device = devices.find(d => d.deviceId === deviceId)
  
  if (!device) {
    console.log(`[CLAIM-TOKEN] ✗ Device not found`)
    return res.status(404).json({ error: 'Device not found' })
  }
  
  // Check if there's a pending token for this device
  if (!device.pendingToken) {
    console.log(`[CLAIM-TOKEN] ℹ No pending token for this device (user hasn't clicked LINK yet)`)
    return res.status(202).json({ token: null, message: 'No token pending' })
  }
  
  const token = device.pendingToken
  console.log(`[CLAIM-TOKEN] ✓ Found pending token, sending to ESP32`)
  
  // Clear the pending token after sending
  device.pendingToken = null
  device.status = 'linked'
  device.lastTokenClaimedAt = new Date().toISOString()
  device.lastIP = req.ip
  device.lastSeen = new Date().toISOString()
  writeJSON(DEVICES_FILE, devices)
  
  console.log(`[CLAIM-TOKEN] ✓ Token claimed and cleared from pending`)
  
  res.status(200).json({
    token,
    message: 'Token claimed successfully'
  })
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
  const timestamp = new Date().toISOString()
  console.log(`\n[${timestamp}] [ADMIN-USERS] ========== Request received ==========`)
  console.log(`[ADMIN-USERS] Auth info: userId=${req.user.userId}, username=${req.user.username}, isAdmin=${req.user.isAdmin}`)
  
  if (!req.user.isAdmin) {
    console.log(`[ADMIN-USERS] ✗ REJECTED - User is not admin (isAdmin=${req.user.isAdmin})`)
    return res.status(403).json({ error: 'Admin access required' })
  }
  
  console.log(`[ADMIN-USERS] ✓ Authorization passed`)
  const users = readJSON(USERS_FILE)
  console.log(`[ADMIN-USERS] Loaded ${users.length} total users from ${USERS_FILE}`)
  console.log(`[ADMIN-USERS] Raw users data:`)
  users.forEach((u, idx) => console.log(`  [${idx}] ${JSON.stringify(u)}`))
  
  const userList = {}
  let addedCount = 0
  let skippedCount = 0
  
  users.forEach(user => {
    console.log(`[ADMIN-USERS] Checking user: username=${user.username}, isAdmin=${user.isAdmin}, isAdmin check: !${user.isAdmin} = ${!user.isAdmin}`)
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
      console.log(`[ADMIN-USERS] ✓ Added user: ${key}`)
      addedCount++
    } else {
      console.log(`[ADMIN-USERS] ✗ Skipped admin user: ${user.username} (isAdmin=true)`)
      skippedCount++
    }
  })
  
  console.log(`[ADMIN-USERS] ✓ Complete - Added: ${addedCount}, Skipped: ${skippedCount}`)
  console.log(`[ADMIN-USERS] Returning users object:`, JSON.stringify(userList))
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
      isAdmin: false,
      createdAt: new Date().toISOString() 
    }
    console.log(`[ADMIN-CREATE-USER] Created user object:`, { id: user.id, username: user.username, isAdmin: user.isAdmin })
    users.push(user)
    console.log(`[ADMIN-CREATE-USER] Users array after push: ${users.length} users`)
    
    console.log(`[ADMIN-CREATE-USER] About to write ${users.length} users to disk...`)
    writeJSON(USERS_FILE, users)
    console.log(`[ADMIN-CREATE-USER] ✓ SAVED - User file now contains ${users.length} users`)
    
    // Verify the write was successful
    const verifyRead = readJSON(USERS_FILE)
    console.log(`[ADMIN-CREATE-USER] ✓ VERIFICATION: Read back ${verifyRead.length} users from disk`)
    if (verifyRead.length !== users.length) {
      console.error(`[ADMIN-CREATE-USER] ✗ CRITICAL: Written ${users.length} users but read back ${verifyRead.length}!`)
    }
    
    res.status(201).json({ ok: true, user: { id: user.id, username: user.username } })
  } catch (err) {
    console.error('User creation error:', err)
    res.status(500).json({ error: 'User creation failed' })
  }
})

// Admin: Reset meter for a user
app.post('/api/admin/users/:username/reset-meter', authMiddleware, (req, res) => {
  const timestamp = new Date().toISOString()
  console.log(`\n[${timestamp}] [RESET-METER] Request received`)
  
  if (!req.user.isAdmin) {
    console.log(`[RESET-METER] ✗ REJECTED - User is not admin`)
    return res.status(403).json({ error: 'Admin access required' })
  }
  
  const { username } = req.params
  const decodedUsername = decodeURIComponent(username)
  console.log(`[RESET-METER] Target username: "${decodedUsername}"`)
  
  const users = readJSON(USERS_FILE)
  const user = users.find(u => u.username === decodedUsername)
  
  if (!user) {
    console.log(`[RESET-METER] ✗ User not found`)
    return res.status(404).json({ error: 'User not found' })
  }
  
  // Get user's devices to send reset command to ESP32
  const devices = readJSON(DEVICES_FILE)
  const userDevices = devices.filter(d => d.ownerUserId === user.id)
  
  if (userDevices.length === 0) {
    console.log(`[RESET-METER] ✗ No devices registered for user`)
    return res.status(400).json({ error: 'No devices registered for this user' })
  }
  
  // Create reset commands file if it doesn't exist
  const RESET_COMMANDS_FILE = path.join(DATA_DIR, 'reset_commands.json')
  let resetCommands = []
  try {
    if (fs.existsSync(RESET_COMMANDS_FILE)) {
      resetCommands = JSON.parse(fs.readFileSync(RESET_COMMANDS_FILE, 'utf8'))
      if (!Array.isArray(resetCommands)) resetCommands = []
    }
  } catch (e) {
    console.error('[RESET-METER] Error reading reset commands:', e)
    resetCommands = []
  }
  
  // Add reset command for each device
  userDevices.forEach(device => {
    resetCommands.push({
      deviceId: device.deviceId,
      username: user.username,
      userId: user.id,
      timestamp: timestamp,
      executed: false
    })
    console.log(`[RESET-METER] Reset command queued for device: ${device.deviceId}`)
  })
  
  // Save reset commands
  try {
    fs.writeFileSync(RESET_COMMANDS_FILE, JSON.stringify(resetCommands, null, 2))
  } catch (e) {
    console.error('[RESET-METER] Error saving reset commands:', e)
    return res.status(500).json({ error: 'Failed to queue reset command' })
  }
  
  // Also reset server data for immediate effect
  user.cubicMeters = 0
  user.totalLiters = 0
  user.lastReading = null
  writeJSON(USERS_FILE, users)
  
  console.log(`[RESET-METER] ✓ Reset command queued for user: ${user.username}`)
  res.json({ 
    ok: true, 
    message: 'Reset command sent to device. The meter will reset when ESP32 receives the command.',
    username: user.username,
    deviceCount: userDevices.length
  })
})

// ESP32: Check for pending reset commands
app.get('/api/device/:deviceId/pending-commands', (req, res) => {
  const { deviceId } = req.params
  const timestamp = new Date().toISOString()
  
  console.log(`[${timestamp}] [PENDING-CMD] Device checking for commands: ${deviceId}`)
  
  const RESET_COMMANDS_FILE = path.join(DATA_DIR, 'reset_commands.json')
  let resetCommands = []
  
  try {
    if (fs.existsSync(RESET_COMMANDS_FILE)) {
      resetCommands = JSON.parse(fs.readFileSync(RESET_COMMANDS_FILE, 'utf8'))
      if (!Array.isArray(resetCommands)) resetCommands = []
    }
  } catch (e) {
    console.error('[PENDING-CMD] Error reading commands:', e)
    return res.status(500).json({ error: 'Failed to read commands' })
  }
  
  // Find pending commands for this device
  const pendingCommands = resetCommands.filter(cmd => cmd.deviceId === deviceId && !cmd.executed)
  
  if (pendingCommands.length > 0) {
    console.log(`[PENDING-CMD] ✓ Found ${pendingCommands.length} pending command(s) for device: ${deviceId}`)
    // Mark as executed
    const updatedCommands = resetCommands.map(cmd => {
      if (cmd.deviceId === deviceId && !cmd.executed) {
        cmd.executed = true
        cmd.executedAt = timestamp
      }
      return cmd
    })
    fs.writeFileSync(RESET_COMMANDS_FILE, JSON.stringify(updatedCommands, null, 2))
    
    return res.json({
      hasPendingCommands: true,
      commands: pendingCommands.map(cmd => ({
        type: 'reset',
        command: 'RESET_METER',
        username: cmd.username
      }))
    })
  }
  
  console.log(`[PENDING-CMD] No pending commands for device: ${deviceId}`)
  res.json({ hasPendingCommands: false, commands: [] })
})

// User: Record a payment for their bill
app.post('/api/payments/record', authMiddleware, (req, res) => {
  const timestamp = new Date().toISOString()
  console.log(`\n[${timestamp}] [RECORD-PAYMENT] Request received`)
  
  const { amount, billingMonth, billingYear, paymentMethod } = req.body
  const userId = req.user.userId
  const username = req.user.username
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid payment amount' })
  }
  
  if (!billingMonth || !billingYear) {
    return res.status(400).json({ error: 'Billing month and year required' })
  }
  
  const payments = readJSON(PAYMENTS_FILE)
  
  // Create new payment record
  const newPayment = {
    id: `payment-${Date.now()}`,
    userId,
    username,
    amount: parseFloat(amount),
    paymentDate: timestamp,
    billingMonth: parseInt(billingMonth),
    billingYear: parseInt(billingYear),
    paymentMethod: paymentMethod || 'manual',
    status: 'confirmed'
  }
  
  payments.push(newPayment)
  writeJSON(PAYMENTS_FILE, payments)
  
  // Log payment with method-specific details
  if (paymentMethod === 'gcash') {
    console.log(`[RECORD-PAYMENT] ✓ GCash payment recorded for ${username}: ₱${amount} for ${billingMonth}/${billingYear}`)
    console.log(`[RECORD-PAYMENT] Transaction ID: ${newPayment.id}`)
  } else {
    console.log(`[RECORD-PAYMENT] ✓ Payment recorded for ${username}: ₱${amount} for ${billingMonth}/${billingYear} via ${paymentMethod}`)
  }
  
  res.json({ ok: true, message: 'Payment recorded successfully', payment: newPayment })
})

// GCash: Webhook endpoint for payment confirmations (optional integration)
app.post('/api/gcash/webhook', (req, res) => {
  const timestamp = new Date().toISOString()
  const { transactionId, amount, recipientId, senderId, status, metadata } = req.body || {}
  
  console.log(`\n[${timestamp}] [GCASH-WEBHOOK] Received GCash webhook`)
  console.log(`[GCASH-WEBHOOK] Transaction: ${transactionId}, Amount: ${amount}, Status: ${status}`)
  
  if (!transactionId || !status) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  
  // Verify signature (implement GCash webhook validation)
  // This would require GCash API key and signature verification
  
  if (status === 'SUCCESS' || status === 'COMPLETED') {
    console.log(`[GCASH-WEBHOOK] ✓ GCash payment confirmed: ${transactionId}`)
    
    // Extract user info from metadata if provided
    // In real implementation, you'd verify and update payment status
    
    return res.json({ ok: true, message: 'Webhook processed' })
  }
  
  console.log(`[GCASH-WEBHOOK] ℹ Payment status: ${status}`)
  res.json({ ok: true, message: 'Webhook received' })
})

// ==================== PAYMONGO PAYMENT ENDPOINTS ====================

// PayMongo: Create QR checkout link
app.post('/api/paymongo/create-checkout', authMiddleware, async (req, res) => {
  const timestamp = new Date().toISOString()
  const { amount, description, billingMonth, billingYear, reference } = req.body
  const userId = req.user.userId

  console.log(`\n[${timestamp}] [PAYMONGO-CREATE] Creating checkout`)
  console.log(`[PAYMONGO-CREATE] User: ${req.user.username}, Amount: ₱${amount / 100}`)

  const PAYMONGO_PUBLIC_KEY = process.env.PAYMONGO_PUBLIC_KEY
  const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY
  
  if (!PAYMONGO_PUBLIC_KEY || !PAYMONGO_SECRET_KEY) {
    console.error('[PAYMONGO-CREATE] ❌ PayMongo keys not configured')
    return res.status(500).json({ error: 'PayMongo not configured' })
  }

  try {
    // Use PayMongo's Checkout Sessions API (works with test keys)
    const checkoutPayload = {
      data: {
        attributes: {
          amount: parseInt(amount), // amount in centavos
          currency: 'PHP',
          description: description || 'Water Bill Payment',
          line_items: [
            {
              name: description || 'Water Bill Payment',
              quantity: 1,
              amount: parseInt(amount),
              currency: 'PHP'
            }
          ],
          reference_number: reference || `PATAK-${Date.now()}`,
          success_url: `https://patak-portal-production.up.railway.app/payment/success?reference=${reference}`,
          cancel_url: `https://patak-portal-production.up.railway.app/payment/cancel`,
          payment_method_types: ['gcash', 'card'],
          send_email_receipt: false,
          show_description: true,
          show_line_items: true
        }
      }
    }

    console.log(`[PAYMONGO-CREATE] Creating PayMongo Checkout Session for ₱${amount / 100}...`)

    // Create checkout session via PayMongo Checkout API
    const checkoutResponse = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString('base64')}`
      },
      body: JSON.stringify(checkoutPayload)
    })

    const checkoutData = await checkoutResponse.json()
    
    console.log(`[PAYMONGO-CREATE] Checkout API Response Status: ${checkoutResponse.status}`)
    console.log(`[PAYMONGO-CREATE] Checkout API Response:`, JSON.stringify(checkoutData, null, 2))

    // If Checkout API works, use the checkout URL
    if (checkoutResponse.ok && checkoutData.data && checkoutData.data.attributes) {
      const checkoutId = checkoutData.data.id
      const checkoutUrl = checkoutData.data.attributes.checkout_url
      const referenceNum = checkoutData.data.attributes.reference_number
      
      console.log(`[PAYMONGO-CREATE] ✓ PayMongo Checkout Session created: ${checkoutId}`)
      console.log(`[PAYMONGO-CREATE] Checkout URL: ${checkoutUrl}`)
      
      if (checkoutUrl) {
        // Generate QR code from the checkout URL
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkoutUrl)}`
        
        return res.json({
          qrCode: qrCodeUrl,
          checkoutUrl: checkoutUrl,
          checkoutId: checkoutId,
          reference: referenceNum,
          amount: amount,
          amountDisplay: `₱${(amount / 100).toFixed(2)}`,
          description: description,
          paymentMethod: 'paymongo_checkout'
        })
      }
    }

    // If checkout fails, return error with details
    console.log(`[PAYMONGO-CREATE] ❌ Checkout creation failed`)
    return res.status(400).json({ 
      error: 'Failed to create checkout session',
      details: checkoutData.errors || 'Unknown error'
    })
    
  } catch (err) {
    console.error('[PAYMONGO-CREATE] ❌ Error:', err.message)
    res.status(500).json({ error: 'Failed to create payment', message: err.message })
  }
})

// PayMongo: Submit payment reference
app.post('/api/paymongo/submit-payment', authMiddleware, (req, res) => {
  const timestamp = new Date().toISOString()
  const { amount, billingMonth, billingYear, referenceNumber } = req.body
  const userId = req.user.userId
  const username = req.user.username

  console.log(`\n[${timestamp}] [PAYMONGO-SUBMIT] Payment submission received`)
  console.log(`[PAYMONGO-SUBMIT] User: ${username}, Amount: ₱${amount}, Ref: ${referenceNumber}`)

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' })
  }

  if (!billingMonth || !billingYear) {
    return res.status(400).json({ error: 'Billing month and year required' })
  }

  try {
    // Create pending payment record (webhook will verify actual payment)
    const pendingPayment = {
      id: `paymongo-${Date.now()}`,
      userId,
      username,
      amount: parseFloat(amount),
      billingMonth: parseInt(billingMonth),
      billingYear: parseInt(billingYear),
      referenceNumber: referenceNumber || `REF-${Date.now()}`,
      submittedAt: timestamp,
      status: 'pending_verification',
      paymentMethod: 'paymongo'
    }

    // Read or create pending payments file
    const PENDING_PAYMENTS_FILE = path.join(DATA_DIR, 'pending_paymongo_payments.json')
    let pendingPayments = []
    try {
      if (fs.existsSync(PENDING_PAYMENTS_FILE)) {
        pendingPayments = JSON.parse(fs.readFileSync(PENDING_PAYMENTS_FILE, 'utf8'))
        if (!Array.isArray(pendingPayments)) pendingPayments = []
      }
    } catch (e) {
      console.warn(`[PAYMONGO-SUBMIT] Warning: Could not load pending payments file:`, e.message)
      pendingPayments = []
    }

    // Add new pending payment
    pendingPayments.push(pendingPayment)
    fs.writeFileSync(PENDING_PAYMENTS_FILE, JSON.stringify(pendingPayments, null, 2))

    res.json({
      ok: true,
      message: 'Payment submitted. Awaiting PayMongo confirmation...',
      referenceNumber: referenceNumber,
      paymentId: pendingPayment.id
    })
  } catch (err) {
    console.error('[PAYMONGO-SUBMIT] ❌', err.message)
    res.status(500).json({ error: 'Failed to submit payment' })
  }
})

// GCash: Submit payment for manual verification (stores pending payment)
app.post('/api/gcash/submit-payment', authMiddleware, (req, res) => {
  const timestamp = new Date().toISOString()
  const { amount, billingMonth, billingYear, referenceNumber } = req.body
  const userId = req.user.userId
  const username = req.user.username

  console.log(`\n[${timestamp}] [GCASH-SUBMIT] Payment submission received`)
  console.log(`[GCASH-SUBMIT] User: ${username}, Amount: ₱${amount}, Billing: ${billingMonth}/${billingYear}`)

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' })
  }

  if (!billingMonth || !billingYear) {
    return res.status(400).json({ error: 'Billing month and year required' })
  }

  try {
    // Create pending payment record
    const pendingPayment = {
      id: `gcash-${Date.now()}`,
      userId,
      username,
      amount: parseFloat(amount),
      billingMonth: parseInt(billingMonth),
      billingYear: parseInt(billingYear),
      referenceNumber: referenceNumber || `REF-${Date.now()}`,
      submittedAt: timestamp,
      status: 'pending_verification',
      paymentMethod: 'gcash'
    }

    // Read or create pending payments file
    const PENDING_GCASH_FILE = path.join(DATA_DIR, 'pending_gcash_payments.json')
    let pendingPayments = []
    try {
      if (fs.existsSync(PENDING_GCASH_FILE)) {
        pendingPayments = JSON.parse(fs.readFileSync(PENDING_GCASH_FILE, 'utf8'))
        if (!Array.isArray(pendingPayments)) pendingPayments = []
      }
    } catch (e) {
      console.error('[GCASH-SUBMIT] Error reading pending payments:', e)
      pendingPayments = []
    }

    pendingPayments.push(pendingPayment)
    fs.writeFileSync(PENDING_GCASH_FILE, JSON.stringify(pendingPayments, null, 2))

    console.log(`[GCASH-SUBMIT] ✓ Pending payment created: ${pendingPayment.id}`)
    console.log(`[GCASH-SUBMIT] Awaiting admin verification`)

    res.status(201).json({
      ok: true,
      message: 'Payment submitted. Waiting for admin verification.',
      paymentId: pendingPayment.id,
      referenceNumber: pendingPayment.referenceNumber
    })
  } catch (err) {
    console.error(`[GCASH-SUBMIT] ✗ Error:`, err.message)
    res.status(500).json({ error: 'Failed to submit payment: ' + err.message })
  }
})

// Admin: Get all pending GCash payments
app.get('/api/admin/gcash/pending', authMiddleware, (req, res) => {
  const timestamp = new Date().toISOString()
  console.log(`\n[${timestamp}] [GCASH-PENDING] Admin requesting pending payments`)

  if (!req.user.isAdmin) {
    console.log(`[GCASH-PENDING] ✗ REJECTED - Not admin`)
    return res.status(403).json({ error: 'Admin access required' })
  }

  try {
    const PENDING_GCASH_FILE = path.join(DATA_DIR, 'pending_gcash_payments.json')
    let pendingPayments = []
    try {
      if (fs.existsSync(PENDING_GCASH_FILE)) {
        pendingPayments = JSON.parse(fs.readFileSync(PENDING_GCASH_FILE, 'utf8'))
        if (!Array.isArray(pendingPayments)) pendingPayments = []
      }
    } catch (e) {
      console.error('[GCASH-PENDING] Error reading pending payments:', e)
      pendingPayments = []
    }

    // Filter only pending payments
    const pending = pendingPayments.filter(p => p.status === 'pending_verification')

    console.log(`[GCASH-PENDING] ✓ Found ${pending.length} pending payments`)
    res.json({ pending })
  } catch (err) {
    console.error(`[GCASH-PENDING] ✗ Error:`, err.message)
    res.status(500).json({ error: 'Failed to fetch pending payments' })
  }
})

// Admin: Verify and confirm GCash payment
app.post('/api/admin/gcash/verify/:paymentId', authMiddleware, (req, res) => {
  const timestamp = new Date().toISOString()
  const { paymentId } = req.params
  console.log(`\n[${timestamp}] [GCASH-VERIFY] Admin verifying payment: ${paymentId}`)

  if (!req.user.isAdmin) {
    console.log(`[GCASH-VERIFY] ✗ REJECTED - Not admin`)
    return res.status(403).json({ error: 'Admin access required' })
  }

  try {
    const PENDING_GCASH_FILE = path.join(DATA_DIR, 'pending_gcash_payments.json')
    let pendingPayments = []
    try {
      if (fs.existsSync(PENDING_GCASH_FILE)) {
        pendingPayments = JSON.parse(fs.readFileSync(PENDING_GCASH_FILE, 'utf8'))
        if (!Array.isArray(pendingPayments)) pendingPayments = []
      }
    } catch (e) {
      console.error('[GCASH-VERIFY] Error reading pending payments:', e)
      pendingPayments = []
    }

    // Find pending payment
    const paymentIndex = pendingPayments.findIndex(p => p.id === paymentId)
    if (paymentIndex === -1) {
      console.log(`[GCASH-VERIFY] ✗ Payment not found: ${paymentId}`)
      return res.status(404).json({ error: 'Payment not found' })
    }

    const payment = pendingPayments[paymentIndex]
    if (payment.status !== 'pending_verification') {
      console.log(`[GCASH-VERIFY] ✗ Payment already processed: ${payment.status}`)
      return res.status(400).json({ error: 'Payment already processed' })
    }

    // Update pending payment status
    payment.status = 'verified'
    payment.verifiedAt = timestamp
    payment.verifiedBy = req.user.username
    pendingPayments[paymentIndex] = payment

    // Save updated pending payments
    fs.writeFileSync(PENDING_GCASH_FILE, JSON.stringify(pendingPayments, null, 2))

    // Also record in main payments file
    const payments = readJSON(PAYMENTS_FILE)
    const confirmedPayment = {
      id: `payment-${Date.now()}`,
      userId: payment.userId,
      username: payment.username,
      amount: payment.amount,
      billingMonth: payment.billingMonth,
      billingYear: payment.billingYear,
      paymentDate: timestamp,
      paymentMethod: 'gcash',
      status: 'confirmed',
      referenceNumber: payment.referenceNumber,
      gcashPaymentId: payment.id,
      verifiedBy: req.user.username
    }

    payments.push(confirmedPayment)
    writeJSON(PAYMENTS_FILE, payments)

    console.log(`[GCASH-VERIFY] ✓ Payment verified and confirmed: ${paymentId}`)
    console.log(`[GCASH-VERIFY] Recorded in payments file: ${confirmedPayment.id}`)

    res.json({
      ok: true,
      message: 'Payment verified and confirmed',
      payment: confirmedPayment
    })
  } catch (err) {
    console.error(`[GCASH-VERIFY] ✗ Error:`, err.message)
    res.status(500).json({ error: 'Failed to verify payment: ' + err.message })
  }
})

// Admin: Reject GCash payment
app.post('/api/admin/gcash/reject/:paymentId', authMiddleware, (req, res) => {
  const timestamp = new Date().toISOString()
  const { paymentId } = req.params
  const { reason } = req.body || {}
  console.log(`\n[${timestamp}] [GCASH-REJECT] Admin rejecting payment: ${paymentId}`)

  if (!req.user.isAdmin) {
    console.log(`[GCASH-REJECT] ✗ REJECTED - Not admin`)
    return res.status(403).json({ error: 'Admin access required' })
  }

  try {
    const PENDING_GCASH_FILE = path.join(DATA_DIR, 'pending_gcash_payments.json')
    let pendingPayments = []
    try {
      if (fs.existsSync(PENDING_GCASH_FILE)) {
        pendingPayments = JSON.parse(fs.readFileSync(PENDING_GCASH_FILE, 'utf8'))
        if (!Array.isArray(pendingPayments)) pendingPayments = []
      }
    } catch (e) {
      console.error('[GCASH-REJECT] Error reading pending payments:', e)
      pendingPayments = []
    }

    // Find pending payment
    const paymentIndex = pendingPayments.findIndex(p => p.id === paymentId)
    if (paymentIndex === -1) {
      console.log(`[GCASH-REJECT] ✗ Payment not found: ${paymentId}`)
      return res.status(404).json({ error: 'Payment not found' })
    }

    const payment = pendingPayments[paymentIndex]
    payment.status = 'rejected'
    payment.rejectedAt = timestamp
    payment.rejectedBy = req.user.username
    payment.rejectionReason = reason || 'No reason provided'
    pendingPayments[paymentIndex] = payment

    // Save updated pending payments
    fs.writeFileSync(PENDING_GCASH_FILE, JSON.stringify(pendingPayments, null, 2))

    console.log(`[GCASH-REJECT] ✓ Payment rejected: ${paymentId}`)
    res.json({
      ok: true,
      message: 'Payment rejected',
      reason: payment.rejectionReason
    })
  } catch (err) {
    console.error(`[GCASH-REJECT] ✗ Error:`, err.message)
    res.status(500).json({ error: 'Failed to reject payment: ' + err.message })
  }
})

// User/Admin: Get payments for a user
app.get('/api/payments/:username', authMiddleware, (req, res) => {
  const { username } = req.params
  const decodedUsername = decodeURIComponent(username)
  
  // Users can only see their own payments
  if (!req.user.isAdmin && req.user.username !== decodedUsername) {
    return res.status(403).json({ error: 'Access denied' })
  }
  
  const payments = readJSON(PAYMENTS_FILE)
  const userPayments = payments.filter(p => p.username === decodedUsername)
  
  res.json({ payments: userPayments })
})

// Admin: Get payment for specific billing period
app.get('/api/admin/payments/:username/:billingMonth/:billingYear', authMiddleware, (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' })
  }
  
  const { username, billingMonth, billingYear } = req.params
  const decodedUsername = decodeURIComponent(username)
  const month = parseInt(billingMonth)
  const year = parseInt(billingYear)
  
  const payments = readJSON(PAYMENTS_FILE)
  const payment = payments.find(p => 
    p.username === decodedUsername && 
    p.billingMonth === month && 
    p.billingYear === year
  )
  
  res.json({ payment: payment || null })
})

// Admin: Delete a user by username
app.delete('/api/admin/users/:username', authMiddleware, (req, res) => {
  const timestamp = new Date().toISOString()
  console.log(`\n[${timestamp}] [DELETE-USER] Request received`)
  console.log(`[DELETE-USER] Auth: userId=${req.user.userId}, username=${req.user.username}, isAdmin=${req.user.isAdmin}`)
  
  if (!req.user.isAdmin) {
    console.log(`[DELETE-USER] ✗ REJECTED - User is not admin (isAdmin=${req.user.isAdmin})`)
    return res.status(403).json({ error: 'Admin access required' })
  }
  
  const { username } = req.params
  const decodedUsername = decodeURIComponent(username)
  console.log(`[DELETE-USER] Target username: "${username}" (decoded: "${decodedUsername}")`)
  
  const users = readJSON(USERS_FILE)
  console.log(`[DELETE-USER] Total users in database: ${users.length}`)
  
  const user = users.find(u => u.username === decodedUsername)
  console.log(`[DELETE-USER] User found: ${user ? user.username : 'NOT FOUND'}`)
  
  if (!user) {
    console.log(`[DELETE-USER] ✗ User not found for username: "${decodedUsername}"`)
    return res.status(404).json({ error: 'User not found' })
  }
  
  if (user.isAdmin) {
    console.log(`[DELETE-USER] ✗ Cannot delete admin user: ${user.username}`)
    return res.status(403).json({ error: 'Cannot delete admin users' })
  }
  
  // Remove user and their devices
  const filtered = users.filter(u => u.id !== user.id)
  writeJSON(USERS_FILE, filtered)
  console.log(`[DELETE-USER] ✓ Deleted user from users.json (now ${filtered.length} users)`)
  
  const devices = readJSON(DEVICES_FILE)
  const userDevices = devices.filter(d => d.ownerUserId !== user.id)
  if (devices.length !== userDevices.length) {
    writeJSON(DEVICES_FILE, userDevices)
    console.log(`[DELETE-USER] ✓ Removed ${devices.length - userDevices.length} devices owned by deleted user`)
  }
  
  console.log(`[DELETE-USER] ✓ SUCCESS - User deleted: ${user.username}`)
  res.json({ ok: true, message: 'User deleted', deletedUsername: user.username })
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
    let deviceReadings = allReadings.filter(r => userDevices.some(d => d.deviceId === r.deviceId))
    
    // Security: Do NOT return readings if user has no devices registered
    // Users must explicitly register a device to see readings
    
    // Sort by receivedAt (server timestamp) descending to get latest reading
    // Use receivedAt instead of timestamp since timestamp may be stuck at 1970 due to ESP32 NTP issues
    const sortedReadings = deviceReadings.sort((a, b) => new Date(b.receivedAt || b.timestamp) - new Date(a.receivedAt || a.timestamp))
    const latestReading = sortedReadings[0]
    
    // Calculate Current, Previous, and Total Consumption by billing period
    // Billing periods are based on user's account creation date (same day each month)
    const userCreatedDate = new Date(user.createdAt)
    const billingStartDay = userCreatedDate.getDate()
    
    // Get readings for current billing period
    const now = new Date()
    let currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), billingStartDay)
    if (now < currentPeriodStart) {
      currentPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, billingStartDay)
    }
    
    // Calculate previous period start
    let previousPeriodStart = new Date(currentPeriodStart)
    previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1)
    
    const currentPeriodReadings = sortedReadings.filter(r => {
      // Use receivedAt (server timestamp) instead of timestamp (which may be 1970 due to NTP sync issues)
      const date = new Date(r.receivedAt || r.timestamp)
      return date >= currentPeriodStart && date <= now
    })
    const previousPeriodReadings = sortedReadings.filter(r => {
      // Use receivedAt (server timestamp) instead of timestamp (which may be 1970 due to NTP sync issues)
      const date = new Date(r.receivedAt || r.timestamp)
      return date >= previousPeriodStart && date < currentPeriodStart
    })
    
    // Current Consumption = latest meter reading from ESP32 (cumulative total)
    const currentConsumption = latestReading ? (latestReading.cubicMeters || 0) : 0
    
    // Previous Consumption = usage in previous billing period
    const previousConsumption = previousPeriodReadings.length > 0
      ? Math.max(0, (previousPeriodReadings[0].cubicMeters || 0) - (previousPeriodReadings[previousPeriodReadings.length - 1].cubicMeters || 0))
      : 0
    
    // Total Consumption = sum of current and previous consumption
    const totalConsumption = currentConsumption + previousConsumption
    
    const monthlyBill = calculateWaterBill(currentConsumption)

    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      currentConsumption: currentConsumption,
      previousConsumption: previousConsumption,
      totalConsumption: totalConsumption,
      cubicMeters: currentConsumption,
      totalLiters: currentConsumption * 1000,
      deviceCount: userDevices.length,
      lastReading: latestReading ? latestReading.timestamp : null,
      devices: userDevices.map(d => {
        // Compute device status dynamically based on lastSeen timestamp
        // A device is considered 'online' if:
        // 1. It has sent a reading/heartbeat within the last 5 minutes, OR
        // 2. It was just registered (status is 'registered' and createdAt is recent)
        let computedStatus = 'offline';
        const now = Date.now();
        const lastSeenTime = d.lastSeen ? new Date(d.lastSeen).getTime() : null;
        const createdAtTime = d.createdAt ? new Date(d.createdAt).getTime() : null;
        
        // Within 5 minutes of last activity = online
        if (lastSeenTime && (now - lastSeenTime) < 5 * 60 * 1000) {
          computedStatus = 'online';
        }
        // Just registered (within 5 minutes of creation) and no activity yet = online (registered)
        else if (createdAtTime && (now - createdAtTime) < 5 * 60 * 1000 && !lastSeenTime) {
          computedStatus = 'online';
        }
        // Otherwise = offline
        
        return {
          deviceId: d.deviceId,
          status: computedStatus,
          lastSeen: d.lastSeen,
          createdAt: d.createdAt
        };
      }),
      monthlyBill: monthlyBill,
      dataSource: userDevices.length > 0 ? 'registered_devices' : (deviceReadings.length > 0 ? 'fallback_all_readings' : 'no_data')
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

// ==================== PAYMONGO WEBHOOK ====================
// Webhook endpoint to receive payment notifications from PayMongo
// PayMongo sends this when a payment is completed
app.post('/api/paymongo/webhook', (req, res) => {
  const timestamp = new Date().toISOString()
  console.log(`\n[${timestamp}] [PAYMONGO-WEBHOOK] Received webhook`)
  
  try {
    const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY
    if (!PAYMONGO_SECRET_KEY) {
      console.warn('[PAYMONGO-WEBHOOK] ⚠️ PAYMONGO_SECRET_KEY not configured')
      return res.status(500).json({ error: 'Server not configured for PayMongo' })
    }

    // Get raw body for signature verification
    const payload = req.body
    const paymongoSignature = req.headers['x-paymongo-signature']

    if (!paymongoSignature) {
      console.warn('[PAYMONGO-WEBHOOK] ❌ Missing x-paymongo-signature header')
      return res.status(400).json({ error: 'Missing signature' })
    }

    // Verify PayMongo signature (HMAC-SHA256)
    const bodyString = JSON.stringify(payload)
    const expectedSignature = crypto.createHmac('sha256', PAYMONGO_SECRET_KEY)
      .update(bodyString)
      .digest('hex')

    if (paymongoSignature !== expectedSignature) {
      console.warn('[PAYMONGO-WEBHOOK] ❌ Invalid signature - potential security issue')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    console.log('[PAYMONGO-WEBHOOK] ✓ Signature verified')

    // Process the webhook
    const data = payload.data
    if (!data) {
      console.warn('[PAYMONGO-WEBHOOK] ⚠️ No data in webhook payload')
      return res.status(400).json({ error: 'Invalid webhook format' })
    }

    // Handle different webhook types
    const webhookType = data.type
    console.log(`[PAYMONGO-WEBHOOK] Type: ${webhookType}`)

    if (webhookType === 'payment.paid' || webhookType === 'payment.success') {
      const attributes = data.attributes
      const paymentAmount = attributes.amount / 100 // PayMongo sends in centavos
      const paymentReference = attributes.description || attributes.reference_number
      const paymentStatus = attributes.status

      console.log(`[PAYMONGO-WEBHOOK] Payment received: ${paymentAmount} - Ref: ${paymentReference} - Status: ${paymentStatus}`)

      // Find payment in database using reference
      const payments = readJSON(PAYMENTS_FILE)
      const paymentIndex = payments.findIndex(p => 
        p.referenceNumber === paymentReference || p.paymongoId === data.id
      )

      if (paymentIndex === -1) {
        console.warn(`[PAYMONGO-WEBHOOK] ⚠️ Payment reference not found: ${paymentReference}`)
        return res.status(200).json({ ok: true, message: 'Webhook received but payment not found in system' })
      }

      const payment = payments[paymentIndex]
      console.log(`[PAYMONGO-WEBHOOK] Found payment for user: ${payment.userId}`)

      // Update payment status
      payment.status = 'verified'
      payment.verifiedAt = timestamp
      payment.paymongoId = data.id
      payment.paymongoStatus = paymentStatus

      writeJSON(PAYMENTS_FILE, payments)
      console.log(`[PAYMONGO-WEBHOOK] ✓ Payment marked as verified`)

      // TODO: Optional - Update user's bill balance if needed
      // const users = readJSON(USERS_FILE)
      // const userIndex = users.findIndex(u => u.id === payment.userId)
      // if (userIndex !== -1) {
      //   users[userIndex].monthlyBill = (users[userIndex].monthlyBill || 0) - paymentAmount
      //   writeJSON(USERS_FILE, users)
      // }

      return res.status(200).json({ ok: true, message: 'Payment verified and processed' })
    }

    // Handle other webhook types
    console.log(`[PAYMONGO-WEBHOOK] Ignoring webhook type: ${webhookType}`)
    return res.status(200).json({ ok: true, message: 'Webhook received' })

  } catch (err) {
    console.error('[PAYMONGO-WEBHOOK] Error processing webhook:', err.message)
    return res.status(500).json({ error: 'Failed to process webhook' })
  }
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

