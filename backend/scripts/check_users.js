const db = require('../src/config/db');

async function test() {
  try {
    const [rows] = await db.query('SELECT * FROM admin_users');
    console.log('Admin users:', rows);
  } catch (err) {
    console.log('Error:', err);
  }
}

test().then(() => process.exit(0));
