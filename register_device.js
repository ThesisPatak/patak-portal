#!/usr/bin/env node
/**
 * Register a device in the database without needing the mobile app
 * Usage: node register_device.js <deviceId> [ownerUserId] [houseId]
 * 
 * Example: node register_device.js ESP32-003 user-admin house3
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Use the same DATA_DIR logic as server
const DATA_DIR = process.env.DATA_DIR || '/data' || path.join(__dirname, '..', '..', 'data')
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json')

function generateId(type) {
  return `${type}-${Date.now()}`
}

const deviceId = process.argv[2] || 'ESP32-003'
const ownerUserId = process.argv[3] || 'user-admin'
const houseId = process.argv[4] || 'house3'

console.log('\n=== DEVICE REGISTRATION HELPER ===\n')
console.log(`DATA_DIR: ${DATA_DIR}`)
console.log(`DEVICES_FILE: ${DEVICES_FILE}`)

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  console.log(`✓ Created DATA_DIR`)
}

// Read existing devices
let devices = []
if (fs.existsSync(DEVICES_FILE)) {
  try {
    devices = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'))
    console.log(`✓ Loaded ${devices.length} existing devices`)
  } catch (e) {
    console.error(`✗ Failed to parse devices.json:`, e.message)
    process.exit(1)
  }
}

// Check if device already exists
const existingIndex = devices.findIndex(d => d.deviceId === deviceId)
if (existingIndex !== -1) {
  console.log(`\n⚠ Device '${deviceId}' already registered`)
  console.log(`Owner: ${devices[existingIndex].ownerUserId}`)
  console.log(`Status: ${devices[existingIndex].status}`)
  console.log(`Created: ${devices[existingIndex].createdAt}`)
  process.exit(0)
}

// Create new device record
const newDevice = {
  deviceId,
  ownerUserId,
  houseId,
  location: 'Testing Location',
  meta: { registeredVia: 'CLI helper script' },
  status: 'registered',
  lastSeen: null,
  lastIP: null,
  createdAt: new Date().toISOString(),
  pendingToken: null,
  pendingTokenCreatedAt: null,
  lastTokenClaimedAt: null
}

devices.push(newDevice)

// Write back to file
try {
  fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2))
  console.log(`\n✓ Device registered successfully!\n`)
  console.log(`Device ID: ${deviceId}`)
  console.log(`Owner: ${ownerUserId}`)
  console.log(`House: ${houseId}`)
  console.log(`Status: registered`)
  console.log(`Created: ${newDevice.createdAt}`)
  console.log(`\nESP32 can now send authenticated readings ✓`)
} catch (e) {
  console.error(`\n✗ Failed to write devices.json:`, e.message)
  process.exit(1)
}
