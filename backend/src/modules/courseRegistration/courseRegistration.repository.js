const db = require('../../config/db')

async function listRegistrations({ search, department, semester, limit = 200, offset = 0 }) {
  const where = []
  const params = []

  if (search) {
    const like = `%${search}%`
    where.push('(cr.student_id LIKE ? OR s.student_name LIKE ? OR c.course_code LIKE ? OR c.course_name LIKE ?)')
    params.push(like, like, like, like)
  }

  if (department) {
    where.push('c.department = ?')
    params.push(department)
  }

  if (semester) {
    where.push('c.semester = ?')
    params.push(semester)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const [rows] = await db.query(
    `
      SELECT
        cr.id,
        cr.student_id AS studentId,
        s.student_name AS studentName,
        cr.course_id AS courseId,
        c.course_code AS courseCode,
        c.course_name AS courseName,
        c.department,
        c.semester
      FROM course_registrations cr
      LEFT JOIN students s ON s.student_id = cr.student_id
      LEFT JOIN courses c ON c.id = cr.course_id
      ${whereSql}
      ORDER BY cr.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, Number(limit), Number(offset)]
  )

  return rows
}

module.exports = { listRegistrations }
