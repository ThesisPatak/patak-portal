let fetchFn = globalThis.fetch
async function run() {
  if (!fetchFn) {
    try { fetchFn = (await import('node-fetch')).default } catch (e) { throw new Error('fetch not available; install node-fetch') }
  }
  const fetch = fetchFn
  
  const base = 'https://patak-portal-production.up.railway.app'
  console.log('Registering user...')
  const r1 = await fetch(base + '/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'secret' })
  })
  const j1 = await r1.json().catch(() => ({}))
  console.log('register:', r1.status, j1)

  console.log('Logging in...')
  const r2 = await fetch(base + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'secret' })
  })
  const j2 = await r2.json().catch(() => ({}))
  console.log('login:', r2.status, j2)
  const token = j2.token

  if (!token) {
    console.error('No token, aborting device register test')
    return
  }

  console.log('Registering device with token...')
  const r3 = await fetch(base + '/devices/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ deviceId: 'dev-1', deviceKey: 'abc123' })
  })
  const j3 = await r3.json().catch(() => ({}))
  console.log('device register:', r3.status, j3)

  console.log('Sending device heartbeat (device authenticates with key)...')
  const r4 = await fetch(base + '/devices/heartbeat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'dev-1', deviceKey: 'abc123' })
  })
  const j4 = await r4.json().catch(() => ({}))
  console.log('heartbeat:', r4.status, j4)
}

run().catch(err => { console.error('Test failed', err) })
