const db = require('../src/config/db');

async function migrate() {
  try {
    await db.query('ALTER TABLE exam_allocation_halls ADD COLUMN faculty_id_two INT NULL AFTER faculty_name');
    await db.query('ALTER TABLE exam_allocation_halls ADD COLUMN faculty_name_two VARCHAR(150) NULL AFTER faculty_id_two');
    console.log('exam_allocation_halls updated');
  } catch(e) { console.log(e.message) }

  try {
    await db.query('ALTER TABLE exam_schedules ADD COLUMN supervisor_faculty_id_two INT NULL AFTER supervisor_name');
    await db.query('ALTER TABLE exam_schedules ADD COLUMN supervisor_name_two VARCHAR(255) NULL AFTER supervisor_faculty_id_two');
    console.log('exam_schedules updated');
  } catch(e) { console.log(e.message) }
  
  process.exit();
}

migrate();
