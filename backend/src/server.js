require('dotenv').config()
const app = require('./app')
const authService = require('./modules/auth/auth.service')

const PORT = process.env.PORT || 4000

authService
  .ensureAuthReady()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Failed to initialize auth:', err.message)
    process.exit(1)
  })
