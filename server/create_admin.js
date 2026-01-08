import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'

// Create admin user with hashed password
async function createAdmin() {
  const username = 'adminpatak'
  const password = 'admin123' // Change this to your desired password
  
  const passwordHash = await bcrypt.hash(password, 10)
  
  const user = {
    id: 'user-' + Date.now(),
    email: null,
    username: username,
    passwordHash: passwordHash,
    createdAt: new Date().toISOString()
  }
  
  const usersFile = path.join('./data', 'users.json')
  fs.writeFileSync(usersFile, JSON.stringify([user], null, 2))
  
  console.log('Admin user created!')
  console.log('Username:', username)
  console.log('Password:', password)
  console.log('User ID:', user.id)
}

createAdmin().catch(console.error)
