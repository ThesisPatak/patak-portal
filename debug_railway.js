const BASE_URL = 'https://patak-portal-production.up.railway.app';

async function checkServer() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    console.log('Status:', res.status);
    console.log('Status Text:', res.statusText);
    console.log('Content-Type:', res.headers.get('content-type'));
    const text = await res.text();
    console.log('\nResponse (first 500 chars):');
    console.log(text.substring(0, 500));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

checkServer();
