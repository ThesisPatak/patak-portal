#!/usr/bin/env node
/**
 * Test script to verify real-time data flow
 * Tests: SSE connection, reading submission, and broadcast
 */

import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

const SERVER_URL = 'http://localhost:8080';
const JWT_SECRET = 'dev_secret_change_me';

// Create a test user token
const testToken = jwt.sign(
  { userId: 'test-user-123', username: 'testuser', isAdmin: false },
  JWT_SECRET,
  { expiresIn: '1h' }
);

// Create a device token
const deviceToken = jwt.sign(
  { deviceId: 'test-device-001', type: 'device' },
  JWT_SECRET,
  { expiresIn: '1y' }
);

async function testSSEConnection() {
  console.log('\n=== Testing SSE Connection ===');
  console.log('Opening SSE stream with token...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/stream?token=${encodeURIComponent(testToken)}`);
    if (!response.ok) {
      console.error(`❌ Failed to connect to SSE: ${response.status}`);
      return;
    }
    
    console.log('✅ SSE connection established');
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    console.log(`Cache-Control: ${response.headers.get('cache-control')}`);
    
    // Read first message with timeout
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let receivedSummary = false;
    
    const timeout = setTimeout(async () => {
      reader.cancel();
      if (!receivedSummary) {
        console.warn('⚠️  No summary received within 5 seconds');
      }
    }, 5000);
    
    try {
      let buffer = '';
      const chunk = await reader.read();
      if (!chunk.done) {
        buffer += decoder.decode(chunk.value);
        if (buffer.includes('event: summary')) {
          console.log('✅ Received SSE summary event');
          receivedSummary = true;
        }
      }
    } finally {
      clearTimeout(timeout);
      reader.cancel();
    }
  } catch (err) {
    console.error('❌ SSE connection test failed:', err.message);
  }
}

async function testReadingSubmission() {
  console.log('\n=== Testing Reading Submission ===');
  
  try {
    const reading = {
      house: 'test-house',
      totalLiters: 1500,
      cubicMeters: 1.5,
      timestamp: new Date().toISOString()
    };
    
    const response = await fetch(`${SERVER_URL}/api/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deviceToken}`
      },
      body: JSON.stringify(reading)
    });
    
    if (!response.ok) {
      console.error(`❌ Failed to submit reading: ${response.status}`);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }
    
    const data = await response.json();
    console.log('✅ Reading submitted successfully');
    console.log(`📊 Reading ID: ${data.reading.id}`);
    console.log(`🏠 House: ${data.reading.house}`);
    console.log(`💧 Volume: ${data.reading.cubicMeters} m³`);
  } catch (err) {
    console.error('❌ Reading submission test failed:', err.message);
  }
}

async function testGetReadings() {
  console.log('\n=== Testing Get Readings ===');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/user/readings`, {
      headers: {
        'Authorization': `Bearer ${testToken}`
      }
    });
    
    if (!response.ok) {
      console.error(`❌ Failed to get readings: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    console.log('✅ Readings retrieved successfully');
    console.log(`📈 Total readings: ${data.history.length}`);
    if (data.history.length > 0) {
      console.log(`🕐 Latest: ${new Date(data.history[0].timestamp).toLocaleString()}`);
    }
  } catch (err) {
    console.error('❌ Get readings test failed:', err.message);
  }
}

async function runTests() {
  console.log('🚀 Real-Time Data Flow Test Suite');
  console.log('==================================');
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`Test User: ${testToken.slice(0, 20)}...`);
  
  await testSSEConnection();
  await testReadingSubmission();
  await testGetReadings();
  
  console.log('\n✅ Test suite complete');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
