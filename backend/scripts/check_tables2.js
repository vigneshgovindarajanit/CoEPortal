const db = require('../src/config/db');
async function show() {
  const [rows] = await db.query('SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE()');
  console.log(rows.map(r => r.TABLE_NAME).join('\n'));
  process.exit(0);
}
show();
