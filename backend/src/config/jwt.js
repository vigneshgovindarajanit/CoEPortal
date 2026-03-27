const env = require('./env')

module.exports = {
  secret: env.jwtSecret,
  expiresInSeconds: env.jwtExpiresInSeconds
}
