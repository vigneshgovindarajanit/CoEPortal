const db = require('../../config/db')
const allocationRepository = require('./allocation.repository')
const { validateAllocationId, validateGeneratePayload } = require('./allocation.model')

function getStudentsPerBenchByExamType(examType) {
  return examType === 'PERIODIC_TEST' ? 2 : 1
}

function getRowLabel(index) {
  return String.fromCharCode(65 + index)
}

function cloneQueueMap(source) {
  const next = new Map()
  for (const [key, value] of source.entries()) {
    next.set(key, [...value])
  }
  return next
}

function remainingInDept(queues, dept) {
  if (!dept) {
    return 0
  }
  return (queues.get(dept) || []).length
}

function pickFallbackDept(queues, deptOrder) {
  for (const dept of deptOrder) {
    if (remainingInDept(queues, dept) > 0) {
      return dept
    }
  }
  return ''
}

function countAvailableDepartments(queues, deptOrder) {
  let count = 0
  for (const dept of deptOrder) {
    if (remainingInDept(queues, dept) > 0) {
      count += 1
    }
  }
  return count
}

function pickNextDeptRoundRobin(queues, deptOrder, cursorState) {
  if (deptOrder.length === 0) {
    return ''
  }

  const availableDeptCount = countAvailableDepartments(queues, deptOrder)
  if (availableDeptCount === 0) {
    return ''
  }

  for (let attempt = 0; attempt < deptOrder.length; attempt += 1) {
    const index = (cursorState.index + attempt) % deptOrder.length
    const dept = deptOrder[index]
    if (remainingInDept(queues, dept) > 0) {
      cursorState.index = (index + 1) % deptOrder.length
      return dept
    }
  }

  return pickFallbackDept(queues, deptOrder)
}

function pickNextDeptRoundRobinExcluding(queues, deptOrder, cursorState, excludedDept) {
  if (deptOrder.length === 0) {
    return ''
  }

  const availableDeptCount = countAvailableDepartments(queues, deptOrder)
  if (availableDeptCount === 0) {
    return ''
  }

  for (let attempt = 0; attempt < deptOrder.length; attempt += 1) {
    const index = (cursorState.index + attempt) % deptOrder.length
    const dept = deptOrder[index]
    if (dept === excludedDept) {
      continue
    }
    if (remainingInDept(queues, dept) > 0) {
      cursorState.index = (index + 1) % deptOrder.length
      return dept
    }
  }

  return ''
}

function normalizeStudents(rows) {
  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    year: Number(row.year),
    dept: row.dept || 'NA'
  }))
}

function buildDeptOrder(grouped, primaryDept, secondaryDept) {
  const deptOrder = []
  if (primaryDept) {
    deptOrder.push(primaryDept)
  }
  if (secondaryDept && secondaryDept !== primaryDept) {
    deptOrder.push(secondaryDept)
  }
  for (const dept of [...grouped.keys()].sort((a, b) => a.localeCompare(b))) {
    if (!deptOrder.includes(dept)) {
      deptOrder.push(dept)
    }
  }
  return deptOrder
}

function buildAnalysis({ students, courseSummary, hallLayouts }) {
  const studentDeptCounts = new Map()
  for (const student of students) {
    studentDeptCounts.set(student.dept, (studentDeptCounts.get(student.dept) || 0) + 1)
  }

  const courseDeptCounts = new Map()
  for (const row of courseSummary) {
    const dept = row.department || 'NA'
    courseDeptCounts.set(dept, {
      courses: Number(row.courses || 0),
      examCount: Number(row.exam_count || 0)
    })
  }

  const allocatedDeptCounts = new Map()
  for (const hall of hallLayouts) {
    for (const row of hall.rows) {
      if (row.rollNumbers.length > 0) {
        allocatedDeptCounts.set(row.dept, (allocatedDeptCounts.get(row.dept) || 0) + row.rollNumbers.length)
      }
    }
  }

  const allDepts = [...new Set([...studentDeptCounts.keys(), ...courseDeptCounts.keys()])].sort((a, b) =>
    a.localeCompare(b)
  )

  return allDepts.map((dept) => ({
    dept,
    students: studentDeptCounts.get(dept) || 0,
    allocated: allocatedDeptCounts.get(dept) || 0,
    courses: courseDeptCounts.get(dept)?.courses || 0,
    examCount: courseDeptCounts.get(dept)?.examCount || 0
  }))
}

function extractYearValues(yearFilter) {
  if (!yearFilter || yearFilter === 'ALL') {
    return []
  }

  return String(yearFilter)
    .split(',')
    .map((value) => Number(value))
    .filter((value, index, arr) => Number.isInteger(value) && arr.indexOf(value) === index)
    .sort((a, b) => a - b)
}

async function generateAllocation(payload) {
  const input = validateGeneratePayload(payload)
  const studentsPerBenchByExamType = getStudentsPerBenchByExamType(input.examType)
  const [halls, studentRows, courseSummary] = await Promise.all([
    allocationRepository.listActiveHalls(input.examType),
    allocationRepository.listStudentsByYear(input.yearFilter),
    allocationRepository.listCourseSummaryByYear(input.yearFilter)
  ])

  console.log('[DEBUG] listActiveHalls examType=', input.examType, '-> returned:', halls)

  if (halls.length === 0) {
    const err = new Error('No active halls available')
    err.status = 409
    throw err
  }

  const students = normalizeStudents(studentRows)
  if (students.length === 0) {
    const err = new Error('No students found for selected year filter')
    err.status = 409
    throw err
  }

  const grouped = new Map()
  for (const student of students) {
    if (!grouped.has(student.dept)) {
      grouped.set(student.dept, [])
    }
    grouped.get(student.dept).push(student)
  }

  const queues = cloneQueueMap(grouped)
  
  const sortedDepts = [...grouped.keys()].sort((a, b) => {
    const diff = grouped.get(b).length - grouped.get(a).length
    if (diff !== 0) return diff
    return a.localeCompare(b)
  })

  const streamA = []
  const streamB = []
  
  if (input.primaryDept && grouped.has(input.primaryDept)) {
    streamA.push(input.primaryDept)
  }
  if (input.secondaryDept && grouped.has(input.secondaryDept)) {
    streamB.push(input.secondaryDept)
  }

  const explicitA = ['CS', 'IT', 'AE', 'CG', 'EE', 'CE', 'SE']
  const explicitB = ['EC', 'AD', 'BT', 'TT', 'FT', 'ME', 'CH']

  for (const d of explicitA) {
    if (grouped.has(d) && !streamA.includes(d) && !streamB.includes(d)) streamA.push(d)
  }
  for (const d of explicitB) {
    if (grouped.has(d) && !streamA.includes(d) && !streamB.includes(d)) streamB.push(d)
  }

  let weightA = streamA.reduce((sum, d) => sum + grouped.get(d).length, 0)
  let weightB = streamB.reduce((sum, d) => sum + grouped.get(d).length, 0)

  for (const d of sortedDepts) {
    if (streamA.includes(d) || streamB.includes(d)) continue
    if (weightA <= weightB) {
      streamA.push(d)
      weightA += grouped.get(d).length
    } else {
      streamB.push(d)
      weightB += grouped.get(d).length
    }
  }

  const hallLayouts = []
  
  let globalIndexA = 0
  let globalIndexB = 0

  function getNextDeptA() {
    while (globalIndexA < streamA.length) {
      const d = streamA[globalIndexA]
      globalIndexA += 1
      if (remainingInDept(queues, d) > 0) return d
    }
    return ''
  }

  function getNextDeptB() {
    while (globalIndexB < streamB.length) {
      const d = streamB[globalIndexB]
      globalIndexB += 1
      if (remainingInDept(queues, d) > 0) return d
    }
    return ''
  }

  function getNextForParity(isEvenIndex) {
    if (isEvenIndex) {
      return getNextDeptA() || getNextDeptB()
    } else {
      return getNextDeptB() || getNextDeptA()
    }
  }

  let activePrimaryDept = getNextForParity(true)
  let activeSecondaryDept = getNextForParity(false)

  for (const hall of halls) {
    const rows = Math.max(Number(hall.rows || 0), 0)
    const cols = Math.max(Number(hall.cols || 0), 0)
    const seatsPerRow = studentsPerBenchByExamType === 2 ? cols * 2 : cols
    const layoutRows = []
    let assignedCount = 0

    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const rollNumbers = []
      const rowDepts = new Set()

      let rowDept = rowIndex % 2 === 0 ? activePrimaryDept : activeSecondaryDept

      // If the assigned department for this parity ran out, try picking a new one
      if (rowDept && remainingInDept(queues, rowDept) === 0) {
        const nextDept = getNextForParity(rowIndex % 2 === 0)

        if (rowIndex % 2 === 0) {
          activePrimaryDept = nextDept
          rowDept = activePrimaryDept
        } else {
          activeSecondaryDept = nextDept
          rowDept = activeSecondaryDept
        }
      }

      // If we still don't have a department (everything drained except maybe the other active parity)
      if (!rowDept) {
        rowDept = rowIndex % 2 === 0 ? activeSecondaryDept : activePrimaryDept
        if (rowDept && remainingInDept(queues, rowDept) === 0) {
          rowDept = ''
        }
      }

      let queue = queues.get(rowDept) || []

      for (let seatIndex = 0; seatIndex < seatsPerRow; seatIndex += 1) {
        let student = queue.shift()
        
        // If it runs out mid-row, fallback to a new one
        if (!student) {
          const nextDept = getNextForParity(rowIndex % 2 === 0)
          
          if (nextDept) {
            if (rowIndex % 2 === 0) {
              activePrimaryDept = nextDept
              rowDept = activePrimaryDept
            } else {
              activeSecondaryDept = nextDept
              rowDept = activeSecondaryDept
            }
          } else {
            // No next dept, try the other active one
            rowDept = rowIndex % 2 === 0 ? activeSecondaryDept : activePrimaryDept
          }
          
          queue = queues.get(rowDept) || []
          student = queue.shift()
          
          if (student && rowDept) {
            rowDepts.add(rowDept)
          }
        }

        if (!student) {
          break
        }

        rollNumbers.push(student.studentId)
        if (rowDept && !rowDepts.has(rowDept)) {
          rowDepts.add(rowDept)
        }
        assignedCount += 1
      }

      const rowDeptLabel = rowDepts.size === 0 ? '-' : rowDepts.size === 1 ? [...rowDepts][0] : 'MIXED'

      layoutRows.push({
        rowLabel: getRowLabel(rowIndex),
        dept: rowDeptLabel,
        seatsPerRow,
        rollNumbers
      })
    }

    if (assignedCount > 0) {
      hallLayouts.push({
        hallId: hall.id,
        hallCode: hall.hallCode,
        rows: hall.rows,
        cols: hall.cols,
        studentsPerBench: studentsPerBenchByExamType,
        assignedCount,
        facultyAssignee: null,
        layoutRows
      })
    }
  }

  const unallocated = []
  for (const queue of queues.values()) {
    unallocated.push(...queue.map((student) => student.studentId))
  }

  const allocationId = await allocationRepository.createAllocationSnapshot({
    yearFilter: input.yearFilter,
    primaryDept: input.primaryDept,
    secondaryDept: input.secondaryDept,
    hallLayouts
  })

  return {
    allocationId,
    examType: input.examType,
    yearFilter: input.yearFilter,
    yearValues: input.yearValues || extractYearValues(input.yearFilter),
    primaryDept: input.primaryDept,
    secondaryDept: input.secondaryDept,
    hallLayouts: hallLayouts.map((hall) => ({
      hallAllocationId: null,
      hall: {
        id: hall.hallId,
        hallCode: hall.hallCode,
        rows: hall.rows,
        cols: hall.cols,
        studentsPerBench: hall.studentsPerBench
      },
      rows: hall.layoutRows,
      assignedCount: hall.assignedCount,
      facultyAssignee: hall.facultyAssignee
    })),
    unallocated,
    analysis: buildAnalysis({
      students,
      courseSummary,
      hallLayouts: hallLayouts.map((hall) => ({ rows: hall.layoutRows }))
    })
  }
}

async function getLatestAllocation() {
  const allocation = await allocationRepository.findLatestAllocation()
  if (!allocation) {
    return null
  }

  const courseSummary = await allocationRepository.listCourseSummaryByYear(allocation.yearFilter)
  const students = normalizeStudents(await allocationRepository.listStudentsByYear(allocation.yearFilter))

  const unallocated = []
  const allocatedSet = new Set()
  for (const hall of allocation.hallLayouts) {
    for (const row of hall.rows) {
      for (const rollNo of row.rollNumbers) {
        allocatedSet.add(rollNo)
      }
    }
  }

  for (const student of students) {
    if (!allocatedSet.has(student.studentId)) {
      unallocated.push(student.studentId)
    }
  }

  return {
    ...allocation,
    yearValues: extractYearValues(allocation.yearFilter),
    analysis: buildAnalysis({ students, courseSummary, hallLayouts: allocation.hallLayouts }),
    unallocated
  }
}

async function pickFacultyForHall(connection, preferredDept) {
  const baseWhere = [
    "LOWER(role) NOT LIKE '%principal%'",
    "LOWER(role) NOT LIKE '%adjunct faculty%'",
    "LOWER(role) NOT LIKE '%hindi teacher%'",
    'assigned_workload < max_workload'
  ]

  const withDeptWhere = [...baseWhere]
  const withDeptParams = []
  if (preferredDept && preferredDept !== '-') {
    withDeptWhere.push('dept = ?')
    withDeptParams.push(preferredDept)
  }

  const [withDeptRows] = await connection.query(
    `
      SELECT faculty_id, name, dept
      FROM faculty
      WHERE ${withDeptWhere.join(' AND ')}
      ORDER BY max_workload DESC, assigned_workload ASC, name ASC
      LIMIT 1
      FOR UPDATE
    `,
    withDeptParams
  )

  const chosenWithDept = withDeptRows[0]
  if (chosenWithDept) {
    return {
      id: Number(chosenWithDept.faculty_id),
      fullName: chosenWithDept.name,
      dept: chosenWithDept.dept
    }
  }

  const [rows] = await connection.query(
    `
      SELECT faculty_id, name, dept
      FROM faculty
      WHERE ${baseWhere.join(' AND ')}
      ORDER BY max_workload DESC, assigned_workload ASC, name ASC
      LIMIT 1
      FOR UPDATE
    `
  )

  const chosen = rows[0]
  if (!chosen) {
    const err = new Error('No eligible faculty found for assignment')
    err.status = 409
    throw err
  }

  return {
    id: Number(chosen.faculty_id),
    fullName: chosen.name,
    dept: chosen.dept
  }
}

async function assignFacultyToAllocation(allocationIdValue) {
  const allocationId = validateAllocationId(allocationIdValue)
  const allocation = await allocationRepository.findAllocationById(allocationId)
  if (!allocation) {
    const err = new Error('Allocation not found')
    err.status = 404
    throw err
  }

  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()

    for (const hall of allocation.hallLayouts) {
      if (!hall.assignedCount || hall.assignedCount <= 0) {
        continue
      }

      const rowWithData = hall.rows.find((row) => row.rollNumbers.length > 0)
      const preferredDept = rowWithData?.dept || ''
      const faculty = await pickFacultyForHall(connection, preferredDept)

      await connection.query(
        `
          UPDATE faculty
          SET assigned_workload = assigned_workload + 1
          WHERE faculty_id = ?
        `,
        [faculty.id]
      )

      await allocationRepository.updateHallFacultyById(connection, hall.hallAllocationId, faculty)
    }

    await connection.commit()
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }

  return getLatestAllocation()
}

module.exports = {
  generateAllocation,
  getLatestAllocation,
  assignFacultyToAllocation
}
