const express = require('express')
const courseController = require('./course.controller')

const router = express.Router()

router.get('/', courseController.listCourses)
router.get('/filters', courseController.listCourseFilters)
router.post('/', courseController.createCourse)
router.put('/:id', courseController.updateCourse)

module.exports = router
