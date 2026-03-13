const db = require('../../config/db')
let initPromise

async function initSchema() {
  if (!initPromise) {
    initPromise = (async () => {
      await db.query(
        `
          CREATE TABLE IF NOT EXISTS students (
            id INT NOT NULL AUTO_INCREMENT,
            student_id VARCHAR(50) NOT NULL,
            student_name VARCHAR(150) NOT NULL,
            student_email VARCHAR(150) NOT NULL,
            year TINYINT NOT NULL,
            dept VARCHAR(5) NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_students_student_id (student_id),
            UNIQUE KEY uq_students_student_email (student_email),
            KEY idx_students_year (year),
            KEY idx_students_dept (dept)
          )
        `
      )

      const [columnRows] = await db.query(
        `
          SELECT COUNT(*) AS total
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'students'
            AND COLUMN_NAME = 'dept'
        `
      )

      if (!Number(columnRows[0]?.total || 0)) {
        await db.query('ALTER TABLE students ADD COLUMN dept VARCHAR(5) NOT NULL DEFAULT "CS"')
      }

      const [indexRows] = await db.query(
        `
          SELECT COUNT(*) AS total
          FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'students'
            AND INDEX_NAME = 'idx_students_dept'
        `
      )

      if (!Number(indexRows[0]?.total || 0)) {
        await db.query('CREATE INDEX idx_students_dept ON students(dept)')
      }

      await db.query(
        `
          UPDATE students
          SET student_email = REPLACE(student_email, '@students.coeportal.local', '@bitsathy.ac.in')
          WHERE student_email LIKE '%@students.coeportal.local'
        `
      )
    })()
  }

  await initPromise
}

function mapRow(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentEmail: row.student_email,
    year: row.year,
    dept: row.dept
  }
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

async function getAll(filters = {}) {
  await initSchema()
  const search = String(filters.search || '').trim()
  const year = filters.year === undefined || filters.year === '' ? null : Number(filters.year)
  const dept = String(filters.dept || '').trim().toUpperCase()
  const page = toPositiveInt(filters.page, 1)
  const requestedPageSize = toPositiveInt(filters.pageSize, 30)
  const pageSize = Math.min(requestedPageSize, 100)
  const offset = (page - 1) * pageSize

  const where = []
  const params = []

  if (search) {
    where.push(
      '(student_id LIKE ? OR student_name LIKE ? OR student_email LIKE ? OR dept LIKE ? OR CAST(year AS CHAR) LIKE ?)'
    )
    const like = `%${search}%`
    params.push(like, like, like, like, like)
  }

  if (year !== null && Number.isInteger(year)) {
    where.push('year = ?')
    params.push(year)
  }

  if (dept) {
    where.push('dept = ?')
    params.push(dept)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const [countRows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM students
      ${whereSql}
    `,
    params
  )

  const total = Number(countRows[0]?.total || 0)

  const [rows] = await db.query(
    `
      SELECT id, student_id, student_name, student_email, year, dept
      FROM students
      ${whereSql}
      ORDER BY dept ASC, year ASC, student_id ASC
      LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset]
  )

  return {
    items: rows.map(mapRow),
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1)
  }
}

async function getSummary() {
  await initSchema()

  const [totalRows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM students
    `
  )

  const [yearRows] = await db.query(
    `
      SELECT year, COUNT(*) AS total
      FROM students
      GROUP BY year
    `
  )

  const byYear = yearRows.reduce((acc, row) => {
    acc[String(row.year)] = Number(row.total || 0)
    return acc
  }, {})

  return {
    total: Number(totalRows[0]?.total || 0),
    byYear
  }
}

async function findById(id) {
  await initSchema()
  const [rows] = await db.query(
    `
      SELECT id, student_id, student_name, student_email, year, dept
      FROM students
      WHERE id = ?
      LIMIT 1
    `,
    [Number(id)]
  )
  return mapRow(rows[0])
}

async function findByStudentId(studentId, excludeId = null) {
  await initSchema()
  if (excludeId === null || excludeId === undefined) {
    const [rows] = await db.query(
      'SELECT id, student_id, student_name, student_email, year, dept FROM students WHERE student_id = ? LIMIT 1',
      [studentId]
    )
    return mapRow(rows[0])
  }

  const [rows] = await db.query(
    'SELECT id, student_id, student_name, student_email, year, dept FROM students WHERE student_id = ? AND id <> ? LIMIT 1',
    [studentId, Number(excludeId)]
  )
  return mapRow(rows[0])
}

async function findByEmail(studentEmail, excludeId = null) {
  await initSchema()
  if (excludeId === null || excludeId === undefined) {
    const [rows] = await db.query(
      'SELECT id, student_id, student_name, student_email, year, dept FROM students WHERE student_email = ? LIMIT 1',
      [studentEmail]
    )
    return mapRow(rows[0])
  }

  const [rows] = await db.query(
    'SELECT id, student_id, student_name, student_email, year, dept FROM students WHERE student_email = ? AND id <> ? LIMIT 1',
    [studentEmail, Number(excludeId)]
  )
  return mapRow(rows[0])
}

async function findAllByDept(dept) {
  await initSchema()
  const [rows] = await db.query(
    'SELECT id, student_id, student_name, student_email, year, dept FROM students WHERE dept = ? ORDER BY year ASC, student_id ASC',
    [dept]
  )
  return rows.map(mapRow)
}

async function create(payload) {
  await initSchema()
  const [result] = await db.query(
    `
      INSERT INTO students (student_id, student_name, student_email, year, dept)
      VALUES (?, ?, ?, ?, ?)
    `,
    [payload.studentId, payload.studentName, payload.studentEmail, payload.year, payload.dept]
  )
  return findById(result.insertId)
}

async function bulkCreate(payload = []) {
  await initSchema()
  if (!Array.isArray(payload) || payload.length === 0) {
    return { attempted: 0, inserted: 0 }
  }

  const placeholders = payload.map(() => '(?, ?, ?, ?, ?)').join(', ')
  const params = payload.flatMap((student) => [
    student.studentId,
    student.studentName,
    student.studentEmail,
    student.year,
    student.dept
  ])

  const [result] = await db.query(
    `
      INSERT IGNORE INTO students (student_id, student_name, student_email, year, dept)
      VALUES ${placeholders}
    `,
    params
  )

  return {
    attempted: payload.length,
    inserted: Number(result.affectedRows || 0)
  }
}

async function updateById(id, payload) {
  await initSchema()
  const [result] = await db.query(
    `
      UPDATE students
      SET student_id = ?, student_name = ?, student_email = ?, year = ?, dept = ?
      WHERE id = ?
    `,
    [
      payload.studentId,
      payload.studentName,
      payload.studentEmail,
      payload.year,
      payload.dept,
      Number(id)
    ]
  )

  if (result.affectedRows === 0) {
    return null
  }

  return findById(id)
}

async function deleteById(id) {
  await initSchema()
  const [result] = await db.query('DELETE FROM students WHERE id = ?', [Number(id)])
  return result.affectedRows > 0
}

module.exports = {
  getAll,
  getSummary,
  findById,
  findByStudentId,
  findByEmail,
  findAllByDept,
  create,
  bulkCreate,
  updateById,
  deleteById
}
