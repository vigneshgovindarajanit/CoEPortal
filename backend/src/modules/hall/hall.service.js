const hallRepository = require('./hall.repository')
const {
  validateHallInput,
  normalizeHallInput,
  getDefaultStudentsPerBenchByExamType,
  calculateCapacity,
  calculateSupervisors
} = require('./hall.model')

function normalizeSearch(search) {
  return String(search || '')
    .toLowerCase()
    .replace(/\s+/g, '')
}

async function getHalls(search = '') {
  const normalizedSearch = normalizeSearch(search)
  return hallRepository.getAll(normalizedSearch)
}

async function getHallStats() {
  return hallRepository.getStats()
}

async function createHall(payload) {
  const hall = validateHallInput(payload)
  const duplicate = await hallRepository.findByCode(hall.hallCode)
  if (duplicate) {
    const err = new Error(`Hall ${hall.hallCode} already exists`)
    err.status = 409
    throw err
  }

  return hallRepository.create(hall)
}

async function updateHall(id, payload) {
  const existing = await hallRepository.findById(id)
  if (!existing) {
    const err = new Error('Hall not found')
    err.status = 404
    throw err
  }

  const mergedPayload = {
    ...existing,
    ...payload
  }

  if (payload.examType !== undefined && payload.studentsPerBench === undefined) {
    mergedPayload.studentsPerBench = getDefaultStudentsPerBenchByExamType(
      String(payload.examType || 'SEMESTER')
        .trim()
        .toUpperCase()
    )
  }

  const hall = validateHallInput(mergedPayload)
  const duplicate = await hallRepository.findByCode(hall.hallCode, id)
  if (duplicate) {
    const err = new Error(`Hall ${hall.hallCode} already exists`)
    err.status = 409
    throw err
  }

  return hallRepository.updateById(id, hall)
}

async function setHallStatus(id, isActive) {
  const hall = await hallRepository.findById(id)
  if (!hall) {
    const err = new Error('Hall not found')
    err.status = 404
    throw err
  }

  return hallRepository.updateStatusById(id, Boolean(isActive))
}

async function removeHall(id) {
  const deleted = await hallRepository.deleteById(id)
  if (!deleted) {
    const err = new Error('Hall not found')
    err.status = 404
    throw err
  }
}

function previewHall(payload) {
  const normalized = normalizeHallInput(payload)
  const capacity = calculateCapacity(
    normalized.rows,
    normalized.cols,
    normalized.studentsPerBench,
    normalized.examType
  )
  const supervisors = calculateSupervisors(capacity, normalized.studentsPerBench)

  return { capacity, supervisors }
}

module.exports = {
  getHalls,
  getHallStats,
  createHall,
  updateHall,
  setHallStatus,
  removeHall,
  previewHall
}
