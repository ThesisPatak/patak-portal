import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'

// Create or reset admin user with hashed password
async function createOrResetAdmin() {
  const args = process.argv.slice(2)
  const password = args[0] || 'admin123' // Use provided password or default
  const reset = args[1] === '--reset' // Check for reset flag
  
  const usersFile = path.join('./data', 'users.json')
  let users = []
  
  // Read existing users
  try {
    if (fs.existsSync(usersFile)) {
      users = JSON.parse(fs.readFileSync(usersFile, 'utf8'))
    }
  } catch (e) {
    console.error('Error reading users file:', e.message)
  }
  
  const adminUsername = 'adminpatak'
  const existingAdminIndex = users.findIndex(u => u.username === adminUsername)
  
  const passwordHash = await bcrypt.hash(password, 10)
  
  if (existingAdminIndex !== -1 && reset) {
    // Reset existing admin password
    users[existingAdminIndex].passwordHash = passwordHash
    users[existingAdminIndex].lastPasswordChange = new Date().toISOString()
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2))
    console.log('✓ Admin password reset successfully!')
    console.log('Username: ' + adminUsername)
    console.log('New Password: ' + password)
  } else if (existingAdminIndex !== -1) {
    // Admin already exists
    console.log('Admin user already exists!')
    console.log('To reset the password, run: node create_admin.js <new_password> --reset')
  } else {
    // Create new admin user
    const user = {
      id: 'user-' + Date.now(),
      email: null,
      username: adminUsername,
      passwordHash: passwordHash,
      createdAt: new Date().toISOString()
    }
    
    users.push(user)
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2))
    
    console.log('✓ Admin user created successfully!')
    console.log('Username: ' + adminUsername)
    console.log('Password: ' + password)
    console.log('User ID: ' + user.id)
  }
}

createOrResetAdmin().catch(console.error)
