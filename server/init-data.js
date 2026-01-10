import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json')

// Initialize data files with default values if they don't exist
function initializeData() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    console.log('✓ Created data directory')
  }

  // Initialize users with admin if not exists
  if (!fs.existsSync(USERS_FILE)) {
    const adminUser = {
      id: 'user-1767835763822',
      email: null,
      username: 'adminpatak',
      passwordHash: '$2a$10$Sb5a67yeKmDZU2x50ZTxh.6UAV8UIoGPQfDq51jIT9ifzxc6r.uCy',
      isAdmin: true,
      createdAt: '2026-01-08T01:29:23.822Z',
      lastPasswordChange: '2026-01-08T01:53:31.451Z'
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify([adminUser], null, 2))
    console.log('✓ Created users.json with admin user')
  }

  // Initialize devices if not exists
  if (!fs.existsSync(DEVICES_FILE)) {
    fs.writeFileSync(DEVICES_FILE, JSON.stringify([], null, 2))
    console.log('✓ Created devices.json')
  }
}

initializeData()
console.log('Data initialization complete')
