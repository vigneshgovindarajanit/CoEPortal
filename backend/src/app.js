const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const authRoutes = require('./modules/auth/auth.routes')
const hallRoutes = require('./modules/hall/hall.routes')
const facultyRoutes = require('./modules/faculty/faculty.routes')
const studentRoutes = require('./modules/student/student.routes')
const courseRoutes = require('./modules/course/course.routes')
const courseRegistrationRoutes = require('./modules/courseRegistration/courseRegistration.routes')
const allocationRoutes = require('./modules/allocation/allocation.routes')
const examScheduleRoutes = require('./modules/examSchedule/examSchedule.routes')
const dashboardRoutes = require('./modules/dashboard/dashboard.routes')
const seatingFilterRoutes = require('./modules/seatingFilter/seatingFilter.routes')
const authenticateRequest = require('./middlewares/authenticate')
const notFound = require('./middlewares/notFound')
const errorHandler = require('./middlewares/errorHandler')
const { withMobileEnvelope } = require('./utils/apiResponse')

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

app.use('/api/auth', authRoutes)
app.use('/api', authenticateRequest)
app.use('/api/halls', hallRoutes)
app.use('/api/faculty', facultyRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/courses', courseRoutes)
app.use('/api/course-registrations', courseRegistrationRoutes)
app.use('/api/allocations', allocationRoutes)
app.use('/api/exam-schedules', examScheduleRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/seating-filters', seatingFilterRoutes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
