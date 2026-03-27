const db = require('../src/config/db');

async function check() {
  const [rows] = await db.query('SELECT id, course_code FROM courses');
  for (const row of rows) {
    console.log(`ID: ${row.id}, Code: "${row.course_code}"`);
  }
  process.exit(0);
}
check();
