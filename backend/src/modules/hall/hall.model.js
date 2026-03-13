const VALID_BLOCKS = ['EW', 'WW', 'ME', 'SF', 'AE', 'MH']
const VALID_STUDENTS_PER_BENCH = [1, 2]
const VALID_EXAM_TYPES = ['PERIODIC_TEST', 'SEMESTER', 'PRACTICAL']
const PRACTICAL_DEFAULT_ROWS = 6
const PRACTICAL_DEFAULT_COLS = 10
const PRACTICAL_DEFAULT_STUDENTS_PER_BENCH = 1
const PRACTICAL_DEFAULT_CAPACITY = 60

function getDefaultStudentsPerBenchByExamType(examType) {
  if (examType === 'PRACTICAL') {
    return PRACTICAL_DEFAULT_STUDENTS_PER_BENCH
  }
  if (examType === 'PERIODIC_TEST') {
    return 2
  }
  return 1
}

function normalizeHallInput(payload = {}) {
  const block = String(payload.block || '')
    .trim()
    .toUpperCase()
  const number = String(payload.number || '').trim()
  const rows = Number(payload.rows)
  const cols = Number(payload.cols)
  const examType = String(payload.examType || 'SEMESTER')
    .trim()
    .toUpperCase()
  const studentsPerBenchInput =
    payload.studentsPerBench === undefined || payload.studentsPerBench === null || payload.studentsPerBench === ''
      ? getDefaultStudentsPerBenchByExamType(examType)
      : payload.studentsPerBench
  const studentsPerBench = Number(studentsPerBenchInput)
  const isActive = payload.isActive === undefined ? true : Boolean(payload.isActive)

  if (examType === 'PRACTICAL') {
    return {
      block,
      number,
      rows: PRACTICAL_DEFAULT_ROWS,
      cols: PRACTICAL_DEFAULT_COLS,
      studentsPerBench: PRACTICAL_DEFAULT_STUDENTS_PER_BENCH,
      examType,
      isActive
    }
  }

  return { block, number, rows, cols, studentsPerBench, examType, isActive }
}

function calculateCapacity(rows, cols, studentsPerBench, examType = 'SEMESTER') {
  if (examType === 'PRACTICAL') {
    return PRACTICAL_DEFAULT_CAPACITY
  }
  return rows * cols * studentsPerBench
}

function calculateSupervisors(capacity, studentsPerBench, examType = 'SEMESTER') {
  if (examType === 'PRACTICAL') {
    return 1
  }

  if (studentsPerBench === 1 && capacity >= 120) {
    return 4
  }

  if ([45, 60, 90, 120].includes(capacity)) {
    return 2
  }

  return 1
}

function validateHallInput(payload = {}) {
  const normalized = normalizeHallInput(payload)
  const errors = []

  if (!VALID_BLOCKS.includes(normalized.block)) {
    errors.push(`Block must be one of: ${VALID_BLOCKS.join(', ')}`)
  }

  if (!/^(\d+|B\d+)$/.test(normalized.number)) {
    errors.push('Number must be numeric (e.g. 101) or B-series (e.g. B01)')
  }

  if (!Number.isInteger(normalized.rows) || normalized.rows <= 0) {
    errors.push('Rows must be a positive integer')
  }

  if (!Number.isInteger(normalized.cols) || normalized.cols <= 0) {
    errors.push('Cols must be a positive integer')
  }

  if (!VALID_STUDENTS_PER_BENCH.includes(normalized.studentsPerBench)) {
    errors.push('Students per bench must be 1 or 2')
  }

  if (!VALID_EXAM_TYPES.includes(normalized.examType)) {
    errors.push('Exam type must be Periodic Test, Semester, or Practical')
  }

  if (errors.length > 0) {
    const err = new Error(errors.join('. '))
    err.status = 400
    throw err
  }

  const capacity = calculateCapacity(
    normalized.rows,
    normalized.cols,
    normalized.studentsPerBench,
    normalized.examType
  )
  const supervisors = calculateSupervisors(
    capacity,
    normalized.studentsPerBench,
    normalized.examType
  )
  const hallCode = `${normalized.block}${normalized.number}`

  return {
    ...normalized,
    hallCode,
    capacity,
    supervisors
  }
}

module.exports = {
  VALID_BLOCKS,
  VALID_STUDENTS_PER_BENCH,
  VALID_EXAM_TYPES,
  PRACTICAL_DEFAULT_ROWS,
  PRACTICAL_DEFAULT_COLS,
  PRACTICAL_DEFAULT_STUDENTS_PER_BENCH,
  PRACTICAL_DEFAULT_CAPACITY,
  getDefaultStudentsPerBenchByExamType,
  normalizeHallInput,
  calculateCapacity,
  calculateSupervisors,
  validateHallInput
}
