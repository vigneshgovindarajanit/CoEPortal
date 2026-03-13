const { withMobileError } = require('../utils/apiResponse')

module.exports = (err, req, res, next) => {
  const status = err.status || 500
  const message = err.message || 'Internal Server Error'
  res.status(status).json(withMobileError(req, status, message))
}

