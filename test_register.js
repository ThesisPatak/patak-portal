const BASE_URL = 'https://patak-portal-production.up.railway.app';

async function testRegister() {
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `testuser_${Date.now()}`,
        password: 'TestPassword123!'
      })
    });
    console.log('Status:', res.status);
    console.log('Headers:', {
      'content-type': res.headers.get('content-type')
    });
    const text = await res.text();
    console.log('Response (first 500 chars):');
    console.log(text.substring(0, 500));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testRegister();
