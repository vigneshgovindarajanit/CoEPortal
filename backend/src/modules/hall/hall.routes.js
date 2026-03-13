const express = require('express')
const hallController = require('./hall.controller')

const router = express.Router()

router.get('/', hallController.listHalls)
router.get('/stats', hallController.getHallStats)
router.post('/', hallController.createHall)
router.put('/:id', hallController.updateHall)
router.patch('/:id/status', hallController.updateHallStatus)
router.delete('/:id', hallController.deleteHall)

module.exports = router
