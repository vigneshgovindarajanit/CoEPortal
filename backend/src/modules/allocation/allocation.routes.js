const express = require('express')
const allocationController = require('./allocation.controller')

const router = express.Router()

router.get('/latest', allocationController.getLatestAllocation)
router.post('/generate', allocationController.generateAllocation)
router.post('/:id/assign-faculty', allocationController.assignFaculty)

module.exports = router
