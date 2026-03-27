const db = require('../src/config/db');

async function check() {
  const [rows] = await db.query('SELECT student_id, year FROM students WHERE year = 3 LIMIT 10');
  console.log('Students in year 3:', rows);

  const [allRows] = await db.query(`SELECT year, COUNT(*) as c, SUBSTRING(student_id, 1, 2) as batch FROM students GROUP BY year, batch`);
  console.log('Batch distribution by year:', allRows);
  process.exit(0);
}
check();
