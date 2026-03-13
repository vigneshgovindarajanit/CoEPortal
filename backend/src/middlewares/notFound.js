const { withMobileError } = require('../utils/apiResponse')

module.exports = (req, res, next) => {
  res.status(404).json(withMobileError(req, 404, 'Not Found'))
}

