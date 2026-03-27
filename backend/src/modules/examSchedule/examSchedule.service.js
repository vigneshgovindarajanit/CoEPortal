const examScheduleRepository = require('./examSchedule.repository')
const {
  EXAM_TYPES,
  SESSION_NAMES,
  getAllowedSessionsForExamType,
  isPracticalCourseName,
  validateScheduleInput
} = require('./examSchedule.model')
const courseRepository = require('../course/course.repository')
const hallRepository = require('../hall/hall.repository')

function normalizeGeneratorInput(payload = {}) {
  return {
    startDate: String(payload.startDate || payload.examDate || '').trim(),
    endDate: String(payload.endDate || '').trim(),
    sessionName: String(payload.sessionName || '')
      .trim()
      .toUpperCase(),
    examType: String(payload.examType || '')
      .trim()
      .toUpperCase(),
    department: String(payload.department || '')
      .trim()
      .toUpperCase(),
    year: Number(payload.year),
    hallCode: String(payload.hallCode || '')
      .trim()
      .toUpperCase()
      .replace(/^ALL$/, '')
  }
}

function validateGeneratorInput(payload = {}) {
  const normalized = normalizeGeneratorInput(payload)
  const errors = []

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.startDate)) {
    errors.push('Start date must be in YYYY-MM-DD format')
  }

  if (normalized.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalized.endDate)) {
    errors.push('End date must be in YYYY-MM-DD format')
  }

  if (normalized.endDate && normalized.endDate < normalized.startDate) {
    errors.push('End date must be on or after start date')
  }

  if (![...SESSION_NAMES, 'BOTH'].includes(normalized.sessionName)) {
    errors.push(`Session name must be one of: ${[...SESSION_NAMES, 'BOTH'].join(', ')}`)
  }

  if (!EXAM_TYPES.includes(normalized.examType)) {
    errors.push(`Exam type must be one of: ${EXAM_TYPES.join(', ')}`)
  }

  const allowedSessions = getAllowedSessionsForExamType(normalized.examType)

  if (
    normalized.sessionName &&
    normalized.sessionName !== 'BOTH' &&
    !allowedSessions.includes(normalized.sessionName)
  ) {
    errors.push(
      `${normalized.examType} schedules must use ${allowedSessions.join(', ')} session only`
    )
  }

  if (normalized.sessionName === 'BOTH' && allowedSessions.length === 1) {
    normalized.sessionName = allowedSessions[0]
  }

  if (!normalized.department) {
    errors.push('Department is required')
  }

  if (!Number.isInteger(normalized.year) || normalized.year < 1 || normalized.year > 4) {
    errors.push('Year must be an integer between 1 and 4')
  }

  if (errors.length > 0) {
    const err = new Error(errors.join('. '))
    err.status = 400
    throw err
  }

  return normalized
}

function addDays(dateText, daysToAdd) {
  const [year, month, day] = String(dateText).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + daysToAdd))
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function createSeededRandom(seedText) {
  let seed = 0
  for (let index = 0; index < String(seedText).length; index += 1) {
    seed = (seed * 31 + String(seedText).charCodeAt(index)) >>> 0
  }

  return function nextRandom() {
    seed += 0x6d2b79f5
    let value = seed
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleWithSeed(items, seedText) {
  const random = createSeededRandom(seedText)
  const output = [...items]

  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[output[index], output[swapIndex]] = [output[swapIndex], output[index]]
  }

  return output
}

function normalizeCourseGroupKey(course = {}) {
  return String(course.courseName || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

function getDateRange(startDate, endDate) {
  const dates = []
  let index = 0
  const lastDate = endDate || startDate

  while (true) {
    const current = addDays(startDate, index)
    dates.push(current)
    if (current >= lastDate) {
      break
    }
    index += 1
  }

  return dates
}

function formatSqlValue(value) {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return `'${String(value).replace(/'/g, "''")}'`
}

function buildValuesSql(rows = []) {
  return rows
    .map((row) =>
      `(${[
        row.examDate,
        row.sessionName,
        row.examType,
        row.courseCode,
        row.courseName,
        row.department,
        row.year,
        row.hallCode
      ]
        .map(formatSqlValue)
        .join(', ')})`
    )
    .join(',\n')
}

function compareSchedulesByDateAsc(left, right) {
  const leftDate = String(left?.examDate || '')
  const rightDate = String(right?.examDate || '')

  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate)
  }

  const leftSession = String(left?.sessionName || '')
  const rightSession = String(right?.sessionName || '')
  if (leftSession !== rightSession) {
    return leftSession.localeCompare(rightSession)
  }

  return String(left?.courseCode || '').localeCompare(String(right?.courseCode || ''))
}

async function buildGeneratedSchedules(payload = {}) {
  const input = validateGeneratorInput(payload)
  const allCourses = await courseRepository.getAll()
  const courses = allCourses.filter(
    (course) =>
      Number(course.courseYear) === input.year &&
      (
        input.examType === 'PRACTICAL'
          ? isPracticalCourseName(course.courseName)
          : !isPracticalCourseName(course.courseName)
      ) &&
      (
        input.department === 'ALL' ||
        [input.department, 'ALL'].includes(String(course.department || '').toUpperCase())
      )
  )

  if (courses.length === 0) {
    const err = new Error(`No courses found for ${input.department} year ${input.year}`)
    err.status = 404
    throw err
  }

  const activeHalls = await hallRepository.findAllByStatus(true)
  const hallsByType = activeHalls.filter(
    (hall) => String(hall.examType || '').toUpperCase() === input.examType
  )

  const halls = hallsByType.length > 0 ? hallsByType : activeHalls

  if (halls.length === 0) {
    const err = new Error(`No active halls available for ${input.examType}`)
    err.status = 409
    throw err
  }

  let selectedHalls = halls

  if (input.hallCode) {
    const preferredHall = halls.find((hall) => hall.hallCode === input.hallCode)

    if (!preferredHall) {
      const err = new Error(`Selected hall ${input.hallCode} is not active for ${input.examType}`)
      err.status = 400
      throw err
    }

    selectedHalls = [preferredHall]
  }

  const allowedSessions = getAllowedSessionsForExamType(input.examType)
  const sessionSequence = input.sessionName === 'BOTH' ? allowedSessions : [input.sessionName]
  const availableDates = getDateRange(input.startDate, input.endDate)
  const slotWindows = availableDates.flatMap((date) =>
    sessionSequence.map((sessionName) => ({
      examDate: date,
      sessionName,
      halls: shuffleWithSeed(
        selectedHalls.map((hall) => ({
          hallCode: hall.hallCode,
          capacity: Number(hall.capacity || 0)
        })),
        `${date}-${sessionName}-${input.examType}-${input.department}-${input.year}`
      )
    }))
  )

  const shuffledWindows = shuffleWithSeed(
    slotWindows,
    JSON.stringify({
      startDate: input.startDate,
      endDate: input.endDate,
      sessionName: input.sessionName,
      examType: input.examType,
      department: input.department,
      year: input.year,
      hallCode: input.hallCode
    })
  )

  const courseGroups = Array.from(
    courses.reduce((map, course) => {
      const key = normalizeCourseGroupKey(course)
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key).push(course)
      return map
    }, new Map())
  )
    .map(([groupKey, groupCourses]) => ({
      groupKey,
      courses: [...groupCourses].sort(
        (left, right) => Number(right.courseCount || 0) - Number(left.courseCount || 0)
      ),
      totalDemand: groupCourses.reduce((sum, course) => sum + Number(course.courseCount || 0), 0)
    }))
    .sort((left, right) => right.totalDemand - left.totalDemand)

  const generatedRows = []
  const usedDatesByDepartment = new Map()

  for (const courseGroup of courseGroups) {
    const windowIndex = shuffledWindows.findIndex((window) => {
      const groupDepartments = [...new Set(courseGroup.courses.map((course) => String(course.department || '').toUpperCase()))]

      const hasDepartmentConflict = groupDepartments.some((department) => {
        const usedDates = usedDatesByDepartment.get(department)
        return usedDates?.has(window.examDate)
      })

      if (hasDepartmentConflict) {
        return false
      }

      const hallsByCapacity = [...window.halls].sort(
        (left, right) => Number(right.capacity || 0) - Number(left.capacity || 0)
      )

      if (hallsByCapacity.length < courseGroup.courses.length) {
        return false
      }

      return courseGroup.courses.every(
        (course, index) => Number(hallsByCapacity[index]?.capacity || 0) >= Number(course.courseCount || 0)
      )
    })

    if (windowIndex === -1) {
      const maxCapacity = shuffledWindows.reduce(
        (highest, window) =>
          Math.max(
            highest,
            ...window.halls.map((hall) => Number(hall.capacity || 0))
          ),
        0
      )
      const err = new Error(
        `No common slot with enough seating capacity for ${courseGroup.courses
          .map((course) => course.courseCode)
          .join(', ')}. Available max hall capacity: ${maxCapacity}`
      )
      err.status = 409
      throw err
    }

    const selectedWindow = shuffledWindows[windowIndex]
    selectedWindow.halls.sort((left, right) => Number(right.capacity || 0) - Number(left.capacity || 0))

    for (const course of courseGroup.courses) {
      const requiredCapacity = Number(course.courseCount || 0)
      const hallIndex = selectedWindow.halls.findIndex(
        (hall) => Number(hall.capacity || 0) >= requiredCapacity
      )

      if (hallIndex === -1) {
        const err = new Error(`No hall with enough seating capacity for ${course.courseCode}`)
        err.status = 409
        throw err
      }

      const [hall] = selectedWindow.halls.splice(hallIndex, 1)

      generatedRows.push(
        validateScheduleInput({
          examDate: selectedWindow.examDate,
          sessionName: selectedWindow.sessionName,
          examType: input.examType,
          courseCode: course.courseCode,
          courseName: course.courseName,
          department: course.department,
          year: course.courseYear,
          hallCode: hall.hallCode
        })
      )

      const departmentKey = String(course.department || '').toUpperCase()
      if (!usedDatesByDepartment.has(departmentKey)) {
        usedDatesByDepartment.set(departmentKey, new Set())
      }
      usedDatesByDepartment.get(departmentKey).add(selectedWindow.examDate)
    }
  }

  const orderedSchedules = [...generatedRows].sort(compareSchedulesByDateAsc)

  return {
    criteria: input,
    totalCourses: courses.length,
    totalHalls: selectedHalls.length,
    schedules: orderedSchedules,
    valuesSql: buildValuesSql(orderedSchedules)
  }
}

async function getExamSchedules(filters = {}) {
  return examScheduleRepository.getAll(filters)
}

async function getExamScheduleFilters(filters = {}) {
  const data = await examScheduleRepository.getFilters(filters)
  return {
    examTypes: data.examTypes?.length ? data.examTypes : EXAM_TYPES,
    departments: data.departments || [],
    sessions: data.sessions?.length ? data.sessions : SESSION_NAMES,
    dates: data.dates || []
  }
}

async function createExamSchedule(payload = {}) {
  const schedule = validateScheduleInput(payload)
  const duplicate = await examScheduleRepository.findDuplicateSlot(schedule)
  if (duplicate) {
    const err = new Error('An exam schedule already exists for this date, session, course, and hall')
    err.status = 409
    throw err
  }

  return examScheduleRepository.create(schedule)
}

async function previewGeneratedExamSchedules(payload = {}) {
  return buildGeneratedSchedules(payload)
}

async function generateExamSchedules(payload = {}) {
  const generated = await buildGeneratedSchedules(payload)
  const created = []

  for (const schedule of generated.schedules) {
    const duplicate = await examScheduleRepository.findDuplicateSlot(schedule)
    if (duplicate) {
      const err = new Error(
        `Schedule already exists for ${schedule.examDate} ${schedule.sessionName} ${schedule.courseCode} in ${schedule.hallCode}`
      )
      err.status = 409
      throw err
    }
  }

  for (const schedule of generated.schedules) {
    created.push(await examScheduleRepository.create(schedule))
  }

  return {
    ...generated,
    created
  }
}

async function updateExamSchedule(id, payload = {}) {
  const existing = await examScheduleRepository.findById(id)
  if (!existing) {
    const err = new Error('Exam schedule not found')
    err.status = 404
    throw err
  }

  const merged = validateScheduleInput({
    examDate: payload.examDate ?? existing.examDate,
    sessionName: payload.sessionName ?? existing.sessionName,
    examType: payload.examType ?? existing.examType,
    courseCode: payload.courseCode ?? existing.courseCode,
    courseName: payload.courseName ?? existing.courseName,
    department: payload.department ?? existing.department,
    year: payload.year ?? existing.year,
    hallCode: payload.hallCode ?? existing.hallCode
  })

  const duplicate = await examScheduleRepository.findDuplicateSlot(merged, id)
  if (duplicate) {
    const err = new Error('An exam schedule already exists for this date, session, course, and hall')
    err.status = 409
    throw err
  }

  return examScheduleRepository.updateById(id, merged)
}

async function removeExamSchedule(id) {
  const deleted = await examScheduleRepository.deleteById(id)
  if (!deleted) {
    const err = new Error('Exam schedule not found')
    err.status = 404
    throw err
  }
}

async function removeAllExamSchedules() {
  const deletedCount = await examScheduleRepository.deleteAll()
  return { deletedCount }
}

module.exports = {
  getExamSchedules,
  getExamScheduleFilters,
  createExamSchedule,
  previewGeneratedExamSchedules,
  generateExamSchedules,
  updateExamSchedule,
  removeExamSchedule,
  removeAllExamSchedules
}
