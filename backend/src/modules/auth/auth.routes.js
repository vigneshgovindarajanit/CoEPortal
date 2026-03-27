const express = require('express')
const authController = require('./auth.controller')
const authenticateRequest = require('../../middleware/auth.middleware')

const router = express.Router()

router.post('/login', authController.login)
router.get('/me', authenticateRequest, authController.me)

module.exports = router
