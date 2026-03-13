const express = require('express')
const examScheduleController = require('./examSchedule.controller')

const router = express.Router()

router.get('/', examScheduleController.listExamSchedules)
router.get('/filters', examScheduleController.listExamScheduleFilters)
router.post('/', examScheduleController.createExamSchedule)
router.put('/:id', examScheduleController.updateExamSchedule)
router.delete('/:id', examScheduleController.deleteExamSchedule)

module.exports = router

