const courseService = require('./course.service')

async function listCourses(req, res, next) {
  try {
    const data = await courseService.getCourses({
      semester: req.query.semester,
      department: req.query.department,
      courseType: req.query.courseType,
      search: req.query.search
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function listCourseFilters(req, res, next) {
  try {
    const data = await courseService.getCourseFilters()
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function createCourse(req, res, next) {
  try {
    const data = await courseService.createCourse(req.body)
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function updateCourse(req, res, next) {
  try {
    const data = await courseService.updateCourse(req.params.id, req.body)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listCourses,
  listCourseFilters,
  createCourse,
  updateCourse
}
