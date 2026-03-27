const router = require('express').Router()
const controller = require('./courseRegistration.controller')

router.get('/', controller.getRegistrations)

module.exports = router
