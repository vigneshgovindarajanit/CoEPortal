const db = require('../../config/db')

let initPromise

async function seedIfEmpty() {
  const [countRows] = await db.query('SELECT COUNT(*) AS total FROM courses')
  const total = Number(countRows[0]?.total || 0)

  if (total > 0) {
    return
  }

  await db.query(
    `
      INSERT INTO courses
        (semester, course_code, course_name, course_year, department, course_type, elective_type, course_count)
      VALUES
        ('SEM5', 'CS301', 'Database Management Systems', 3, 'CS', 'CORE', NULL, 126),
        ('SEM5', 'CS3PE1', 'Cloud Security', 3, 'CS', 'ELECTIVE', 'PROFESSIONAL_ELECTIVE', 54),
        ('SEM5', 'OE305', 'Introduction to Economics', 3, 'ALL', 'ELECTIVE', 'OPEN_ELECTIVE', 72),
        ('SEM7', 'CS401', 'Machine Learning', 4, 'CS', 'CORE', NULL, 102),
        ('SEM7', 'HM701', 'Research Honors Seminar', 4, 'CS', 'HONOR', NULL, 18),
        ('SEM7', 'MN702', 'IoT Minor Project', 4, 'EC', 'MINOR', NULL, 24),
        ('SEM6', 'AO210', 'Career Readiness Add-On', 2, 'ALL', 'ADD_ON', NULL, 88)
    `
  )
}

async function initSchema() {
  if (!initPromise) {
    initPromise = (async () => {
      await db.query(
        `
          CREATE TABLE IF NOT EXISTS courses (
            id INT NOT NULL AUTO_INCREMENT,
            semester VARCHAR(20) NOT NULL,
            course_code VARCHAR(40) NOT NULL,
            course_name VARCHAR(255) NOT NULL,
            course_year TINYINT NOT NULL,
            department VARCHAR(20) NOT NULL,
            course_type VARCHAR(20) NOT NULL,
            elective_type VARCHAR(40) NULL,
            course_count INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_courses_code_sem (semester, course_code),
            KEY idx_courses_department (department),
            KEY idx_courses_type (course_type),
            KEY idx_courses_semester (semester)
          )
        `
      )
      await seedIfEmpty()
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
    semester: row.semester,
    courseCode: row.course_code,
    courseName: row.course_name,
    courseYear: row.course_year,
    department: row.department,
    courseType: row.course_type,
    electiveType: row.elective_type,
    courseCount: row.course_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function getAll(filters = {}) {
  await initSchema()

  const where = []
  const params = []
  const semester = String(filters.semester || '')
    .trim()
    .toUpperCase()
  const department = String(filters.department || '')
    .trim()
    .toUpperCase()
  const courseType = String(filters.courseType || '')
    .trim()
    .toUpperCase()
  const search = String(filters.search || '').trim()

  if (semester) {
    where.push('semester = ?')
    params.push(semester)
  }

  if (department) {
    where.push('department = ?')
    params.push(department)
  }

  if (courseType) {
    where.push('course_type = ?')
    params.push(courseType)
  }

  if (search) {
    where.push('(course_code LIKE ? OR course_name LIKE ?)')
    const like = `%${search}%`
    params.push(like, like)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const [rows] = await db.query(
    `
      SELECT
        id,
        semester,
        course_code,
        course_name,
        course_year,
        department,
        course_type,
        elective_type,
        course_count,
        created_at,
        updated_at
      FROM courses
      ${whereSql}
      ORDER BY semester ASC, course_year ASC, course_code ASC
    `,
    params
  )

  return rows.map(mapRow)
}

async function getFilters() {
  await initSchema()
  const [rows] = await db.query(
    `
      SELECT DISTINCT semester, department
      FROM courses
      ORDER BY semester ASC, department ASC
    `
  )

  const semesters = []
  const departments = []

  for (const row of rows) {
    if (row.semester && !semesters.includes(row.semester)) {
      semesters.push(row.semester)
    }

    if (row.department && !departments.includes(row.department)) {
      departments.push(row.department)
    }
  }

  return { semesters, departments }
}

async function findById(id) {
  await initSchema()
  const [rows] = await db.query(
    `
      SELECT
        id,
        semester,
        course_code,
        course_name,
        course_year,
        department,
        course_type,
        elective_type,
        course_count,
        created_at,
        updated_at
      FROM courses
      WHERE id = ?
      LIMIT 1
    `,
    [Number(id)]
  )

  return mapRow(rows[0])
}

async function findByCourseCode(semester, courseCode, excludeId = null) {
  await initSchema()
  if (excludeId === null || excludeId === undefined) {
    const [rows] = await db.query(
      `
        SELECT
          id,
          semester,
          course_code,
          course_name,
          course_year,
          department,
          course_type,
          elective_type,
          course_count,
          created_at,
          updated_at
        FROM courses
        WHERE semester = ? AND course_code = ?
        LIMIT 1
      `,
      [semester, courseCode]
    )
    return mapRow(rows[0])
  }

  const [rows] = await db.query(
    `
      SELECT
        id,
        semester,
        course_code,
        course_name,
        course_year,
        department,
        course_type,
        elective_type,
        course_count,
        created_at,
        updated_at
      FROM courses
      WHERE semester = ? AND course_code = ? AND id <> ?
      LIMIT 1
    `,
    [semester, courseCode, Number(excludeId)]
  )
  return mapRow(rows[0])
}

async function create(payload) {
  await initSchema()
  const [result] = await db.query(
    `
      INSERT INTO courses
        (semester, course_code, course_name, course_year, department, course_type, elective_type, course_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.semester,
      payload.courseCode,
      payload.courseName,
      payload.courseYear,
      payload.department,
      payload.courseType,
      payload.electiveType,
      payload.courseCount
    ]
  )

  return findById(result.insertId)
}

async function updateById(id, payload) {
  await initSchema()
  const [result] = await db.query(
    `
      UPDATE courses
      SET
        semester = ?,
        course_code = ?,
        course_name = ?,
        course_year = ?,
        department = ?,
        course_type = ?,
        elective_type = ?,
        course_count = ?
      WHERE id = ?
    `,
    [
      payload.semester,
      payload.courseCode,
      payload.courseName,
      payload.courseYear,
      payload.department,
      payload.courseType,
      payload.electiveType,
      payload.courseCount,
      Number(id)
    ]
  )

  if (result.affectedRows === 0) {
    return null
  }

  return findById(id)
}

module.exports = {
  getAll,
  getFilters,
  findById,
  findByCourseCode,
  create,
  updateById
}
