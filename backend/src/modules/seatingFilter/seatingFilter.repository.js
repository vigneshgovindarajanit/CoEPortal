const db = require('../../config/db')

let initPromise

async function initSchema() {
  if (!initPromise) {
    initPromise = (async () => {
      await db.query(
        `
          CREATE TABLE IF NOT EXISTS seating_filters (
            id INT NOT NULL AUTO_INCREMENT,
            year_filter VARCHAR(20) NOT NULL DEFAULT 'ALL',
            exam_type VARCHAR(20) NOT NULL DEFAULT 'SEMESTER',
            exam_date DATE NULL,
            session_name VARCHAR(10) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
          )
        `
      )
    })()
  }
  await initPromise
}

async function saveSeatingFilter({ yearFilter, examType, examDate, sessionName }) {
  await initSchema()
  const [result] = await db.query(
    `
      INSERT INTO seating_filters (year_filter, exam_type, exam_date, session_name)
      VALUES (?, ?, ?, ?)
    `,
    [
      yearFilter || 'ALL',
      examType || 'SEMESTER',
      examDate || null,
      sessionName || null
    ]
  )
  return Number(result.insertId)
}

async function getLatestSeatingFilter() {
  await initSchema()
  const [rows] = await db.query(
    `
      SELECT id, year_filter, exam_type, exam_date, session_name, created_at
      FROM seating_filters
      ORDER BY id DESC
      LIMIT 1
    `
  )
  if (!rows[0]) return null
  const row = rows[0]
  return {
    id: row.id,
    yearFilter: row.year_filter,
    examType: row.exam_type,
    examDate: row.exam_date ? String(row.exam_date).substring(0, 10) : null,
    sessionName: row.session_name || null,
    createdAt: row.created_at
  }
}

module.exports = {
  saveSeatingFilter,
  getLatestSeatingFilter,
  initSchema
}
