const express = require('express')
const facultyController = require('./faculty.controller')

const router = express.Router()

router.get('/', facultyController.listFaculty)
router.get('/departments', facultyController.listDepartments)
router.get('/rules', facultyController.listWorkloadRules)
router.get('/assignments/latest', facultyController.listLatestAssignments)
router.post('/', facultyController.createFaculty)
router.put('/:id', facultyController.updateFaculty)
router.post('/auto-assign', facultyController.autoAssignSupervisor)
router.post('/auto-assign-all', facultyController.autoAssignAllSupervisors)
router.post('/cancel-all-assigned', facultyController.cancelAllAssigned)
router.post('/:id/cancel-assignment', facultyController.cancelAssignment)

module.exports = router
