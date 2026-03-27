const express = require('express')
const seatingFilterController = require('./seatingFilter.controller')

const router = express.Router()

router.post('/', seatingFilterController.saveSeatingFilter)
router.get('/latest', seatingFilterController.getLatestSeatingFilter)

module.exports = router
