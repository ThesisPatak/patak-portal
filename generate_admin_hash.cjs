const bcryptjs = require('bcryptjs');

// Generate hash for password "patak123"
const password = 'patak123';
bcryptjs.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  console.log('Password hash for "patak123":');
  console.log(hash);
  console.log('\n✅ Use this hash to update the admin user password in server/index.js');
});
