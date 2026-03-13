const express = require('express')
const studentController = require('./student.controller')

const router = express.Router()

router.get('/', studentController.listStudents)
router.get('/summary', studentController.getStudentSummary)
router.post('/', studentController.createStudent)
router.post('/generate-bulk', studentController.generateBulkStudents)
router.put('/:id', studentController.updateStudent)
router.delete('/:id', studentController.deleteStudent)

module.exports = router
