#!/usr/bin/env node
/**
 * ESP32 Device Setup & Testing Script
 * 
 * This script:
 * 1. Registers a test device in the database
 * 2. Sets up device token
 * 3. Sends test reading to verify the endpoint works
 */

const fs = require('fs');
const path = require('path');

// Paths
const DEVICES_FILE = path.join(__dirname, 'server/data/devices.json');
const READINGS_FILE = path.join(__dirname, 'server/data/readings.json');

// Utility to generate IDs matching server format
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
}

// Read JSON file
function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

// Write JSON file
function writeJSON(file, obj) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

console.log('\n===========================================');
console.log('🔧 ESP32 DEVICE SETUP SCRIPT');
console.log('===========================================\n');

// Step 1: Register test device
console.log('📝 Step 1: Registering test device...');

const devices = readJSON(DEVICES_FILE);
const testDeviceId = 'ESP32-001';
const testDeviceToken = generateId('device');

// Check if device already exists
let device = devices.find(d => d.deviceId === testDeviceId);

if (device) {
  console.log(`✓ Device ${testDeviceId} already exists`);
  console.log(`  Token: ${device.deviceToken || '[NOT SET]'}`);
} else {
  device = {
    deviceId: testDeviceId,
    deviceToken: testDeviceToken,
    ownerUserId: 'test-user-001',
    status: 'registered',
    lastSeen: null,
    createdAt: new Date().toISOString()
  };
  
  devices.push(device);
  writeJSON(DEVICES_FILE, devices);
  console.log(`✓ Device registered: ${testDeviceId}`);
}

// Step 2: Create sample readings
console.log('\n📊 Step 2: Creating sample readings...');

const readings = readJSON(READINGS_FILE);

// Add 5 sample readings from different times
const now = new Date();
const sampleReadings = [
  {
    totalLiters: 100.5,
    cubicMeters: 0.1005,
    hoursAgo: 4
  },
  {
    totalLiters: 234.8,
    cubicMeters: 0.2348,
    hoursAgo: 3
  },
  {
    totalLiters: 456.2,
    cubicMeters: 0.4562,
    hoursAgo: 2
  },
  {
    totalLiters: 678.9,
    cubicMeters: 0.6789,
    hoursAgo: 1
  },
  {
    totalLiters: 1234.567,
    cubicMeters: 1.234567,
    hoursAgo: 0
  }
];

let addedCount = 0;
for (const sample of sampleReadings) {
  const timestamp = new Date(now.getTime() - sample.hoursAgo * 60 * 60 * 1000);
  
  const reading = {
    id: generateId('reading'),
    deviceId: testDeviceId,
    house: 'house1',
    totalLiters: sample.totalLiters,
    cubicMeters: sample.cubicMeters,
    timestamp: timestamp.toISOString(),
    receivedAt: timestamp.toISOString()
  };
  
  // Check if similar reading already exists
  const exists = readings.find(r => 
    r.deviceId === reading.deviceId && 
    r.timestamp === reading.timestamp
  );
  
  if (!exists) {
    readings.push(reading);
    addedCount++;
  }
}

writeJSON(READINGS_FILE, readings);
console.log(`✓ Added ${addedCount} sample readings`);

// Step 3: Display setup summary
console.log('\n✅ SETUP COMPLETE!\n');
console.log('Device Information:');
console.log(`  Device ID:    ${testDeviceId}`);
console.log(`  Device Token: ${device.deviceToken}`);
console.log(`  Owner User:   ${device.ownerUserId}`);
console.log(`  Status:       ${device.status}`);
console.log(`  Created:      ${device.createdAt}`);

console.log('\nReading Information:');
console.log(`  Total readings in database: ${readings.length}`);
console.log(`  Latest reading: ${readings[readings.length - 1]?.timestamp}`);

console.log('\n📱 NEXT STEPS:\n');
console.log('1. For Physical ESP32:');
console.log(`   Open Serial Monitor (115200 baud)`);
console.log(`   Type: token ${device.deviceToken}`);
console.log(`   This registers your device with the backend\n`);

console.log('2. Test via curl:');
console.log(`   curl -X POST http://localhost:4000/api/readings \\`);
console.log(`     -H "Content-Type: application/json" \\`);
console.log(`     -H "Authorization: Bearer ${device.deviceToken}" \\`);
console.log(`     -d '{"house":"house1","totalLiters":1500,"cubicMeters":1.5}'\n`);

console.log('3. View readings via API:');
console.log(`   curl http://localhost:4000/api/readings/${testDeviceId} \\`);
console.log(`     -H "Authorization: Bearer <admin_token>"\n`);

console.log('4. Check in Mobile App:');
console.log(`   Device should appear in dashboard if user is linked\n`);

console.log('===========================================\n');
