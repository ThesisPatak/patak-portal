const qs = id => document.getElementById(id)
const base = '' // same origin

function setAuthStatus(msg) { qs('authStatus').textContent = msg }
function setDevicesStatus(msg) { qs('devicesStatus').textContent = msg }

async function registerUser() {
  const email = qs('regEmail').value
  const password = qs('regPass').value
  setAuthStatus('Registering...')
  try {
    const res = await fetch(base + '/auth/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email,password}) })
    const j = await res.json()
    if (res.ok) {
      localStorage.setItem('token', j.token)
      localStorage.setItem('userId', j.user.id)
      localStorage.setItem('userEmail', j.user.email)
      setAuthStatus('Registered and signed in')
      showDevicesSection()
    } else {
      setAuthStatus(j.error || JSON.stringify(j))
    }
  } catch (e) { setAuthStatus('Error: ' + e.message) }
}

async function loginUser() {
  const email = qs('logEmail').value
  const password = qs('logPass').value
  setAuthStatus('Signing in...')
  try {
    const res = await fetch(base + '/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email,password}) })
    const j = await res.json()
    if (res.ok && j.token) {
      localStorage.setItem('token', j.token)
      localStorage.setItem('userId', j.user.id)
      localStorage.setItem('userEmail', j.user.email)
      setAuthStatus('Signed in')
      showDevicesSection()
    } else {
      setAuthStatus(j.error || JSON.stringify(j))
    }
  } catch (e) { setAuthStatus('Error: ' + e.message) }
}

function showDevicesSection() {
  const email = localStorage.getItem('userEmail')
  if (!email) return
  qs('userEmail').textContent = email
  qs('devices').style.display = 'block'
  qs('auth').style.display = 'none'
  fetchDevices()
}

async function fetchDevices() {
  const token = localStorage.getItem('token')
  const userId = localStorage.getItem('userId')
  if (!token || !userId) return
  setDevicesStatus('Loading devices...')
  try {
    const res = await fetch(base + `/users/${userId}/devices`, { headers: { 'Authorization': 'Bearer ' + token } })
    const j = await res.json()
    if (!res.ok) { setDevicesStatus(j.error || JSON.stringify(j)); return }
    const list = qs('deviceList'); list.innerHTML = ''
    (j.devices||[]).forEach(d => {
      const li = document.createElement('li')
      li.textContent = `${d.deviceId} — ${d.status || ''} — lastSeen:${d.lastSeen || 'n/a'}`
      list.appendChild(li)
    })
    setDevicesStatus('')
  } catch (e) { setDevicesStatus('Error: ' + e.message) }
}

async function registerDevice() {
  const deviceId = qs('deviceId').value
  const deviceKey = qs('deviceKey').value
  const token = localStorage.getItem('token')
  if (!token) { setDevicesStatus('Not authenticated'); return }
  setDevicesStatus('Registering device...')
  try {
    const res = await fetch(base + '/devices/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ deviceId, deviceKey }) })
    const j = await res.json()
    if (!res.ok) { setDevicesStatus(j.error || JSON.stringify(j)); return }
    setDevicesStatus('Device registered')
    fetchDevices()
  } catch (e) { setDevicesStatus('Error: ' + e.message) }
}

async function sendHeartbeat() {
  const deviceId = qs('deviceId').value || 'dev-1'
  const deviceKey = qs('deviceKey').value || 'abc123'
  setDevicesStatus('Sending heartbeat...')
  try {
    const res = await fetch(base + '/devices/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId, deviceKey }) })
    const j = await res.json()
    if (!res.ok) setDevicesStatus(j.error || JSON.stringify(j))
    else setDevicesStatus('Heartbeat ok')
  } catch (e) { setDevicesStatus('Error: ' + e.message) }
}

// wire UI
qs('btnRegister').addEventListener('click', registerUser)
qs('btnLogin').addEventListener('click', loginUser)
qs('btnRefresh').addEventListener('click', fetchDevices)
qs('btnRegisterDevice').addEventListener('click', registerDevice)
qs('btnHeartbeat').addEventListener('click', sendHeartbeat)

// on load, show devices if already authenticated
if (localStorage.getItem('token')) showDevicesSection()
