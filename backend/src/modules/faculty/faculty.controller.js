const facultyService = require('./faculty.service')

async function listFaculty(req, res, next) {
  try {
    const data = await facultyService.getFaculty({
      search: req.query.search,
      department: req.query.department
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function listDepartments(req, res, next) {
  try {
    const data = await facultyService.getDepartments()
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function listWorkloadRules(req, res, next) {
  try {
    const data = facultyService.getWorkloadRules()
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function createFaculty(req, res, next) {
  try {
    const data = await facultyService.createFaculty(req.body)
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function updateFaculty(req, res, next) {
  try {
    const data = await facultyService.updateFaculty(req.params.id, req.body)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function autoAssignSupervisor(req, res, next) {
  try {
    const data = await facultyService.autoAssignSupervisor(req.body)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function autoAssignAllSupervisors(req, res, next) {
  try {
    const data = await facultyService.autoAssignAllSupervisors()
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function listLatestAssignments(req, res, next) {
  try {
    const data = await facultyService.getLatestAssignments()
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function cancelAssignment(req, res, next) {
  try {
    const data = await facultyService.cancelAssignment(req.params.id)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function cancelAllAssigned(req, res, next) {
  try {
    const data = await facultyService.cancelAllAssigned()
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listFaculty,
  listDepartments,
  listWorkloadRules,
  createFaculty,
  updateFaculty,
  autoAssignSupervisor,
  autoAssignAllSupervisors,
  listLatestAssignments,
  cancelAssignment,
  cancelAllAssigned
}
