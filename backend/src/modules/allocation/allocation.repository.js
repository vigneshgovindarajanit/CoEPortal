const db = require('../../config/db')

let initPromise

async function initSchema() {
  if (!initPromise) {
    initPromise = (async () => {
      await db.query(
        `
          CREATE TABLE IF NOT EXISTS exam_allocations (
            id INT NOT NULL AUTO_INCREMENT,
            year_filter VARCHAR(10) NOT NULL,
            primary_dept VARCHAR(20) NULL,
            secondary_dept VARCHAR(20) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
          )
        `
      )

      await db.query(
        `
          CREATE TABLE IF NOT EXISTS exam_allocation_halls (
            id INT NOT NULL AUTO_INCREMENT,
            allocation_id INT NOT NULL,
            hall_id INT NOT NULL,
            hall_code VARCHAR(30) NOT NULL,
            seat_rows INT NOT NULL,
            seat_cols INT NOT NULL,
            students_per_bench TINYINT NOT NULL,
            assigned_count INT NOT NULL DEFAULT 0,
            faculty_id INT NULL,
            faculty_name VARCHAR(150) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_allocation_halls_allocation (allocation_id),
            CONSTRAINT fk_allocation_halls_allocation
              FOREIGN KEY (allocation_id) REFERENCES exam_allocations(id)
              ON DELETE CASCADE
          )
        `
      )

      await db.query(
        `
          CREATE TABLE IF NOT EXISTS exam_allocation_rows (
            id INT NOT NULL AUTO_INCREMENT,
            hall_allocation_id INT NOT NULL,
            row_index INT NOT NULL,
            row_label VARCHAR(4) NOT NULL,
            dept_code VARCHAR(20) NULL,
            seats_per_row INT NOT NULL,
            roll_numbers_json LONGTEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_allocation_rows_hall (hall_allocation_id),
            CONSTRAINT fk_allocation_rows_hall
              FOREIGN KEY (hall_allocation_id) REFERENCES exam_allocation_halls(id)
              ON DELETE CASCADE
          )
        `
      )
    })()
  }

  await initPromise
}

function getRowLabel(index) {
  return String.fromCharCode(65 + index)
}

function mapHallRow(row) {
  return {
    id: row.id,
    hallId: row.hall_id,
    hallCode: row.hall_code,
    rows: row.seat_rows,
    cols: row.seat_cols,
    studentsPerBench: row.students_per_bench,
    assignedCount: row.assigned_count,
    facultyAssignee: row.faculty_id
      ? {
          id: row.faculty_id,
          fullName: row.faculty_name
        }
      : null
  }
}

async function listActiveHalls(examType) {
  await initSchema()
  const where = ['is_active = 1']
  const params = []
  if (examType) {
    where.push('exam_type = ?')
    params.push(examType)
  }
  const [rows] = await db.query(
    `
      SELECT id, hall_code, seat_rows, seat_cols, students_per_bench
      FROM hall
      WHERE ${where.join(' AND ')}
      ORDER BY block_name ASC, hall_number ASC
    `,
    params
  )

  return rows.map((row) => ({
    id: row.id,
    hallCode: row.hall_code,
    rows: Number(row.seat_rows || 0),
    cols: Number(row.seat_cols || 0),
    studentsPerBench: Number(row.students_per_bench || 1)
  }))
}

async function listStudentsByYear(yearFilter) {
  await initSchema()

  if (yearFilter === 'ALL') {
    const [rows] = await db.query(
      `
        SELECT id, student_id, student_name, year, dept
        FROM students
        ORDER BY dept ASC, student_id ASC
      `
    )
    return rows
  }

  const yearValues = String(yearFilter)
    .split(',')
    .map((value) => Number(value))
    .filter((value, index, arr) => Number.isInteger(value) && arr.indexOf(value) === index)

  if (yearValues.length > 1) {
    const [rows] = await db.query(
      `
        SELECT id, student_id, student_name, year, dept
        FROM students
        WHERE year IN (?)
        ORDER BY dept ASC, student_id ASC
      `,
      [yearValues]
    )
    return rows
  }

  const [rows] = await db.query(
    `
      SELECT id, student_id, student_name, year, dept
      FROM students
      WHERE year = ?
      ORDER BY dept ASC, student_id ASC
    `,
    [Number(yearFilter)]
  )
  return rows
}

async function listCourseSummaryByYear(yearFilter) {
  await initSchema()

  if (yearFilter === 'ALL') {
    const [rows] = await db.query(
      `
        SELECT department, COUNT(*) AS courses, COALESCE(SUM(course_count), 0) AS exam_count
        FROM courses
        GROUP BY department
      `
    )
    return rows
  }

  const yearValues = String(yearFilter)
    .split(',')
    .map((value) => Number(value))
    .filter((value, index, arr) => Number.isInteger(value) && arr.indexOf(value) === index)

  if (yearValues.length > 1) {
    const [rows] = await db.query(
      `
        SELECT department, COUNT(*) AS courses, COALESCE(SUM(course_count), 0) AS exam_count
        FROM courses
        WHERE course_year IN (?)
        GROUP BY department
      `,
      [yearValues]
    )
    return rows
  }

  const [rows] = await db.query(
    `
      SELECT department, COUNT(*) AS courses, COALESCE(SUM(course_count), 0) AS exam_count
      FROM courses
      WHERE course_year = ?
      GROUP BY department
    `,
    [Number(yearFilter)]
  )
  return rows
}

async function createAllocationSnapshot(payload) {
  await initSchema()
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const [allocationResult] = await connection.query(
      `
        INSERT INTO exam_allocations (year_filter, primary_dept, secondary_dept)
        VALUES (?, ?, ?)
      `,
      [payload.yearFilter, payload.primaryDept || null, payload.secondaryDept || null]
    )

    const allocationId = Number(allocationResult.insertId)

    for (const hall of payload.hallLayouts) {
      const [hallResult] = await connection.query(
        `
          INSERT INTO exam_allocation_halls (
            allocation_id,
            hall_id,
            hall_code,
            seat_rows,
            seat_cols,
            students_per_bench,
            assigned_count,
            faculty_id,
            faculty_name
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          allocationId,
          hall.hallId,
          hall.hallCode,
          hall.rows,
          hall.cols,
          hall.studentsPerBench,
          hall.assignedCount,
          hall.facultyAssignee?.id || null,
          hall.facultyAssignee?.fullName || null
        ]
      )

      const hallAllocationId = Number(hallResult.insertId)

      for (let rowIndex = 0; rowIndex < hall.layoutRows.length; rowIndex += 1) {
        const row = hall.layoutRows[rowIndex]
        await connection.query(
          `
            INSERT INTO exam_allocation_rows (
              hall_allocation_id,
              row_index,
              row_label,
              dept_code,
              seats_per_row,
              roll_numbers_json
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            hallAllocationId,
            rowIndex,
            row.rowLabel || getRowLabel(rowIndex),
            row.dept || null,
            row.seatsPerRow,
            JSON.stringify(row.rollNumbers || [])
          ]
        )
      }
    }

    await connection.commit()
    return allocationId
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}

async function findAllocationById(allocationId) {
  await initSchema()

  const [allocationRows] = await db.query(
    `
      SELECT id, year_filter, primary_dept, secondary_dept, created_at
      FROM exam_allocations
      WHERE id = ?
      LIMIT 1
    `,
    [Number(allocationId)]
  )

  const allocation = allocationRows[0]
  if (!allocation) {
    return null
  }

  const [hallRows] = await db.query(
    `
      SELECT
        id,
        hall_id,
        hall_code,
        seat_rows,
        seat_cols,
        students_per_bench,
        assigned_count,
        faculty_id,
        faculty_name
      FROM exam_allocation_halls
      WHERE allocation_id = ?
      ORDER BY id ASC
    `,
    [Number(allocationId)]
  )

  const hallIds = hallRows.map((row) => Number(row.id))
  let rowRows = []
  if (hallIds.length > 0) {
    const [rows] = await db.query(
      `
        SELECT
          id,
          hall_allocation_id,
          row_index,
          row_label,
          dept_code,
          seats_per_row,
          roll_numbers_json
        FROM exam_allocation_rows
        WHERE hall_allocation_id IN (?)
        ORDER BY hall_allocation_id ASC, row_index ASC
      `,
      [hallIds]
    )
    rowRows = rows
  }

  const rowsByHall = new Map()
  for (const row of rowRows) {
    const key = Number(row.hall_allocation_id)
    if (!rowsByHall.has(key)) {
      rowsByHall.set(key, [])
    }
    let rollNumbers = []
    try {
      rollNumbers = JSON.parse(row.roll_numbers_json || '[]')
    } catch {
      rollNumbers = []
    }
    rowsByHall.get(key).push({
      rowLabel: row.row_label,
      dept: row.dept_code || '-',
      seatsPerRow: Number(row.seats_per_row || 0),
      rollNumbers
    })
  }

  return {
    allocationId: Number(allocation.id),
    yearFilter: allocation.year_filter,
    primaryDept: allocation.primary_dept || '',
    secondaryDept: allocation.secondary_dept || '',
    createdAt: allocation.created_at,
    hallLayouts: hallRows.map((hallRow) => {
      const mapped = mapHallRow(hallRow)
      return {
        hallAllocationId: Number(hallRow.id),
        hall: {
          id: mapped.hallId,
          hallCode: mapped.hallCode,
          rows: mapped.rows,
          cols: mapped.cols,
          studentsPerBench: mapped.studentsPerBench
        },
        rows: rowsByHall.get(Number(hallRow.id)) || [],
        assignedCount: mapped.assignedCount,
        facultyAssignee: mapped.facultyAssignee
      }
    })
  }
}

async function findLatestAllocation() {
  await initSchema()
  const [rows] = await db.query(
    `
      SELECT id
      FROM exam_allocations
      ORDER BY id DESC
      LIMIT 1
    `
  )

  const allocationId = Number(rows[0]?.id || 0)
  if (!allocationId) {
    return null
  }

  return findAllocationById(allocationId)
}

async function updateHallFacultyById(connection, hallAllocationId, faculty) {
  await connection.query(
    `
      UPDATE exam_allocation_halls
      SET faculty_id = ?, faculty_name = ?
      WHERE id = ?
    `,
    [faculty.id, faculty.fullName, Number(hallAllocationId)]
  )
}

module.exports = {
  listActiveHalls,
  listStudentsByYear,
  listCourseSummaryByYear,
  createAllocationSnapshot,
  findAllocationById,
  findLatestAllocation,
  updateHallFacultyById,
  initSchema
}
