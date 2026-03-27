const env = require('./src/config/env')
const app = require('./src/app')
const authService = require('./src/modules/auth/auth.service')

authService
  .ensureAuthReady()
  .then(() => {
    app.listen(env.port, () => {
      console.log(`API listening on port ${env.port}`)
    })
  })
  .catch((err) => {
    console.error('Failed to initialize auth:', err.message)
    process.exit(1)
  })
