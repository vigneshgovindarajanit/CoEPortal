const db = require('../src/config/db');

async function fix() {
  const [rows] = await db.query('SELECT id, course_code FROM courses');
  let updatedCount = 0;
  for (const row of rows) {
    const original = row.course_code;
    const fixed = original.replace(/^SEM\d+\s*/i, '');
    if (original !== fixed) {
      await db.query('UPDATE courses SET course_code = ? WHERE id = ?', [fixed, row.id]);
      updatedCount++;
    }
  }
  console.log(`Updated ${updatedCount} courses.`);

  // Also verify if there are any other places with course_code, like exam_schedules
  const [examRows] = await db.query('SELECT id, course_code FROM exam_schedules');
  let examUpdatedCount = 0;
  for (const row of examRows) {
    const original = row.course_code;
    const fixed = original.replace(/^SEM\d+\s*/i, '');
    if (original !== fixed) {
      await db.query('UPDATE exam_schedules SET course_code = ? WHERE id = ?', [fixed, row.id]);
      examUpdatedCount++;
    }
  }
  console.log(`Updated ${examUpdatedCount} exam schedules.`);
  process.exit(0);
}
fix();
