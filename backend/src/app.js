const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const apiRoutes = require('./routes/index.routes')
const notFound = require('./middleware/notFound')
const errorHandler = require('./middleware/error.middleware')
const { withMobileEnvelope } = require('./utils/response')

const app = express()

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))
app.use((req, res, next) => {
  const originalJson = res.json.bind(res)
  res.json = (payload) => {
    if (res.statusCode >= 400) {
      return originalJson(payload)
    }

    return originalJson(withMobileEnvelope(req, payload))
  }
  next()
})

app.get('/', (req, res) => {
  res.json({ message: 'COE Portal API' })
})

app.use('/api', apiRoutes)
app.use(notFound)
app.use(errorHandler)

module.exports = app
