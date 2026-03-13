const COLLEGE_CODE = '7376'
const DEFAULT_START_SERIAL = 101
const DEFAULT_YEAR_LEVELS = [1, 2, 3, 4]

const DEGREE_CONFIG = {
  BE: {
    code: '1',
    label: 'BE',
    departments: {
      BM: 60,
      CE: 60,
      CD: 60,
      CS: 240,
      EE: 60,
      EC: 240,
      EI: 60,
      SE: 60,
      ME: 60,
      MZ: 60
    }
  },
  BTECH: {
    code: '2',
    label: 'B.Tech',
    departments: {
      AG: 60,
      AD: 240,
      AL: 60,
      BT: 60,
      CB: 60,
      CT: 60,
      FD: 60,
      IT: 240,
      FT: 60,
      TT: 60
    }
  }
}

const DEPARTMENT_ALIASES = {
  IS: 'SE',
  MZ: 'MZ'
}

const VALID_DEPARTMENTS = [...new Set(Object.values(DEGREE_CONFIG).flatMap((degree) => Object.keys(degree.departments)))]
const VALID_DEGREES = Object.keys(DEGREE_CONFIG)

function normalizeDepartment(input = '') {
  const normalized = String(input).trim().toUpperCase()
  return DEPARTMENT_ALIASES[normalized] || normalized
}

function normalizeStudentInput(payload = {}) {
  return {
    studentId: String(payload.studentId ?? payload.student_id ?? '')
      .trim()
      .toUpperCase(),
    studentName: String(payload.studentName ?? payload.student_name ?? '').trim(),
    studentEmail: String(payload.studentEmail ?? payload.student_email ?? '')
      .trim()
      .toLowerCase(),
    year: Number(payload.year),
    dept: normalizeDepartment(payload.dept ?? payload.department)
  }
}

function validateStudentInput(payload = {}, options = {}) {
  const partial = Boolean(options.partial)
  const normalized = normalizeStudentInput(payload)
  const errors = []

  if (!partial || payload.studentId !== undefined || payload.student_id !== undefined) {
    if (!normalized.studentId) {
      errors.push('Student ID is required')
    }
  }

  if (!partial || payload.studentName !== undefined || payload.student_name !== undefined) {
    if (!normalized.studentName) {
      errors.push('Student name is required')
    }
  }

  if (!partial || payload.studentEmail !== undefined || payload.student_email !== undefined) {
    if (!normalized.studentEmail) {
      errors.push('Student email is required')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.studentEmail)) {
      errors.push('Student email is invalid')
    }
  }

  if (!partial || payload.year !== undefined) {
    if (!Number.isInteger(normalized.year) || normalized.year < 1 || normalized.year > 4) {
      errors.push('Year must be an integer between 1 and 4')
    }
  }

  if (!partial || payload.dept !== undefined || payload.department !== undefined) {
    if (!normalized.dept) {
      errors.push('Department is required')
    } else if (!VALID_DEPARTMENTS.includes(normalized.dept)) {
      errors.push(`Department must be one of: ${VALID_DEPARTMENTS.join(', ')}`)
    }
  }

  if (errors.length > 0) {
    const err = new Error(errors.join('. '))
    err.status = 400
    throw err
  }

  return normalized
}

function normalizeDegrees(input) {
  if (!input) {
    return VALID_DEGREES
  }

  const source = Array.isArray(input) ? input : [input]
  const normalized = source
    .map((item) => String(item).trim().toUpperCase())
    .filter(Boolean)

  const unique = [...new Set(normalized)]
  for (const degree of unique) {
    if (!VALID_DEGREES.includes(degree)) {
      const err = new Error(`Degree must be one of: ${VALID_DEGREES.join(', ')}`)
      err.status = 400
      throw err
    }
  }

  return unique
}

function normalizeYearLevels(input) {
  if (!input) {
    return DEFAULT_YEAR_LEVELS
  }

  const source = Array.isArray(input) ? input : [input]
  const normalized = source
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item))

  const unique = [...new Set(normalized)]
  for (const yearLevel of unique) {
    if (!DEFAULT_YEAR_LEVELS.includes(yearLevel)) {
      const err = new Error('Year levels must be between 1 and 4')
      err.status = 400
      throw err
    }
  }

  return unique.sort((a, b) => a - b)
}

function normalizeDepartments(input, degrees = VALID_DEGREES) {
  if (!input) {
    return []
  }

  const source = Array.isArray(input) ? input : [input]
  const normalized = source
    .map((item) => normalizeDepartment(item))
    .filter(Boolean)

  const unique = [...new Set(normalized)]
  const allowedDepartments = [...new Set(
    degrees.flatMap((degree) => Object.keys(DEGREE_CONFIG[degree].departments))
  )]

  for (const department of unique) {
    if (!allowedDepartments.includes(department)) {
      const err = new Error(`Department must be one of: ${allowedDepartments.join(', ')}`)
      err.status = 400
      throw err
    }
  }

  return unique.sort((a, b) => a.localeCompare(b))
}

function parseBatchYear(input) {
  const value = Number(input)
  if (!Number.isInteger(value) || value < 0 || value > 99) {
    const err = new Error('First year batch must be a 2-digit year (00-99)')
    err.status = 400
    throw err
  }

  return value
}

function validateBulkGenerationInput(payload = {}) {
  const collegeCode = String(payload.collegeCode ?? COLLEGE_CODE).trim()
  if (!/^\d{4}$/.test(collegeCode)) {
    const err = new Error('College code must be exactly 4 digits')
    err.status = 400
    throw err
  }

  const firstYearBatchYear = parseBatchYear(payload.firstYearBatchYear)
  const degrees = normalizeDegrees(payload.degrees)
  const yearLevels = normalizeYearLevels(payload.yearLevels)
  const departments = normalizeDepartments(payload.departments, degrees)

  return {
    collegeCode,
    firstYearBatchYear,
    degrees,
    departments,
    yearLevels,
    startSerial: DEFAULT_START_SERIAL
  }
}

function buildRollNumber({ collegeCode, batchYear, degreeCode, dept, serialNo }) {
  const yy = String(batchYear).padStart(2, '0')
  const serial = String(serialNo).padStart(3, '0')
  return `${collegeCode}${yy}${degreeCode}${dept}${serial}`
}

module.exports = {
  COLLEGE_CODE,
  DEGREE_CONFIG,
  VALID_DEPARTMENTS,
  VALID_DEGREES,
  normalizeStudentInput,
  validateStudentInput,
  validateBulkGenerationInput,
  buildRollNumber
}
