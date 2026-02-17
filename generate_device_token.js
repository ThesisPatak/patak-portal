#!/usr/bin/env node
/**
 * Generate a device token for manual ESP32 testing
 * Usage: node generate_device_token.js <deviceId> [jwt_secret]
 * 
 * Example: node generate_device_token.js ESP32-003
 */

import jwt from 'jsonwebtoken'

const deviceId = process.argv[2] || 'ESP32-001'
const jwtSecret = process.argv[3] || 'dev_secret_change_me'

const deviceToken = jwt.sign(
  { deviceId, type: 'device' },
  jwtSecret,
  { expiresIn: '10y' }
)

console.log('\n=== DEVICE TOKEN GENERATOR ===\n')
console.log(`Device ID: ${deviceId}`)
console.log(`Expires in: 10 years`)
console.log(`\nToken:\n${deviceToken}\n`)
console.log('=== HOW TO USE ===')
console.log('1. Copy the token above')
console.log('2. Open ESP32 serial monitor (9600 baud)')
console.log('3. Send command: token <paste_token_here>')
console.log('4. Device will store token and start sending readings\n')
