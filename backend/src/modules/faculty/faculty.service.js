const facultyRepository = require('./faculty.repository')
const { validateFacultyInput, isPrincipalRole, getRoleRules } = require('./faculty.model')

async function getFaculty(filters = {}) {
  return facultyRepository.listFaculty(filters)
}

async function getDepartments() {
  return facultyRepository.listDepartments()
}

async function createFaculty(payload = {}) {
  const faculty = validateFacultyInput(payload)
  if (isPrincipalRole(faculty.role)) {
    const err = new Error('Principal is excluded from supervisor workload assignment')
    err.status = 400
    throw err
  }

  return facultyRepository.createFaculty({
    ...faculty,
    currentWorkload: faculty.currentWorkload ?? 0,
    isActive: faculty.isActive ?? true
  })
}

async function updateFaculty(id, payload = {}) {
  const existing = await facultyRepository.findById(id)
  if (!existing) {
    const err = new Error('Faculty not found')
    err.status = 404
    throw err
  }

  const merged = {
    fullName: payload.fullName ?? existing.fullName,
    department: payload.department ?? existing.department,
    role: payload.role ?? existing.role,
    currentWorkload:
      payload.currentWorkload === undefined
        ? existing.currentWorkload
        : Number(payload.currentWorkload),
    isActive: payload.isActive === undefined ? existing.isActive : Boolean(payload.isActive)
  }

  const normalized = validateFacultyInput(merged)
  if (isPrincipalRole(normalized.role)) {
    const err = new Error('Principal is excluded from supervisor workload assignment')
    err.status = 400
    throw err
  }

  if (normalized.currentWorkload > normalized.maxWorkload) {
    const err = new Error('Current workload cannot exceed max workload for selected role')
    err.status = 400
    throw err
  }

  return facultyRepository.updateFacultyById(id, {
    ...normalized,
    manualHallCode: payload.manualHallCode
  })
}

async function autoAssignSupervisor(payload = {}) {
  return facultyRepository.autoAssignSupervisor(payload)
}

async function autoAssignAllSupervisors(payload = {}) {
  return facultyRepository.autoAssignAllLatestAllocation(payload)
}

async function getLatestAssignments() {
  return facultyRepository.listLatestAllocationAssignments()
}

async function getHistoricalAssignments() {
  return facultyRepository.listHistoricalAssignments()
}

async function cancelAssignment(id) {
  const existing = await facultyRepository.findById(id)
  if (!existing) {
    const err = new Error('Faculty not found')
    err.status = 404
    throw err
  }

  return facultyRepository.clearAssignedWorkloadById(id)
}

async function cancelAllAssigned() {
  return facultyRepository.cancelAllAssignments()
}

function getWorkloadRules() {
  return getRoleRules()
}

module.exports = {
  getFaculty,
  getDepartments,
  createFaculty,
  updateFaculty,
  autoAssignSupervisor,
  autoAssignAllSupervisors,
  getLatestAssignments,
  getHistoricalAssignments,
  cancelAssignment,
  cancelAllAssigned,
  getWorkloadRules
}
