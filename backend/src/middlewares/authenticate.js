const authService = require('../modules/auth/auth.service')

module.exports = function authenticateRequest(req, res, next) {
  try {
    const authHeader = req.headers.authorization || ''
    const [scheme, token] = authHeader.split(' ')

    if (scheme !== 'Bearer' || !token) {
      const err = new Error('Authentication required')
      err.status = 401
      throw err
    }

    const payload = authService.verifyToken(token)
    req.user = {
      id: Number(payload.sub),
      username: payload.username,
      role: payload.role
    }
    next()
  } catch (err) {
    next(err)
  }
}
