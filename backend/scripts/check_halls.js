const db = require('../src/config/db');

async function test() {
  const [rows] = await db.query('SELECT hall_code, seat_rows, seat_cols FROM hall WHERE block_name = "EW" ORDER BY hall_number LIMIT 10');
  console.log(rows);
  process.exit();
}
test();
