const db = require('../../config/db')

let initPromise

async function initSchema() {
  if (!initPromise) {
    initPromise = (async () => {
      await db.query(
        `
          CREATE TABLE IF NOT EXISTS exam_schedules (
            id INT NOT NULL AUTO_INCREMENT,
            exam_date DATE NOT NULL,
            session_name VARCHAR(10) NOT NULL,
            exam_type VARCHAR(30) NOT NULL,
            course_code VARCHAR(40) NOT NULL,
            course_name VARCHAR(255) NOT NULL,
            department VARCHAR(20) NOT NULL,
            year TINYINT NOT NULL,
            hall_code VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_exam_schedule_slot (exam_date, session_name, course_code, hall_code),
            KEY idx_exam_schedule_date (exam_date),
            KEY idx_exam_schedule_type (exam_type),
            KEY idx_exam_schedule_department (department),
            KEY idx_exam_schedule_hall (hall_code)
          )
        `
      )

      const [facultyIdColumnRows] = await db.query(
        `
          SELECT COUNT(*) AS total
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'exam_schedules'
            AND COLUMN_NAME = 'supervisor_faculty_id'
        `
      )

      if (!Number(facultyIdColumnRows[0]?.total || 0)) {
        await db.query(
          'ALTER TABLE exam_schedules ADD COLUMN supervisor_faculty_id INT NULL AFTER hall_code'
        )
      }

      const [supervisorNameColumnRows] = await db.query(
        `
          SELECT COUNT(*) AS total
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'exam_schedules'
            AND COLUMN_NAME = 'supervisor_name'
        `
      )

      if (!Number(supervisorNameColumnRows[0]?.total || 0)) {
        await db.query(
          'ALTER TABLE exam_schedules ADD COLUMN supervisor_name VARCHAR(255) NULL AFTER supervisor_faculty_id'
        )
      }
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
    examDate: row.exam_date,
    sessionName: row.session_name,
    examType: row.exam_type,
    courseCode: row.course_code,
    courseName: row.course_name,
    department: row.department,
    year: row.year,
    hallCode: row.hall_code,
    supervisorFacultyId: row.supervisor_faculty_id ? Number(row.supervisor_faculty_id) : null,
    supervisorName: row.supervisor_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function getAll(filters = {}) {
  await initSchema()

  const where = []
  const params = []

  const examDate = String(filters.examDate || '').trim()
  const examType = String(filters.examType || '')
    .trim()
    .toUpperCase()
  const department = String(filters.department || '')
    .trim()
    .toUpperCase()
  const search = String(filters.search || '').trim()

  if (examDate) {
    where.push('exam_date = ?')
    params.push(examDate)
  }

  if (examType) {
    where.push('exam_type = ?')
    params.push(examType)
  }

  if (department) {
    where.push('department = ?')
    params.push(department)
  }

  if (search) {
    where.push('(course_code LIKE ? OR course_name LIKE ? OR hall_code LIKE ?)')
    const like = `%${search}%`
    params.push(like, like, like)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const [rows] = await db.query(
    `
      SELECT
        id,
        exam_date,
        session_name,
        exam_type,
        course_code,
        course_name,
        department,
        year,
        hall_code,
        supervisor_faculty_id,
        supervisor_name,
        created_at,
        updated_at
      FROM exam_schedules
      ${whereSql}
      ORDER BY exam_date DESC, session_name ASC, course_code ASC
    `,
    params
  )

  return rows.map(mapRow)
}

async function getFilters() {
  await initSchema()
  const [rows] = await db.query(
    `
      SELECT DISTINCT exam_type, department, session_name
      FROM exam_schedules
      ORDER BY exam_type ASC, department ASC, session_name ASC
    `
  )

  const examTypes = []
  const departments = []
  const sessions = []

  for (const row of rows) {
    if (row.exam_type && !examTypes.includes(row.exam_type)) {
      examTypes.push(row.exam_type)
    }
    if (row.department && !departments.includes(row.department)) {
      departments.push(row.department)
    }
    if (row.session_name && !sessions.includes(row.session_name)) {
      sessions.push(row.session_name)
    }
  }

  return { examTypes, departments, sessions }
}

async function findById(id) {
  await initSchema()
  const [rows] = await db.query(
    `
      SELECT
        id,
        exam_date,
        session_name,
        exam_type,
        course_code,
        course_name,
        department,
        year,
        hall_code,
        supervisor_faculty_id,
        supervisor_name,
        created_at,
        updated_at
      FROM exam_schedules
      WHERE id = ?
      LIMIT 1
    `,
    [Number(id)]
  )

  return mapRow(rows[0])
}

async function findDuplicateSlot(payload, excludeId = null) {
  await initSchema()

  if (excludeId === null || excludeId === undefined) {
    const [rows] = await db.query(
      `
        SELECT id
        FROM exam_schedules
        WHERE exam_date = ?
          AND session_name = ?
          AND course_code = ?
          AND hall_code = ?
        LIMIT 1
      `,
      [payload.examDate, payload.sessionName, payload.courseCode, payload.hallCode]
    )
    return rows[0] || null
  }

  const [rows] = await db.query(
    `
      SELECT id
      FROM exam_schedules
      WHERE exam_date = ?
        AND session_name = ?
        AND course_code = ?
        AND hall_code = ?
        AND id <> ?
      LIMIT 1
    `,
    [payload.examDate, payload.sessionName, payload.courseCode, payload.hallCode, Number(excludeId)]
  )
  return rows[0] || null
}

async function create(payload) {
  await initSchema()
  const [result] = await db.query(
    `
      INSERT INTO exam_schedules
        (exam_date, session_name, exam_type, course_code, course_name, department, year, hall_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.examDate,
      payload.sessionName,
      payload.examType,
      payload.courseCode,
      payload.courseName,
      payload.department,
      payload.year,
      payload.hallCode
    ]
  )

  return findById(result.insertId)
}

async function updateById(id, payload) {
  await initSchema()
  const [result] = await db.query(
    `
      UPDATE exam_schedules
      SET
        exam_date = ?,
        session_name = ?,
        exam_type = ?,
        course_code = ?,
        course_name = ?,
        department = ?,
        year = ?,
        hall_code = ?
      WHERE id = ?
    `,
    [
      payload.examDate,
      payload.sessionName,
      payload.examType,
      payload.courseCode,
      payload.courseName,
      payload.department,
      payload.year,
      payload.hallCode,
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
  const [result] = await db.query('DELETE FROM exam_schedules WHERE id = ?', [Number(id)])
  return result.affectedRows > 0
}

module.exports = {
  getAll,
  getFilters,
  findById,
  findDuplicateSlot,
  create,
  updateById,
  deleteById
}
