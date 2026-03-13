const authService = require('./auth.service')

async function login(req, res, next) {
  try {
    const data = await authService.login(req.body)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function me(req, res, next) {
  try {
    const data = await authService.getProfile(req.user)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  login,
  me
}
