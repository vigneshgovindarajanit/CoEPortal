const examScheduleRepository = require('./examSchedule.repository')
const {
  EXAM_TYPES,
  SESSION_NAMES,
  getAllowedSessionsForExamType,
  isPracticalCourseName,
  validateScheduleInput
} = require('./examSchedule.model')
const courseRepository = require('../course/course.repository')
const allocationRepository = require('../allocation/allocation.repository')
const studentRepository = require('../student/student.repository')

function normalizeGeneratorInput(payload = {}) {
  const holidayDates = Array.isArray(payload.holidayDates)
    ? payload.holidayDates
    : Array.isArray(payload.holiday_dates)
      ? payload.holiday_dates
      : []

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
      .replace(/^ALL$/, ''),
    holidayDates: [...new Set(
      holidayDates
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )].sort((left, right) => left.localeCompare(right))
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

  for (const holidayDate of normalized.holidayDates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) {
      errors.push('Holiday dates must be in YYYY-MM-DD format')
      break
    }
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

function isSunday(dateText) {
  const [year, month, day] = String(dateText).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCDay() === 0
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
  const courseCode = String(course.courseCode || '')
    .trim()
    .toUpperCase()

  if (courseCode) {
    return courseCode
  }

  return String(course.courseName || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

function getDateRange(startDate, endDate, holidayDates = []) {
  const dates = []
  let index = 0
  const lastDate = endDate || startDate
  const holidayDateSet = new Set(
    holidayDates.map((value) => String(value || '').trim()).filter(Boolean)
  )

  while (true) {
    const current = addDays(startDate, index)
    if (!isSunday(current) && !holidayDateSet.has(current)) {
      dates.push(current)
    }
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

function getDayDifference(startDate, endDate) {
  const [startYear, startMonth, startDay] = String(startDate).split('-').map(Number)
  const [endYear, endMonth, endDay] = String(endDate).split('-').map(Number)
  const start = Date.UTC(startYear, startMonth - 1, startDay)
  const end = Date.UTC(endYear, endMonth - 1, endDay)
  return Math.round((end - start) / 86400000)
}

function canUseExamDateWithStudyLeave(usedDates = new Set(), examDate) {
  const orderedDates = [...usedDates].sort((left, right) => left.localeCompare(right))

  if (orderedDates.length === 0) {
    return true
  }

  const previousDate = orderedDates.filter((date) => date < examDate).pop() || null
  const nextDate = orderedDates.find((date) => date > examDate) || null

  if (previousDate) {
    const gapFromPreviousExam = getDayDifference(previousDate, examDate)
    if (gapFromPreviousExam < 2) {
      return false
    }
  }

  if (nextDate) {
    const gapToNextExam = getDayDifference(examDate, nextDate)
    if (gapToNextExam < 2) {
      return false
    }
  }

  return true
}

function getPreferredWindowOrder(slotWindows = [], targetDate) {
  return [...slotWindows].sort((left, right) => {
    const leftDistance = Math.abs(getDayDifference(left.examDate, targetDate))
    const rightDistance = Math.abs(getDayDifference(right.examDate, targetDate))

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance
    }

    if (left.examDate !== right.examDate) {
      return left.examDate.localeCompare(right.examDate)
    }

    return String(left.sessionName || '').localeCompare(String(right.sessionName || ''))
  })
}

function doesAllocationMatchYear(allocation, year) {
  const yearFilter = String(allocation?.yearFilter || '').trim().toUpperCase()
  if (!yearFilter || yearFilter === 'ALL') {
    return true
  }

  return yearFilter
    .split(',')
    .map((value) => Number(value))
    .some((value) => Number(value) === Number(year))
}

function getHallDepartmentLabelFromLayout(layout = {}) {
  const directDepartments = []

  for (const row of layout?.rows || []) {
    const dept = String(row?.dept || '')
      .trim()
      .toUpperCase()

    if (dept && dept !== '-' && !directDepartments.includes(dept)) {
      directDepartments.push(dept)
    }
  }

  if (directDepartments.length > 0) {
    return directDepartments.join(', ')
  }

  const derivedDepartments = []

  for (const row of layout?.rows || []) {
    for (const rollNo of row?.rollNumbers || []) {
      const dept = String(rollNo || '')
        .replace(/[^A-Za-z]/g, '')
        .trim()
        .toUpperCase()

      if (dept && !derivedDepartments.includes(dept)) {
        derivedDepartments.push(dept)
      }
    }
  }

  if (derivedDepartments.length > 0) {
    return derivedDepartments.join(', ')
  }

  return 'MIXED'
}

async function getScheduleHallPool(input) {
  const latestAllocation = await allocationRepository.findLatestAllocation(input.examType)

  if (latestAllocation?.hallLayouts?.length && doesAllocationMatchYear(latestAllocation, input.year)) {
    const layoutHalls = latestAllocation.hallLayouts
      .filter((layout) => Number(layout?.assignedCount || 0) > 0)
      .map((layout) => ({
        hallCode: String(layout?.hall?.hallCode || '').trim().toUpperCase(),
        capacity: Number(layout?.assignedCount || 0),
        departmentLabel: getHallDepartmentLabelFromLayout(layout)
      }))
      .filter((hall) => hall.hallCode && hall.capacity > 0)

    if (layoutHalls.length > 0) {
      return {
        halls: layoutHalls,
        source: 'seating'
      }
    }
  }

  const activeHalls = await allocationRepository.listActiveHalls(input.examType)
  return {
    halls: activeHalls.map((hall) => ({
      hallCode: String(hall.hallCode || '').trim().toUpperCase(),
      capacity: Number(hall.capacity || 0),
      departmentLabel: String(input.department || '').trim().toUpperCase() || 'ALL'
    })),
    source: 'hall'
  }
}

function getEffectiveCourseDemand(course, strengthByDepartment = {}) {
  const declaredCount = Math.max(Number(course?.courseCount || 0), 0)
  const courseDepartment = String(course?.department || '').trim().toUpperCase()

  if (!courseDepartment || courseDepartment === 'ALL') {
    return declaredCount
  }

  return Math.max(declaredCount, Number(strengthByDepartment[courseDepartment] || 0))
}

function allocateHallsForDemand(halls = [], requiredCapacity) {
  const sortedHalls = [...halls].sort((left, right) => Number(right.capacity || 0) - Number(left.capacity || 0))
  const selected = []
  let remaining = Math.max(Number(requiredCapacity || 0), 0)

  for (const hall of sortedHalls) {
    if (remaining <= 0) {
      break
    }

    selected.push(hall)
    remaining -= Number(hall.capacity || 0)
  }

  if (remaining > 0) {
    return null
  }

  return selected
}

function getGroupDemand(courseGroup, strengthByDepartment = {}) {
  const seenDepartments = new Set()
  let totalDemand = 0

  for (const course of courseGroup.courses || []) {
    const departmentKey = String(course.department || '').trim().toUpperCase()

    if (!departmentKey || departmentKey === 'ALL') {
      totalDemand += getEffectiveCourseDemand(course, strengthByDepartment)
      continue
    }

    if (seenDepartments.has(departmentKey)) {
      continue
    }

    seenDepartments.add(departmentKey)
    totalDemand += getEffectiveCourseDemand(course, strengthByDepartment)
  }

  return Math.max(totalDemand, 0)
}

async function buildGeneratedSchedules(payload = {}) {
  const input = validateGeneratorInput(payload)
  const allCourses = await courseRepository.getAll()
  const strengthByDepartment = await studentRepository.getStrengthByYearAndDepartment(input.year, input.department)
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

  const hallPool = await getScheduleHallPool(input)
  const halls = hallPool.halls

  if (halls.length === 0) {
    const err = new Error(`No active ${input.examType} halls found`)
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

  const usableHalls = selectedHalls.filter((hall) => Number(hall.capacity || 0) > 0)
  if (usableHalls.length === 0) {
    const err = new Error(`No active ${input.examType} halls found with usable capacity`)
    err.status = 409
    throw err
  }

  selectedHalls = usableHalls

  const allowedSessions = getAllowedSessionsForExamType(input.examType)
  const sessionSequence = input.sessionName === 'BOTH' ? allowedSessions : [input.sessionName]
  const availableDates = getDateRange(input.startDate, input.endDate, input.holidayDates)

  if (availableDates.length === 0) {
    const err = new Error('No valid exam dates available in the selected range. Sundays and selected holidays are not allowed.')
    err.status = 400
    throw err
  }

  const slotWindows = availableDates.flatMap((date) =>
    sessionSequence.map((sessionName) => ({
      examDate: date,
      sessionName,
      halls: shuffleWithSeed(
        selectedHalls.map((hall) => ({
          hallCode: hall.hallCode,
          capacity: Number(hall.capacity || 0),
          departmentLabel: String(hall.departmentLabel || '').trim().toUpperCase()
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
  const orderedWindows = [...shuffledWindows].sort((left, right) => {
    if (left.examDate !== right.examDate) {
      return left.examDate.localeCompare(right.examDate)
    }

    return String(left.sessionName || '').localeCompare(String(right.sessionName || ''))
  })

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
      courses: [...groupCourses].sort((left, right) => String(left.department || '').localeCompare(String(right.department || ''))),
      representativeCourse: [...groupCourses].sort(
        (left, right) => getEffectiveCourseDemand(right, strengthByDepartment) - getEffectiveCourseDemand(left, strengthByDepartment)
      )[0],
      totalDemand: getGroupDemand({ courses: groupCourses }, strengthByDepartment),
      departments: [...new Set(groupCourses.map((course) => String(course.department || '').trim().toUpperCase()).filter(Boolean))]
    }))
    .sort((left, right) => right.totalDemand - left.totalDemand)

  const generatedRows = []
  const usedDatesByDepartment = new Map()

  for (const [courseGroupIndex, courseGroup] of courseGroups.entries()) {
    const targetDateIndex =
      courseGroups.length <= 1
        ? 0
        : Math.round((courseGroupIndex * (availableDates.length - 1)) / (courseGroups.length - 1))
    const targetDate = availableDates[Math.max(0, Math.min(targetDateIndex, availableDates.length - 1))]
    const candidateWindows = getPreferredWindowOrder(orderedWindows, targetDate)

    const selectedWindow = candidateWindows.find((window) => {
      const groupDepartments = courseGroup.departments

      const hasDepartmentConflict = groupDepartments.some((department) => {
        const usedDates = usedDatesByDepartment.get(department)
        return usedDates?.has(window.examDate)
      })

      if (hasDepartmentConflict) {
        return false
      }

      const violatesStudyLeave = groupDepartments.some((department) => {
        const usedDates = usedDatesByDepartment.get(department) || new Set()
        return !canUseExamDateWithStudyLeave(usedDates, window.examDate)
      })

      if (violatesStudyLeave) {
        return false
      }

      const hallsByCapacity = [...window.halls].sort(
        (left, right) => Number(right.capacity || 0) - Number(left.capacity || 0)
      )

      const workingHalls = [...hallsByCapacity]
      const allocatedHalls = allocateHallsForDemand(workingHalls, courseGroup.totalDemand)

      if (!allocatedHalls) {
        return false
      }

      return true
    })

    if (!selectedWindow) {
      const maxCapacity = orderedWindows.reduce(
        (highest, window) =>
          Math.max(
            highest,
            ...window.halls.map((hall) => Number(hall.capacity || 0))
          ),
        0
      )

      if (maxCapacity <= 0) {
        const err = new Error(`No active ${input.examType} halls found with usable capacity`)
        err.status = 409
        throw err
      }

      const err = new Error(
        `Unable to place ${courseGroup.representativeCourse?.courseCode || courseGroup.groupKey} with the required hall capacity and at least 1 full day gap between exams. Available max hall capacity: ${maxCapacity}`
      )
      err.status = 409
      throw err
    }

    selectedWindow.halls.sort((left, right) => Number(right.capacity || 0) - Number(left.capacity || 0))

    const allocatedHalls = allocateHallsForDemand(selectedWindow.halls, courseGroup.totalDemand)

    if (!allocatedHalls) {
      const err = new Error(`No hall set with enough seating capacity for ${courseGroup.representativeCourse?.courseCode || courseGroup.groupKey}`)
      err.status = 409
      throw err
    }

    for (const hall of allocatedHalls) {
      const hallIndex = selectedWindow.halls.findIndex((item) => item.hallCode === hall.hallCode)
      if (hallIndex >= 0) {
        selectedWindow.halls.splice(hallIndex, 1)
      }

      generatedRows.push(
        validateScheduleInput({
          examDate: selectedWindow.examDate,
          sessionName: selectedWindow.sessionName,
          examType: input.examType,
          courseCode: courseGroup.representativeCourse?.courseCode,
          courseName: courseGroup.representativeCourse?.courseName,
          department: hall.departmentLabel || courseGroup.departments.join('/'),
          year: courseGroup.representativeCourse?.courseYear,
          hallCode: hall.hallCode
        })
      )
    }

    for (const departmentKey of courseGroup.departments) {
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
