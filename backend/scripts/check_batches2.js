const db = require('../src/config/db');
const fs = require('fs');
async function check() {
  const [allRows] = await db.query(`SELECT year, SUBSTRING(student_id, 5, 2) as batch, COUNT(*) as c FROM students GROUP BY year, batch`);
  fs.writeFileSync(require('path').join(__dirname, 'out.json'), JSON.stringify(allRows, null, 2));
  process.exit(0);
}
check();
