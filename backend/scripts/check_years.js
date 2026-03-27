const db = require('../src/config/db');

async function check() {
  const [rows] = await db.query('SELECT DISTINCT year FROM students');
  console.log('Distict years in students table:', rows.map(r => r.year));
  process.exit(0);
}
check();
