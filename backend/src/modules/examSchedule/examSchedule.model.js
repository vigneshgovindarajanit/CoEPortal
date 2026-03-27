const EXAM_TYPES = ['SEMESTER', 'PERIODIC_TEST', 'PRACTICAL']
const SESSION_NAMES = ['FN', 'AN']

function isPracticalCourseName(courseName) {
  return /\bLAB\s*$/i.test(String(courseName || '').trim())
}

function getAllowedSessionsForExamType(examType) {
  const normalizedExamType = String(examType || '').trim().toUpperCase()

  if (normalizedExamType === 'SEMESTER') {
    return ['FN']
  }

  return SESSION_NAMES
}

function normalizeScheduleInput(payload = {}) {
  const courseName = String(payload.courseName || payload.course_name || '').trim()
  const rawExamType = String(payload.examType || payload.exam_type || '')
    .trim()
    .toUpperCase()
  const examType = isPracticalCourseName(courseName) ? 'PRACTICAL' : rawExamType

  return {
    examDate: String(payload.examDate || payload.exam_date || '').trim(),
    sessionName: String(payload.sessionName || payload.session_name || '')
      .trim()
      .toUpperCase(),
    examType,
    courseCode: String(payload.courseCode || payload.course_code || '')
      .trim()
      .toUpperCase(),
    courseName,
    department: String(payload.department || '').trim().toUpperCase(),
    year: Number(payload.year),
    hallCode: String(payload.hallCode || payload.hall_code || '')
      .trim()
      .toUpperCase()
  }
}

function isValidIsoDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

function validateScheduleInput(payload = {}) {
  const normalized = normalizeScheduleInput(payload)
  const errors = []

  if (!isValidIsoDate(normalized.examDate)) {
    errors.push('Exam date must be in YYYY-MM-DD format')
  }

  if (!EXAM_TYPES.includes(normalized.examType)) {
    errors.push(`Exam type must be one of: ${EXAM_TYPES.join(', ')}`)
  }

  const allowedSessions = getAllowedSessionsForExamType(normalized.examType)

  if (!SESSION_NAMES.includes(normalized.sessionName)) {
    errors.push(`Session name must be one of: ${SESSION_NAMES.join(', ')}`)
  } else if (!allowedSessions.includes(normalized.sessionName)) {
    errors.push(
      `${normalized.examType || 'This exam type'} schedules must use ${allowedSessions.join(', ')} session only`
    )
  }

  if (!normalized.courseCode) {
    errors.push('Course code is required')
  }

  if (!normalized.courseName) {
    errors.push('Course name is required')
  }

  if (!normalized.department) {
    errors.push('Department is required')
  }

  if (!Number.isInteger(normalized.year) || normalized.year < 1 || normalized.year > 4) {
    errors.push('Year must be an integer between 1 and 4')
  }

  if (!normalized.hallCode) {
    errors.push('Hall code is required')
  }

  if (errors.length > 0) {
    const err = new Error(errors.join('. '))
    err.status = 400
    throw err
  }

  return normalized
}

module.exports = {
  EXAM_TYPES,
  SESSION_NAMES,
  isPracticalCourseName,
  getAllowedSessionsForExamType,
  normalizeScheduleInput,
  validateScheduleInput
}
