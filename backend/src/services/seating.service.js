const studentRepository = require('../modules/student/student.repository')
const hallRepository = require('../modules/hall/hall.repository')

async function getHalls(examType, isActive = true) {
  if (examType) {
    return hallRepository.findByTypeAndStatus(examType, isActive)
  }
  return hallRepository.findAllByStatus(isActive)
}

async function generateSeatingLayout(dept1, dept2, seatsPerRow = 10) {
  const students1 = await studentRepository.findAllByDept(dept1)
  const students2 = await studentRepository.findAllByDept(dept2)

  const layout = []
  let rowNumber = 1
  let idx1 = 0
  let idx2 = 0

  // Continue generating rows until both departments are fully seated
  while (idx1 < students1.length || idx2 < students2.length) {
    const isOdd = rowNumber % 2 !== 0
    const rowData = {
      rowNumber,
      dept: isOdd ? dept1 : dept2,
      students: []
    }

    if (isOdd) {
      // Odd Rows (1, 3, 5...) get Dept 1
      if (idx1 < students1.length) {
        rowData.students = students1.slice(idx1, idx1 + seatsPerRow)
        idx1 += seatsPerRow
      }
    } else {
      // Even Rows (2, 4, 6...) get Dept 2
      if (idx2 < students2.length) {
        rowData.students = students2.slice(idx2, idx2 + seatsPerRow)
        idx2 += seatsPerRow
      }
    }

    layout.push(rowData)
    rowNumber++
  }

  return layout
}

module.exports = {
  getHalls,
  generateSeatingLayout
}
