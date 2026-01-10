const BASE_URL = 'https://patak-portal-production.up.railway.app';

async function testEndpoints() {
  console.log('Testing Railway Production Server...\n');

  // Test 1: Health check
  console.log('1. Testing /health endpoint...');
  try {
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    console.log('✅ Health:', healthData);
  } catch (e) {
    console.log('❌ Health failed:', e.message);
  }

  // Test 2: User registration
  console.log('\n2. Testing user registration...');
  try {
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `testuser_${Date.now()}`,
        password: 'TestPassword123!'
      })
    });
    const regData = await regRes.json();
    console.log(`Status: ${regRes.status}`);
    console.log('Response:', regData);
    if (regData.token) {
      console.log('✅ Registration successful, token received');
      return regData.token;
    }
  } catch (e) {
    console.log('❌ Registration failed:', e.message);
  }

  // Test 3: Login
  console.log('\n3. Testing login...');
  try {
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        password: 'testpass'
      })
    });
    const loginData = await loginRes.json();
    console.log(`Status: ${loginRes.status}`);
    console.log('Response:', loginData);
  } catch (e) {
    console.log('❌ Login failed:', e.message);
  }

  // Test 4: Bad JSON (should be handled now)
  console.log('\n4. Testing malformed JSON handling...');
  try {
    const badRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json'
    });
    const badData = await badRes.json();
    console.log(`Status: ${badRes.status}`);
    console.log('Response:', badData);
    if (badRes.status === 400) {
      console.log('✅ Malformed JSON properly handled');
    }
  } catch (e) {
    console.log('Error caught:', e.message);
  }

  console.log('\n✅ All tests completed');
}

testEndpoints();
