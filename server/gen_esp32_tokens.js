import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123'

// Generate tokens for ESP32 devices
const deviceIds = ['esp32-001', 'esp32-002', 'esp32-003']

console.log('\n🔐 Generating Device Tokens\n')
console.log('='.repeat(80))

deviceIds.forEach((deviceId) => {
  const token = jwt.sign(
    { deviceId, type: 'device' },
    JWT_SECRET,
    { expiresIn: '10y' }
  )

  console.log(`\n[${deviceId}]`)
  console.log(`Token: ${token}`)
})

console.log('\n' + '='.repeat(80))
console.log('\n📝 Serial Command Format:')
console.log('SET_TOKEN:<token>\n')
