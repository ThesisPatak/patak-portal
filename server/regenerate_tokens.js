import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123'
const DEVICES_FILE = path.join('./data', 'devices.json')

function regenerateTokens() {
  try {
    // Read existing devices
    if (!fs.existsSync(DEVICES_FILE)) {
      console.log('❌ devices.json not found')
      return
    }

    const devices = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'))

    if (!devices || devices.length === 0) {
      console.log('⚠️  No devices found in devices.json')
      console.log('\nTo register devices:')
      console.log('1. Go to mobile app')
      console.log('2. Click "Add Device"')
      console.log('3. Enter device ID')
      console.log('4. New token will be generated automatically')
      return
    }

    console.log(`\n📱 Regenerating tokens for ${devices.length} device(s)...\n`)
    console.log('=' .repeat(80))

    const tokenMap = []

    devices.forEach((device, index) => {
      // Generate new JWT token
      const newToken = jwt.sign(
        { deviceId: device.deviceId, type: 'device' },
        JWT_SECRET,
        { expiresIn: '10y' }
      )

      tokenMap.push({
        index: index + 1,
        deviceId: device.deviceId,
        ownerUserId: device.ownerUserId,
        houseId: device.houseId,
        newToken: newToken
      })

      console.log(`\n[Device ${index + 1}]`)
      console.log(`Device ID: ${device.deviceId}`)
      console.log(`Owner ID: ${device.ownerUserId}`)
      console.log(`House ID: ${device.houseId}`)
      console.log(`\n🔑 NEW TOKEN:`)
      console.log(newToken)
    })

    console.log('\n' + '='.repeat(80))
    console.log('\n💾 Output saved to regenerated_tokens.json')

    // Write tokens to JSON file for reference
    fs.writeFileSync(
      path.join('./data', 'regenerated_tokens.json'),
      JSON.stringify(tokenMap, null, 2)
    )

    console.log('\n✅ Token regeneration complete!')
    console.log('\n📋 Next steps:')
    console.log('1. Copy the NEW TOKEN for each device')
    console.log('2. Send to ESP32 via the /device/set-token endpoint OR')
    console.log('3. Re-register devices through the mobile app (easier)')
    console.log('4. Each device will receive a fresh token after registration')

  } catch (error) {
    console.error('❌ Error regenerating tokens:', error.message)
  }
}

regenerateTokens()
