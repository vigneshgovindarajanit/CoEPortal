const examScheduleRepository = require('./examSchedule.repository')
const { EXAM_TYPES, SESSION_NAMES, validateScheduleInput } = require('./examSchedule.model')

async function getExamSchedules(filters = {}) {
  return examScheduleRepository.getAll(filters)
}

async function getExamScheduleFilters() {
  const data = await examScheduleRepository.getFilters()
  return {
    examTypes: data.examTypes?.length ? data.examTypes : EXAM_TYPES,
    departments: data.departments || [],
    sessions: data.sessions?.length ? data.sessions : SESSION_NAMES
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

module.exports = {
  getExamSchedules,
  getExamScheduleFilters,
  createExamSchedule,
  updateExamSchedule,
  removeExamSchedule
}

