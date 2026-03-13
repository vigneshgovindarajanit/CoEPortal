const studentService = require('./student.service')

async function listStudents(req, res, next) {
  try {
    const students = await studentService.getStudents({
      search: req.query.search,
      year: req.query.year,
      dept: req.query.dept,
      page: req.query.page,
      pageSize: req.query.pageSize
    })
    res.json(students)
  } catch (err) {
    next(err)
  }
}

async function getStudentSummary(req, res, next) {
  try {
    const summary = await studentService.getStudentSummary()
    res.json(summary)
  } catch (err) {
    next(err)
  }
}

async function createStudent(req, res, next) {
  try {
    const student = await studentService.createStudent(req.body)
    res.status(201).json(student)
  } catch (err) {
    next(err)
  }
}

async function updateStudent(req, res, next) {
  try {
    const student = await studentService.updateStudent(req.params.id, req.body)
    res.json(student)
  } catch (err) {
    next(err)
  }
}

async function generateBulkStudents(req, res, next) {
  try {
    const summary = await studentService.generateBulkStudents(req.body)
    res.status(201).json(summary)
  } catch (err) {
    next(err)
  }
}

async function deleteStudent(req, res, next) {
  try {
    await studentService.removeStudent(req.params.id)
    res.status(200).json({ deleted: true })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listStudents,
  getStudentSummary,
  createStudent,
  updateStudent,
  generateBulkStudents,
  deleteStudent
}
