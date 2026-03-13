const COURSE_TYPES = ['CORE', 'ELECTIVE', 'HONOR', 'MINOR', 'ADD_ON']
const ELECTIVE_TYPES = ['PROFESSIONAL_ELECTIVE', 'OPEN_ELECTIVE']

function normalizeCourseInput(payload = {}) {
  const semester = String(payload.semester || '').trim().toUpperCase()
  const courseCode = String(payload.courseCode || '').trim().toUpperCase()
  const courseName = String(payload.courseName || '').trim()
  const courseYear = Number(payload.courseYear)
  const department = String(payload.department || '').trim().toUpperCase()
  const courseType = String(payload.courseType || '').trim().toUpperCase()
  const electiveTypeRaw = payload.electiveType
  const electiveType =
    electiveTypeRaw === null || electiveTypeRaw === undefined
      ? null
      : String(electiveTypeRaw).trim().toUpperCase()
  const courseCount = Number(payload.courseCount)

  return {
    semester,
    courseCode,
    courseName,
    courseYear,
    department,
    courseType,
    electiveType,
    courseCount
  }
}

function validateCourseInput(payload = {}) {
  const normalized = normalizeCourseInput(payload)
  const errors = []

  if (!normalized.semester) {
    errors.push('Semester is required')
  }

  if (!normalized.courseCode) {
    errors.push('Course code is required')
  }

  if (!normalized.courseName) {
    errors.push('Course name is required')
  }

  if (!Number.isInteger(normalized.courseYear) || normalized.courseYear < 1 || normalized.courseYear > 5) {
    errors.push('Course year must be an integer between 1 and 5')
  }

  if (!normalized.department) {
    errors.push('Department is required')
  }

  if (!COURSE_TYPES.includes(normalized.courseType)) {
    errors.push(`Course type must be one of: ${COURSE_TYPES.join(', ')}`)
  }

  if (normalized.courseType === 'ELECTIVE') {
    if (!ELECTIVE_TYPES.includes(normalized.electiveType || '')) {
      errors.push(`Elective type must be one of: ${ELECTIVE_TYPES.join(', ')}`)
    }
  } else {
    normalized.electiveType = null
  }

  if (!Number.isInteger(normalized.courseCount) || normalized.courseCount < 0) {
    errors.push('Course count must be a non-negative integer')
  }

  if (errors.length > 0) {
    const err = new Error(errors.join('. '))
    err.status = 400
    throw err
  }

  return normalized
}

module.exports = {
  COURSE_TYPES,
  ELECTIVE_TYPES,
  normalizeCourseInput,
  validateCourseInput
}
