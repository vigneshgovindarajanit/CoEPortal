const db = require('../src/config/db');
const crypto = require('crypto');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex')
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  return {
    passwordSalt: salt,
    passwordHash: hashPassword(password, salt)
  }
}

async function updateAdmin() {
  const passwordRecord = createPasswordRecord('admin123');
  await db.query(
    'UPDATE admin_users SET password_hash = ?, password_salt = ? WHERE username = ?',
    [passwordRecord.passwordHash, passwordRecord.passwordSalt, 'admin']
  );
  console.log('Password updated to: admin123');
  process.exit(0);
}

updateAdmin();
