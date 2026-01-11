import bcryptjs from 'bcryptjs';

const password = 'admin123';
const hash = '$2a$10$Y2gr8aro9OGKnOdo99uLcunL.T5ocLHiPKW835V84gQfNZBh2vBZa';

bcryptjs.compare(password, hash).then(result => {
  console.log('Hash verification for "admin123":', result);
  if (!result) {
    console.log('Hash does not match! Generating new hash...');
    return bcryptjs.hash('admin123', 10);
  }
  return hash;
}).then(newHash => {
  if (typeof newHash === 'string') {
    console.log('New hash:', newHash);
  }
});
