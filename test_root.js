const BASE_URL = 'https://patak-portal-production.up.railway.app';

async function testRoot() {
  try {
    const res = await fetch(BASE_URL + '/');
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.substring(0, 300));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testRoot();
