const courseRepository = require('./course.repository')
const { COURSE_TYPES, ELECTIVE_TYPES, validateCourseInput } = require('./course.model')

async function getCourses(filters = {}) {
  return courseRepository.getAll(filters)
}

async function getCourseFilters() {
  const repositoryFilters = await courseRepository.getFilters()
  return {
    semesters: repositoryFilters.semesters || [],
    departments: repositoryFilters.departments || [],
    courseTypes: COURSE_TYPES,
    electiveTypes: ELECTIVE_TYPES
  }
}

async function createCourse(payload = {}) {
  const course = validateCourseInput(payload)

  const duplicate = await courseRepository.findByCourseCode(course.semester, course.courseCode)
  if (duplicate) {
    const err = new Error(`Course code ${course.courseCode} already exists for ${course.semester}`)
    err.status = 409
    throw err
  }

  return courseRepository.create(course)
}

async function updateCourse(id, payload = {}) {
  const existing = await courseRepository.findById(id)
  if (!existing) {
    const err = new Error('Course not found')
    err.status = 404
    throw err
  }

  const merged = validateCourseInput({
    semester: payload.semester ?? existing.semester,
    courseCode: payload.courseCode ?? existing.courseCode,
    courseName: payload.courseName ?? existing.courseName,
    courseYear: payload.courseYear ?? existing.courseYear,
    department: payload.department ?? existing.department,
    courseType: payload.courseType ?? existing.courseType,
    electiveType: payload.electiveType ?? existing.electiveType,
    courseCount: payload.courseCount ?? existing.courseCount
  })

  const duplicate = await courseRepository.findByCourseCode(merged.semester, merged.courseCode, id)
  if (duplicate) {
    const err = new Error(`Course code ${merged.courseCode} already exists for ${merged.semester}`)
    err.status = 409
    throw err
  }

  const updated = await courseRepository.updateById(id, merged)
  if (!updated) {
    const err = new Error('Course not found')
    err.status = 404
    throw err
  }

  return updated
}

module.exports = {
  getCourses,
  getCourseFilters,
  createCourse,
  updateCourse
}
