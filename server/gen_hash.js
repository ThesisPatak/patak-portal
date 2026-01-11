import bcryptjs from 'bcryptjs';
const password = 'admin123';
bcryptjs.hash(password, 10).then(hash => {
  console.log(hash);
});
