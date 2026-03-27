const db = require('../../config/db')
const { calculateCapacity, calculateSupervisors } = require('../hall/hall.model')

function normalizeIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim()) ? String(value || '').trim() : ''
}

async function hasExamScheduleTable(executor = db) {
  const [rows] = await executor.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_schedules'
    `
  )

  return Number(rows[0]?.total || 0) > 0
}

async function ensureExamScheduleAssignmentColumns(executor = db) {
  if (!(await hasExamScheduleTable(executor))) {
    return false
  }

  const [facultyIdColumnRows] = await executor.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_schedules'
        AND COLUMN_NAME = 'supervisor_faculty_id'
    `
  )

  if (!Number(facultyIdColumnRows[0]?.total || 0)) {
    await executor.query(
      'ALTER TABLE exam_schedules ADD COLUMN supervisor_faculty_id INT NULL AFTER hall_code'
    )
  }

  const [supervisorNameColumnRows] = await executor.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'exam_schedules'
        AND COLUMN_NAME = 'supervisor_name'
    `
  )

  if (!Number(supervisorNameColumnRows[0]?.total || 0)) {
    await executor.query(
      'ALTER TABLE exam_schedules ADD COLUMN supervisor_name VARCHAR(255) NULL AFTER supervisor_faculty_id'
    )
  }

  return true
}

function getRequiredSupervisorsForHall(hallRow = {}) {
  const examType = String(hallRow.exam_type || hallRow.examType || 'SEMESTER')
    .trim()
    .toUpperCase()

  const block = String(hallRow.block_name || hallRow.block || hallRow.hall_code || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)

  const seatRows = Number(hallRow.seat_rows || hallRow.rows || 0)
  const seatCols = Number(hallRow.seat_cols || hallRow.cols || 0)
  const studentsPerBench = Number(hallRow.students_per_bench || hallRow.studentsPerBench || 1)

  const capacity = calculateCapacity(seatRows, seatCols, studentsPerBench, examType)
  return calculateSupervisors(capacity, studentsPerBench, examType, block)
}

function mapFacultyRow(row) {
  if (!row) {
    return null
  }

  return {
    id: row.faculty_id,
    fullName: row.name,
    department: row.dept,
    role: row.role,
    maxWorkload: row.max_workload,
    currentWorkload: row.assigned_workload,
    remainingWorkload: row.max_workload - row.assigned_workload,
    workloadText: `${row.assigned_workload}/${row.max_workload}`,
    isActive: true
  }
}

async function listFaculty(filters = {}) {
  const search = String(filters.search || '').trim()
  const department = String(filters.department || '').trim()

  const where = ["LOWER(role) NOT LIKE '%principal%'"]
  const params = []

  if (search) {
    where.push('(name LIKE ? OR dept LIKE ? OR role LIKE ?)')
    const like = `%${search}%`
    params.push(like, like, like)
  }

  if (department) {
    where.push('dept = ?')
    params.push(department)
  }

  const [rows] = await db.query(
    `
      SELECT faculty_id, name, role, dept, max_workload, assigned_workload
      FROM faculty
      WHERE ${where.join(' AND ')}
      ORDER BY
        dept ASC,
        CASE
          WHEN role = 'Head' THEN 1
          WHEN role = 'Professor' THEN 2
          WHEN role = 'Associate Professor' THEN 3
          WHEN role = 'Assistant Professor Level III' THEN 4
          WHEN role = 'Assistant Professor Level II' THEN 5
          WHEN role = 'Assistant Professor' THEN 6
          ELSE 99
        END ASC,
        name ASC
    `,
    params
  )

  return rows.map(mapFacultyRow)
}

async function listDepartments() {
  const [rows] = await db.query(
    `
      SELECT DISTINCT dept
      FROM faculty
      WHERE LOWER(role) NOT LIKE '%principal%'
      ORDER BY dept ASC
    `
  )
  return rows.map((row) => row.dept)
}

async function findById(id) {
  const [rows] = await db.query(
    `
      SELECT faculty_id, name, role, dept, max_workload, assigned_workload
      FROM faculty
      WHERE faculty_id = ?
      LIMIT 1
    `,
    [Number(id)]
  )
  return mapFacultyRow(rows[0])
}

async function getNextFacultyId() {
  const [rows] = await db.query('SELECT COALESCE(MAX(faculty_id), 0) + 1 AS next_id FROM faculty')
  return Number(rows[0]?.next_id || 1)
}

async function createFaculty(payload) {
  const nextId = await getNextFacultyId()
  await db.query(
    `
      INSERT INTO faculty (
        faculty_id,
        name,
        role,
        dept,
        max_workload,
        assigned_workload
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      nextId,
      payload.fullName,
      payload.role,
      payload.department,
      payload.maxWorkload,
      payload.currentWorkload || 0
    ]
  )

  return findById(nextId)
}

async function updateFacultyById(id, payload) {
  const facultyId = Number(id)
  const manualHallCode = String(payload.manualHallCode || '').trim().toUpperCase()
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const [currentRows] = await connection.query(
      `
        SELECT faculty_id, name, role, dept, max_workload, assigned_workload
        FROM faculty
        WHERE faculty_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [facultyId]
    )

    const currentRow = currentRows[0]
    if (!currentRow) {
      await connection.rollback()
      return null
    }

    let nextAssignedWorkload = Number(payload.currentWorkload)

    const [result] = await connection.query(
      `
        UPDATE faculty
        SET
          name = ?,
          role = ?,
          dept = ?,
          max_workload = ?,
          assigned_workload = ?
        WHERE faculty_id = ?
      `,
      [
        payload.fullName,
        payload.role,
        payload.department,
        payload.maxWorkload,
        nextAssignedWorkload,
        facultyId
      ]
    )

    if (result.affectedRows === 0) {
      await connection.rollback()
      return null
    }

    if (await hasAllocationTables()) {
      await connection.query(
        `
          UPDATE exam_allocation_halls
          SET faculty_name = ?
          WHERE faculty_id = ?
        `,
        [payload.fullName, facultyId]
      )
      await connection.query(
        `
          UPDATE exam_allocation_halls
          SET faculty_name_two = ?
          WHERE faculty_id_two = ?
        `,
        [payload.fullName, facultyId]
      )
    }

    if (await ensureExamScheduleAssignmentColumns(connection)) {
      await connection.query(
        `
          UPDATE exam_schedules
          SET supervisor_name = ?
          WHERE supervisor_faculty_id = ?
        `,
        [payload.fullName, facultyId]
      )
      await connection.query(
        `
          UPDATE exam_schedules
          SET supervisor_name_two = ?
          WHERE supervisor_faculty_id_two = ?
        `,
        [payload.fullName, facultyId]
      )
    }

    if (manualHallCode) {
      if (!(await hasAllocationTables())) {
        const err = new Error('No seating allocation found. Generate seating first.')
        err.status = 409
        throw err
      }

      const [allocationRows] = await connection.query(
        `
          SELECT id
          FROM exam_allocations
          ORDER BY id DESC
          LIMIT 1
          FOR UPDATE
        `
      )

      const allocationId = Number(allocationRows[0]?.id || 0)
      if (!allocationId) {
        const err = new Error('No seating allocation found. Generate seating first.')
        err.status = 409
        throw err
      }

    const [hallRows] = await connection.query(
      `
        SELECT 
          eah.id,
          eah.hall_code,
          eah.faculty_id,
          eah.faculty_id_two,
          eah.seat_rows,
          eah.seat_cols,
          eah.students_per_bench,
          h.block_name,
          h.exam_type
        FROM exam_allocation_halls eah
        LEFT JOIN hall h ON h.id = eah.hall_id
        WHERE eah.allocation_id = ?
          AND eah.hall_code = ?
        LIMIT 1
        FOR UPDATE
      `,
      [allocationId, manualHallCode]
    )

      const hallRow = hallRows[0]
      if (!hallRow) {
        const err = new Error(`Hall ${manualHallCode} is not available in the latest seating allocation`)
        err.status = 404
        throw err
      }

      const currentHallFacultyId = hallRow.faculty_id ? Number(hallRow.faculty_id) : null
      const currentHallFacultyIdTwo = hallRow.faculty_id_two ? Number(hallRow.faculty_id_two) : null
      const requiredSupervisors = getRequiredSupervisorsForHall({
        ...hallRow,
        hall_code: hallRow.hall_code || manualHallCode
      })

      if (
        currentHallFacultyId &&
        currentHallFacultyId !== facultyId &&
        (requiredSupervisors === 1 || (currentHallFacultyIdTwo && currentHallFacultyIdTwo !== facultyId))
      ) {
        const err = new Error(`Hall ${manualHallCode} is already fully assigned to other faculties`)
        err.status = 409
        throw err
      }

      if (currentHallFacultyId !== facultyId && currentHallFacultyIdTwo !== facultyId) {
        if (nextAssignedWorkload >= Number(payload.maxWorkload)) {
          const err = new Error('Faculty workload limit reached. Cannot assign another hall.')
          err.status = 409
          throw err
        }

        nextAssignedWorkload += 1

        await connection.query(
          `
            UPDATE faculty
            SET assigned_workload = ?
            WHERE faculty_id = ?
          `,
          [nextAssignedWorkload, facultyId]
        )

        if (!currentHallFacultyId) {
          await connection.query(
            `
              UPDATE exam_allocation_halls
              SET faculty_id = ?, faculty_name = ?
              WHERE id = ?
            `,
            [facultyId, payload.fullName, Number(hallRow.id)]
          )
        } else {
          await connection.query(
            `
              UPDATE exam_allocation_halls
              SET faculty_id_two = ?, faculty_name_two = ?
              WHERE id = ?
            `,
            [facultyId, payload.fullName, Number(hallRow.id)]
          )
        }
      }
    }

    await connection.commit()
    return findById(id)
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}

async function autoAssignSupervisor(payload = {}) {
  const department = String(payload.department || '').trim()
  const search = String(payload.search || '').trim()
  const hallCode = String(payload.hallCode || '').trim().toUpperCase()
  const examDate = normalizeIsoDate(payload.examDate)
  const sessionName = String(payload.sessionName || '').trim().toUpperCase()

  if (!hallCode) {
    const err = new Error('Hall code is required')
    err.status = 400
    throw err
  }

  if (!examDate) {
    const err = new Error('Exam date must be in YYYY-MM-DD format')
    err.status = 400
    throw err
  }

  if (!['FN', 'AN'].includes(sessionName)) {
    const err = new Error('Session must be one of: FN, AN')
    err.status = 400
    throw err
  }

  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const hasExamSchedules = await ensureExamScheduleAssignmentColumns(connection)
    if (!hasExamSchedules) {
      const err = new Error('No exam schedule found. Create an exam schedule first.')
      err.status = 409
      throw err
    }

    const [scheduleRows] = await connection.query(
      `
        SELECT id, department, supervisor_faculty_id, supervisor_name
        FROM exam_schedules
        WHERE exam_date = ?
          AND session_name = ?
          AND hall_code = ?
        ORDER BY id ASC
        FOR UPDATE
      `,
      [examDate, sessionName, hallCode]
    )

    if (scheduleRows.length === 0) {
      const err = new Error('No exam schedule found for the selected hall, date, and session')
      err.status = 404
      throw err
    }

    const existingAssignment = scheduleRows.find((row) => row.supervisor_faculty_id)
    if (existingAssignment) {
      const err = new Error(
        `Supervisor already assigned for ${hallCode} on ${examDate} ${sessionName}: ${existingAssignment.supervisor_name || `Faculty ${existingAssignment.supervisor_faculty_id}`}`
      )
      err.status = 409
      throw err
    }

    const where = [
      "LOWER(role) NOT LIKE '%principal%'",
      "LOWER(role) NOT LIKE '%adjunct faculty%'",
      "LOWER(role) NOT LIKE '%hindi teacher%'",
      'assigned_workload < max_workload'
    ]
    const params = []

    const preferredDepartment = department || String(scheduleRows[0]?.department || '').trim()

    if (preferredDepartment) {
      where.push('dept = ?')
      params.push(preferredDepartment)
    }

    if (search) {
      where.push('(name LIKE ? OR dept LIKE ? OR role LIKE ?)')
      const like = `%${search}%`
      params.push(like, like, like)
    }

    const [rows] = await connection.query(
      `
        SELECT faculty_id, name, role, dept, max_workload, assigned_workload
        FROM faculty
        WHERE ${where.join(' AND ')}
        ORDER BY max_workload DESC, assigned_workload ASC, name ASC
        LIMIT 1
        FOR UPDATE
      `,
      params
    )

    const selected = rows[0]
    if (!selected) {
      const err = new Error('No eligible faculty found for auto assignment')
      err.status = 409
      throw err
    }

    await connection.query(
      `
        UPDATE faculty
        SET assigned_workload = assigned_workload + 1
        WHERE faculty_id = ?
      `,
      [selected.faculty_id]
    )

    await connection.query(
      `
        UPDATE exam_schedules
        SET supervisor_faculty_id = ?, supervisor_name = ?
        WHERE exam_date = ?
          AND session_name = ?
          AND hall_code = ?
      `,
      [selected.faculty_id, selected.name, examDate, sessionName, hallCode]
    )

    await connection.commit()

    const assignedFaculty = await findById(selected.faculty_id)
    return {
      ...assignedFaculty,
      hallCode,
      examDate,
      sessionName
    }
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}

async function clearAssignedWorkloadById(id) {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()

    const [result] = await connection.query(
      `
        UPDATE faculty
        SET assigned_workload = 0
        WHERE faculty_id = ?
      `,
      [Number(id)]
    )

    if (result.affectedRows === 0) {
      await connection.rollback()
      return null
    }

    if (await ensureExamScheduleAssignmentColumns(connection)) {
      await connection.query(
        `
          UPDATE exam_schedules
          SET supervisor_faculty_id = NULL, supervisor_name = NULL
          WHERE supervisor_faculty_id = ? AND exam_date >= CURRENT_DATE()
        `,
        [Number(id)]
      )
      
      await connection.query(
        `
          UPDATE exam_schedules
          SET supervisor_faculty_id_two = NULL, supervisor_name_two = NULL
          WHERE supervisor_faculty_id_two = ? AND exam_date >= CURRENT_DATE()
        `,
        [Number(id)]
      )
    }

    if (await hasAllocationTables()) {
      await connection.query(
        `
          UPDATE exam_allocation_halls
          SET faculty_id = NULL, faculty_name = NULL
          WHERE faculty_id = ?
        `,
        [Number(id)]
      )
      
      await connection.query(
        `
          UPDATE exam_allocation_halls
          SET faculty_id_two = NULL, faculty_name_two = NULL
          WHERE faculty_id_two = ?
        `,
        [Number(id)]
      )
    }

    await connection.commit()
    return findById(id)
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}

async function hasAllocationTables() {
  const [rows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('exam_allocations', 'exam_allocation_halls')
    `
  )
  return Number(rows[0]?.total || 0) === 2
}

async function pickEligibleFaculty(connection, department = '') {
  const where = [
    "LOWER(role) NOT LIKE '%principal%'",
    "LOWER(role) NOT LIKE '%adjunct faculty%'",
    "LOWER(role) NOT LIKE '%hindi teacher%'",
    'assigned_workload < max_workload'
  ]
  const params = []

  if (department) {
    where.push('dept = ?')
    params.push(department)
  }

  const [rows] = await connection.query(
    `
      SELECT faculty_id, name, role, dept, max_workload, assigned_workload
      FROM faculty
      WHERE ${where.join(' AND ')}
      ORDER BY max_workload DESC, assigned_workload ASC, name ASC
      LIMIT 1
      FOR UPDATE
    `,
    params
  )

  return rows[0] || null
}

async function autoAssignAllLatestAllocation() {
  if (!(await hasAllocationTables())) {
    const err = new Error('No seating allocation found. Generate seating first.')
    err.status = 409
    throw err
  }

  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()

    const [allocationRows] = await connection.query(
      `
        SELECT id
        FROM exam_allocations
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `
    )

    const allocationId = Number(allocationRows[0]?.id || 0)
    if (!allocationId) {
      const err = new Error('No seating allocation found. Generate seating first.')
      err.status = 409
      throw err
    }

    const [hallRows] = await connection.query(
      `
        SELECT
          eah.id AS hall_allocation_id,
          eah.hall_code,
          eah.seat_rows,
          eah.seat_cols,
          eah.students_per_bench,
          eah.faculty_id,
          eah.faculty_name,
          eah.faculty_id_two,
          eah.faculty_name_two,
          h.block_name,
          h.exam_type,
          (
            SELECT r.dept_code
            FROM exam_allocation_rows r
            WHERE r.hall_allocation_id = eah.id
              AND r.dept_code IS NOT NULL
              AND r.dept_code <> '-'
            ORDER BY r.row_index ASC
            LIMIT 1
          ) AS preferred_dept
        FROM exam_allocation_halls eah
        LEFT JOIN hall h ON h.id = eah.hall_id
        WHERE eah.allocation_id = ?
        ORDER BY eah.id ASC
      `,
      [allocationId]
    )

    if (hallRows.length === 0) {
      const err = new Error('No halls found in latest seating allocation')
      err.status = 409
      throw err
    }

    const assignments = []
    let assignedCount = 0
    let skippedCount = 0

    for (const hall of hallRows) {
      const requiredSupervisors = getRequiredSupervisorsForHall(hall)

      if (!hall.faculty_id) {
        let selected = await pickEligibleFaculty(connection, String(hall.preferred_dept || '').trim())
        if (!selected) {
          selected = await pickEligibleFaculty(connection, '')
        }

        if (selected) {
          await connection.query(
            `UPDATE faculty SET assigned_workload = assigned_workload + 1 WHERE faculty_id = ?`,
            [selected.faculty_id]
          )
          await connection.query(
            `UPDATE exam_allocation_halls SET faculty_id = ?, faculty_name = ? WHERE id = ?`,
            [selected.faculty_id, selected.name, Number(hall.hall_allocation_id)]
          )
          assignedCount += 1
          assignments.push({
            hallCode: hall.hall_code,
            facultyId: Number(selected.faculty_id),
            facultyName: selected.name,
            status: 'assigned'
          })
        } else {
          skippedCount += 1
          assignments.push({
            hallCode: hall.hall_code,
            facultyId: null,
            facultyName: null,
            status: 'no_eligible_faculty'
          })
        }
      } else {
        skippedCount += 1
        assignments.push({
          hallCode: hall.hall_code,
          facultyId: Number(hall.faculty_id),
          facultyName: hall.faculty_name,
          status: 'already_assigned'
        })
      }

      if (requiredSupervisors > 1) {
        if (!hall.faculty_id_two) {
          let selectedTwo = await pickEligibleFaculty(connection, String(hall.preferred_dept || '').trim())
          if (!selectedTwo) {
            selectedTwo = await pickEligibleFaculty(connection, '')
          }

          if (selectedTwo) {
            await connection.query(
              `UPDATE faculty SET assigned_workload = assigned_workload + 1 WHERE faculty_id = ?`,
              [selectedTwo.faculty_id]
            )
            await connection.query(
              `UPDATE exam_allocation_halls SET faculty_id_two = ?, faculty_name_two = ? WHERE id = ?`,
              [selectedTwo.faculty_id, selectedTwo.name, Number(hall.hall_allocation_id)]
            )
            assignedCount += 1
            assignments.push({
              hallCode: hall.hall_code,
              facultyId: Number(selectedTwo.faculty_id),
              facultyName: selectedTwo.name,
              status: 'assigned'
            })
          } else {
            skippedCount += 1
            assignments.push({
              hallCode: hall.hall_code,
              facultyId: null,
              facultyName: null,
              status: 'no_eligible_faculty'
            })
          }
        } else {
          skippedCount += 1
          assignments.push({
            hallCode: hall.hall_code,
            facultyId: Number(hall.faculty_id_two),
            facultyName: hall.faculty_name_two,
            status: 'already_assigned'
          })
        }
      }
    }

    await connection.commit()

    return {
      allocationId,
      assignedCount,
      skippedCount,
      assignments
    }
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}

async function listLatestAllocationAssignments() {
  const assignments = []

  if (await ensureExamScheduleAssignmentColumns()) {
    const [scheduleRows] = await db.query(
      `
        SELECT
          hall_code,
          supervisor_faculty_id,
          supervisor_name,
          department,
          exam_date,
          session_name
        FROM exam_schedules
        WHERE supervisor_faculty_id IS NOT NULL
        ORDER BY exam_date DESC, session_name ASC, hall_code ASC
      `
    )

    const seenScheduleSlots = new Set()
    for (const row of scheduleRows) {
      const slotKey = `${row.exam_date}|${row.session_name}|${row.hall_code}|${row.supervisor_faculty_id}`
      if (seenScheduleSlots.has(slotKey)) {
        continue
      }
      seenScheduleSlots.add(slotKey)
      assignments.push({
        hallCode: row.hall_code,
        facultyId: Number(row.supervisor_faculty_id),
        facultyName: row.supervisor_name || null,
        facultyDepartment: row.department || null,
        examDate: row.exam_date,
        sessionName: row.session_name,
        workloadText: null
      })
    }
  }

  if (await hasAllocationTables()) {
    const [allocationRows] = await db.query(
      `
        SELECT id
        FROM exam_allocations
        ORDER BY id DESC
        LIMIT 1
      `
    )
    const allocationId = Number(allocationRows[0]?.id || 0)

    if (allocationId) {
      const [rows] = await db.query(
        `
          SELECT
            h.hall_code,
            h.faculty_id,
            h.faculty_name,
            h.faculty_id_two,
            h.faculty_name_two,
            f.dept AS faculty_dept,
            f.assigned_workload,
            f.max_workload,
            f2.dept AS faculty_dept_two,
            f2.assigned_workload AS assigned_workload_two,
            f2.max_workload AS max_workload_two
          FROM exam_allocation_halls h
          LEFT JOIN faculty f ON f.faculty_id = h.faculty_id
          LEFT JOIN faculty f2 ON f2.faculty_id = h.faculty_id_two
          WHERE h.allocation_id = ?
          ORDER BY h.hall_code ASC
        `,
        [allocationId]
      )

      for (const row of rows) {
        assignments.push({
          hallCode: row.hall_code,
          facultyId: row.faculty_id ? Number(row.faculty_id) : null,
          facultyName: row.faculty_name || null,
          facultyDepartment: row.faculty_dept || null,
          workloadText:
            row.assigned_workload === null || row.max_workload === null
              ? null
              : `${Number(row.assigned_workload)}/${Number(row.max_workload)}`
        })

        if (row.faculty_id_two) {
          assignments.push({
            hallCode: row.hall_code,
            facultyId: Number(row.faculty_id_two),
            facultyName: row.faculty_name_two || null,
            facultyDepartment: row.faculty_dept_two || null,
            workloadText:
              row.assigned_workload_two === null || row.max_workload_two === null
                ? null
                : `${Number(row.assigned_workload_two)}/${Number(row.max_workload_two)}`
          })
        }
      }
    }
  }

  return assignments
}

async function listHistoricalAssignments() {
  const assignments = []

  if (await hasAllocationTables()) {
    const [allocationRows] = await db.query(
      `
        SELECT id
        FROM exam_allocations
        ORDER BY id DESC
      `
    )

    if (allocationRows.length > 1) {
      const historicalIds = allocationRows.slice(1).map(r => r.id)
      const [rows] = await db.query(
        `
          SELECT
            h.hall_code,
            h.faculty_id,
            h.faculty_name,
            h.faculty_id_two,
            h.faculty_name_two,
            f.dept AS faculty_dept,
            f2.dept AS faculty_dept_two
          FROM exam_allocation_halls h
          LEFT JOIN faculty f ON f.faculty_id = h.faculty_id
          LEFT JOIN faculty f2 ON f2.faculty_id = h.faculty_id_two
          WHERE h.allocation_id IN (?) AND (h.faculty_id IS NOT NULL OR h.faculty_id_two IS NOT NULL)
          ORDER BY h.id DESC, h.hall_code ASC
        `,
        [historicalIds]
      )

      for (const row of rows) {
        if (row.faculty_id) {
          assignments.push({
            hallCode: row.hall_code,
            facultyId: Number(row.faculty_id),
            facultyName: row.faculty_name || null,
            facultyDepartment: row.faculty_dept || null
          })
        }
        if (row.faculty_id_two) {
          assignments.push({
            hallCode: row.hall_code,
            facultyId: Number(row.faculty_id_two),
            facultyName: row.faculty_name_two || null,
            facultyDepartment: row.faculty_dept_two || null
          })
        }
      }
    }
  }

  return assignments
}

async function cancelAllAssignments() {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()

    const [facultyResult] = await connection.query(
      `
        UPDATE faculty
        SET assigned_workload = 0
        WHERE assigned_workload <> 0
      `
    )

    let hallsCleared = 0
    let schedulesCleared = 0
    if (await hasAllocationTables()) {
      const [allocationRows] = await connection.query(
        `
          SELECT id
          FROM exam_allocations
          ORDER BY id DESC
          LIMIT 1
          FOR UPDATE
        `
      )

      const allocationId = Number(allocationRows[0]?.id || 0)
      if (allocationId) {
        const [hallResult] = await connection.query(
          `
            UPDATE exam_allocation_halls
            SET faculty_id = NULL, faculty_name = NULL, faculty_id_two = NULL, faculty_name_two = NULL
            WHERE allocation_id = ?
              AND (faculty_id IS NOT NULL OR faculty_id_two IS NOT NULL)
          `,
          [allocationId]
        )
        hallsCleared = Number(hallResult.affectedRows || 0)
      }
    }

    if (await ensureExamScheduleAssignmentColumns(connection)) {
      const [scheduleResult] = await connection.query(
        `
          UPDATE exam_schedules
          SET supervisor_faculty_id = NULL, supervisor_name = NULL, supervisor_faculty_id_two = NULL, supervisor_name_two = NULL
          WHERE (supervisor_faculty_id IS NOT NULL OR supervisor_faculty_id_two IS NOT NULL)
            AND exam_date >= CURRENT_DATE()
        `
      )
      schedulesCleared = Number(scheduleResult.affectedRows || 0)
    }

    await connection.commit()

    return {
      facultyReset: Number(facultyResult.affectedRows || 0),
      hallsCleared,
      schedulesCleared
    }
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}

module.exports = {
  listFaculty,
  listDepartments,
  findById,
  createFaculty,
  updateFacultyById,
  autoAssignSupervisor,
  clearAssignedWorkloadById,
  autoAssignAllLatestAllocation,
  listLatestAllocationAssignments,
  listHistoricalAssignments,
  cancelAllAssignments
}
