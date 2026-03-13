const studentRepository = require('./student.repository')
const {
  DEGREE_CONFIG,
  validateStudentInput,
  validateBulkGenerationInput,
  buildRollNumber
} = require('./student.model')

async function getStudents(filters = {}) {
  return studentRepository.getAll(filters)
}

async function getStudentSummary() {
  return studentRepository.getSummary()
}

async function createStudent(payload) {
  const student = validateStudentInput(payload)

  const duplicateId = await studentRepository.findByStudentId(student.studentId)
  if (duplicateId) {
    const err = new Error(`Student ID ${student.studentId} already exists`)
    err.status = 409
    throw err
  }

  const duplicateEmail = await studentRepository.findByEmail(student.studentEmail)
  if (duplicateEmail) {
    const err = new Error(`Student email ${student.studentEmail} already exists`)
    err.status = 409
    throw err
  }

  return studentRepository.create(student)
}

async function updateStudent(id, payload) {
  const existing = await studentRepository.findById(id)
  if (!existing) {
    const err = new Error('Student not found')
    err.status = 404
    throw err
  }

  const merged = validateStudentInput(
    {
      studentId: payload.studentId ?? existing.studentId,
      studentName: payload.studentName ?? existing.studentName,
      studentEmail: payload.studentEmail ?? existing.studentEmail,
      year: payload.year ?? existing.year,
      dept: payload.dept ?? existing.dept
    },
    { partial: false }
  )

  const duplicateId = await studentRepository.findByStudentId(merged.studentId, id)
  if (duplicateId) {
    const err = new Error(`Student ID ${merged.studentId} already exists`)
    err.status = 409
    throw err
  }

  const duplicateEmail = await studentRepository.findByEmail(merged.studentEmail, id)
  if (duplicateEmail) {
    const err = new Error(`Student email ${merged.studentEmail} already exists`)
    err.status = 409
    throw err
  }

  return studentRepository.updateById(id, merged)
}

async function generateBulkStudents(payload = {}) {
  const config = validateBulkGenerationInput(payload)
  const students = []

  for (const yearLevel of config.yearLevels) {
    const rawBatchYear = config.firstYearBatchYear - (yearLevel - 1)
    const batchYear = ((rawBatchYear % 100) + 100) % 100

    for (const degree of config.degrees) {
      const degreeConfig = DEGREE_CONFIG[degree]
      const deptEntries = Object.entries(degreeConfig.departments).filter(([dept]) => {
        return config.departments.length === 0 || config.departments.includes(dept)
      })

      for (const [dept, strength] of deptEntries) {
        const endSerial = 100 + Number(strength)
        for (let serialNo = config.startSerial; serialNo <= endSerial; serialNo += 1) {
          const studentId = buildRollNumber({
            collegeCode: config.collegeCode,
            batchYear,
            degreeCode: degreeConfig.code,
            dept,
            serialNo
          })

          students.push({
            studentId,
            studentName: `${dept} Year ${yearLevel} Student ${serialNo}`,
            studentEmail: `${studentId.toLowerCase()}@bitsathy.ac.in`,
            year: yearLevel,
            dept
          })
        }
      }
    }
  }

  const result = await studentRepository.bulkCreate(students)
  return {
    collegeCode: config.collegeCode,
    firstYearBatchYear: config.firstYearBatchYear,
    yearLevels: config.yearLevels,
    degrees: config.degrees,
    departments: config.departments,
    attempted: result.attempted,
    inserted: result.inserted,
    skipped: result.attempted - result.inserted
  }
}

async function removeStudent(id) {
  const deleted = await studentRepository.deleteById(id)
  if (!deleted) {
    const err = new Error('Student not found')
    err.status = 404
    throw err
  }
}

module.exports = {
  getStudents,
  getStudentSummary,
  createStudent,
  updateStudent,
  generateBulkStudents,
  removeStudent
}
