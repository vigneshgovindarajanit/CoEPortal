const db = require('../../config/db')
const allocationRepository = require('../allocation/allocation.repository')
const { toNumber, mapCountRows } = require('./dashboard.model')

async function safeQuery(sql, params = []) {
  try {
    const [rows] = await db.query(sql, params)
    return rows
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') {
      return []
    }
    throw err
  }
}

async function getHallMetrics() {
  const summaryRows = await safeQuery(`
    SELECT
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_halls,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive_halls,
      SUM(CASE WHEN is_active = 1 THEN capacity ELSE 0 END) AS active_capacity
    FROM hall
  `)

  const examTypeRows = await safeQuery(`
    SELECT exam_type, COUNT(*) AS total
    FROM hall
    WHERE is_active = 1
    GROUP BY exam_type
    ORDER BY total DESC, exam_type ASC
  `)

  return {
    active: toNumber(summaryRows[0]?.active_halls),
    inactive: toNumber(summaryRows[0]?.inactive_halls),
    activeCapacity: toNumber(summaryRows[0]?.active_capacity),
    byExamType: mapCountRows(examTypeRows, 'exam_type')
  }
}

async function getFacultyMetrics() {
  const summaryRows = await safeQuery(`
    SELECT
      COUNT(*) AS total_faculty,
      SUM(CASE WHEN assigned_workload > 0 THEN 1 ELSE 0 END) AS allotted_faculty,
      SUM(CASE WHEN assigned_workload = 0 THEN 1 ELSE 0 END) AS unallotted_faculty,
      SUM(assigned_workload) AS assigned_workload_total,
      SUM(max_workload) AS max_workload_total
    FROM faculty
    WHERE LOWER(role) NOT LIKE '%principal%'
  `)

  const deptRows = await safeQuery(`
    SELECT dept, COUNT(*) AS total
    FROM faculty
    WHERE LOWER(role) NOT LIKE '%principal%'
    GROUP BY dept
    ORDER BY total DESC, dept ASC
    LIMIT 8
  `)

  return {
    total: toNumber(summaryRows[0]?.total_faculty),
    allotted: toNumber(summaryRows[0]?.allotted_faculty),
    unallotted: toNumber(summaryRows[0]?.unallotted_faculty),
    assignedWorkload: toNumber(summaryRows[0]?.assigned_workload_total),
    maxWorkload: toNumber(summaryRows[0]?.max_workload_total),
    topDepartments: mapCountRows(deptRows, 'dept')
  }
}

async function getStudentMetrics() {
  const summaryRows = await safeQuery(`
    SELECT COUNT(*) AS total_students
    FROM students
  `)

  const yearRows = await safeQuery(`
    SELECT CONCAT('Year ', year) AS year_label, COUNT(*) AS total
    FROM students
    GROUP BY year
    ORDER BY year ASC
  `)

  const deptRows = await safeQuery(`
    SELECT dept, COUNT(*) AS total
    FROM students
    GROUP BY dept
    ORDER BY total DESC, dept ASC
    LIMIT 8
  `)

  return {
    total: toNumber(summaryRows[0]?.total_students),
    byYear: mapCountRows(yearRows, 'year_label'),
    topDepartments: mapCountRows(deptRows, 'dept')
  }
}

async function getCourseMetrics() {
  const summaryRows = await safeQuery(`
    SELECT
      COUNT(*) AS total_courses,
      COALESCE(SUM(course_count), 0) AS total_registrations
    FROM courses
  `)

  const typeRows = await safeQuery(`
    SELECT course_type, COUNT(*) AS total
    FROM courses
    GROUP BY course_type
    ORDER BY total DESC, course_type ASC
  `)

  const deptRows = await safeQuery(`
    SELECT department, COALESCE(SUM(course_count), 0) AS total
    FROM courses
    GROUP BY department
    ORDER BY total DESC, department ASC
    LIMIT 8
  `)

  return {
    total: toNumber(summaryRows[0]?.total_courses),
    registrations: toNumber(summaryRows[0]?.total_registrations),
    byType: mapCountRows(typeRows, 'course_type'),
    topDepartments: mapCountRows(deptRows, 'department')
  }
}

async function getScheduleMetrics() {
  const summaryRows = await safeQuery(`
    SELECT COUNT(*) AS total_schedules
    FROM exam_schedules
  `)

  const typeRows = await safeQuery(`
    SELECT exam_type, COUNT(*) AS total
    FROM exam_schedules
    GROUP BY exam_type
    ORDER BY total DESC, exam_type ASC
  `)

  const sessionRows = await safeQuery(`
    SELECT session_name, COUNT(*) AS total
    FROM exam_schedules
    GROUP BY session_name
    ORDER BY total DESC, session_name ASC
  `)

  const recentRows = await safeQuery(`
    SELECT exam_date, session_name, course_code, hall_code, exam_type
    FROM exam_schedules
    ORDER BY exam_date DESC, session_name ASC, course_code ASC
    LIMIT 8
  `)

  return {
    total: toNumber(summaryRows[0]?.total_schedules),
    byType: mapCountRows(typeRows, 'exam_type'),
    bySession: mapCountRows(sessionRows, 'session_name'),
    recent: (recentRows || []).map((row) => ({
      examDate: row.exam_date,
      sessionName: row.session_name,
      courseCode: row.course_code,
      hallCode: row.hall_code,
      examType: row.exam_type
    }))
  }
}

async function getLatestAllocationMetrics() {
  const latestAllocation = await allocationRepository.findLatestAllocation()
  if (!latestAllocation) {
    return null
  }

  const hallCount = (latestAllocation.hallLayouts || []).length
  const assignedStudents = (latestAllocation.hallLayouts || []).reduce(
    (sum, hall) => sum + toNumber(hall?.assignedCount),
    0
  )

  const studentRows = await allocationRepository.listStudentsByYear(latestAllocation.yearFilter)
  const totalStudentsInScope = (studentRows || []).length

  return {
    allocationId: latestAllocation.allocationId,
    yearFilter: latestAllocation.yearFilter,
    createdAt: latestAllocation.createdAt,
    hallCount,
    assignedStudents,
    unallocatedStudents: Math.max(totalStudentsInScope - assignedStudents, 0)
  }
}

async function getDashboardOverview() {
  const [halls, faculty, students, courses, schedules, seating] = await Promise.all([
    getHallMetrics(),
    getFacultyMetrics(),
    getStudentMetrics(),
    getCourseMetrics(),
    getScheduleMetrics(),
    getLatestAllocationMetrics()
  ])

  return {
    generatedAt: new Date().toISOString(),
    halls,
    faculty,
    students,
    courses,
    schedules,
    seating
  }
}

module.exports = {
  getDashboardOverview
}
