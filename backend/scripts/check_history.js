const db = require('../src/config/db');

async function show() {
  const [allocations] = await db.query('SELECT id, created_at FROM exam_allocations ORDER BY id DESC');
  console.log('Allocations:', allocations);
  process.exit(0);
}

show();
