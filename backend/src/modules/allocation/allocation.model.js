function parseYear(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) {
    return null
  }
  return parsed
}

function normalizeYearFilter(value, rawYears) {
  const yearsInput = Array.isArray(rawYears) ? rawYears : []

  if (value === 'ALL' || yearsInput.includes('ALL')) {
    return { yearFilter: 'ALL', yearValues: null }
  }

  if (
    (value === undefined || value === null || value === '') &&
    yearsInput.length === 0
  ) {
    return { yearFilter: 'ALL', yearValues: null }
  }

  const normalizedYears = yearsInput
    .map(parseYear)
    .filter((item) => item !== null)
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .sort((a, b) => a - b)

  if (normalizedYears.length > 0) {
    return {
      yearFilter: normalizedYears.join(','),
      yearValues: normalizedYears
    }
  }

  const parsed = parseYear(value)
  if (parsed === null) {
    const err = new Error('Year must be ALL or values between 1 and 4')
    err.status = 400
    throw err
  }

  return {
    yearFilter: String(parsed),
    yearValues: [parsed]
  }
}

function normalizeDept(value) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
  return normalized || ''
}

function normalizeExamType(value) {
  const normalized = String(value || 'SEMESTER')
    .trim()
    .toUpperCase()
  const validExamTypes = ['SEMESTER', 'PERIODIC_TEST', 'PRACTICAL']
  if (!validExamTypes.includes(normalized)) {
    const err = new Error('Exam type must be SEMESTER, PERIODIC_TEST, or PRACTICAL')
    err.status = 400
    throw err
  }
  return normalized
}

function validateGeneratePayload(payload = {}) {
  const normalizedYearFilter = normalizeYearFilter(
    payload.year || payload.yearFilter,
    payload.years || payload.yearFilters
  )

  return {
    yearFilter: normalizedYearFilter.yearFilter,
    yearValues: normalizedYearFilter.yearValues,
    primaryDept: normalizeDept(payload.primaryDept),
    secondaryDept: normalizeDept(payload.secondaryDept),
    examType: normalizeExamType(payload.examType)
  }
}

function validateAllocationId(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const err = new Error('Invalid allocation id')
    err.status = 400
    throw err
  }
  return parsed
}

module.exports = {
  validateGeneratePayload,
  validateAllocationId
}
