const examScheduleService = require('./examSchedule.service')

async function listExamSchedules(req, res, next) {
  try {
    const data = await examScheduleService.getExamSchedules({
      examDate: req.query.examDate,
      examType: req.query.examType,
      department: req.query.department,
      search: req.query.search
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function listExamScheduleFilters(req, res, next) {
  try {
    const data = await examScheduleService.getExamScheduleFilters()
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function createExamSchedule(req, res, next) {
  try {
    const data = await examScheduleService.createExamSchedule(req.body)
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function updateExamSchedule(req, res, next) {
  try {
    const data = await examScheduleService.updateExamSchedule(req.params.id, req.body)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function deleteExamSchedule(req, res, next) {
  try {
    await examScheduleService.removeExamSchedule(req.params.id)
    res.status(200).json({ deleted: true })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listExamSchedules,
  listExamScheduleFilters,
  createExamSchedule,
  updateExamSchedule,
  deleteExamSchedule
}
