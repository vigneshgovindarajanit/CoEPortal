const db = require('../../config/db')
const allocationRepository = require('../allocation/allocation.repository')

let initPromise
const PRIMARY_TABLE = 'exam_schedules'
const MIRROR_TABLE = 'exam'

async function hasColumn(tableName, columnName) {
  const [rows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName]
  )

  return Number(rows[0]?.total || 0) > 0
}

async function getColumnLength(tableName, columnName) {
  const [rows] = await db.query(
    `
      SELECT CHARACTER_MAXIMUM_LENGTH AS max_length
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  )

  return Number(rows[0]?.max_length || 0)
}

async function renameLegacyColumn(tableName, oldName, newName, definition) {
  const newColumnExists = await hasColumn(tableName, newName)
  if (newColumnExists) {
    return
  }

  const oldColumnExists = await hasColumn(tableName, oldName)
  if (!oldColumnExists) {
    return
  }

  await db.query(`ALTER TABLE \`${tableName}\` CHANGE COLUMN ${oldName} ${newName} ${definition}`)
}

async function ensureScheduleTableSchema(tableName) {
  await db.query(
    `
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        id INT NOT NULL AUTO_INCREMENT,
        exam_date DATE NOT NULL,
        session_name VARCHAR(10) NOT NULL,
        exam_type VARCHAR(30) NOT NULL,
        course_code VARCHAR(40) NOT NULL,
        course_name VARCHAR(255) NOT NULL,
        department VARCHAR(255) NOT NULL,
        year TINYINT NOT NULL,
        hall_code VARCHAR(50) NOT NULL,
        supervisor_faculty_id INT NULL,
        supervisor_name VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_${tableName}_slot (exam_date, session_name, course_code, hall_code),
        KEY idx_${tableName}_date (exam_date),
        KEY idx_${tableName}_type (exam_type),
        KEY idx_${tableName}_department (department),
        KEY idx_${tableName}_hall (hall_code)
      )
    `
  )

  await renameLegacyColumn(tableName, 'examDate', 'exam_date', 'DATE NOT NULL')
  await renameLegacyColumn(tableName, 'sessionName', 'session_name', 'VARCHAR(10) NOT NULL')
  await renameLegacyColumn(tableName, 'examType', 'exam_type', 'VARCHAR(30) NOT NULL')
  await renameLegacyColumn(tableName, 'courseCode', 'course_code', 'VARCHAR(40) NOT NULL')
  await renameLegacyColumn(tableName, 'courseName', 'course_name', 'VARCHAR(255) NOT NULL')
  await renameLegacyColumn(tableName, 'hallCode', 'hall_code', 'VARCHAR(50) NOT NULL')
  await renameLegacyColumn(tableName, 'createdAt', 'created_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP')
  await renameLegacyColumn(
    tableName,
    'updatedAt',
    'updated_at',
    'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
  )

  const departmentLength = await getColumnLength(tableName, 'department')
  if (departmentLength > 0 && departmentLength < 255) {
    await db.query(`ALTER TABLE \`${tableName}\` MODIFY COLUMN department VARCHAR(255) NOT NULL`)
  }

  const supervisorFacultyIdExists = await hasColumn(tableName, 'supervisor_faculty_id')
  if (!supervisorFacultyIdExists) {
    await db.query(
      `ALTER TABLE \`${tableName}\` ADD COLUMN supervisor_faculty_id INT NULL AFTER hall_code`
    )
  }

  const supervisorNameExists = await hasColumn(tableName, 'supervisor_name')
  if (!supervisorNameExists) {
    await db.query(
      `ALTER TABLE \`${tableName}\` ADD COLUMN supervisor_name VARCHAR(255) NULL AFTER supervisor_faculty_id`
    )
  }

  await db.query(
    `
      UPDATE \`${tableName}\`
      SET exam_type = 'PRACTICAL'
      WHERE UPPER(TRIM(course_name)) REGEXP 'LAB[[:space:]]*$'
    `
  )
}

function getScheduleParams(payload = {}) {
  return [
    payload.examDate,
    payload.sessionName,
    payload.examType,
    payload.courseCode,
    payload.courseName,
    payload.department,
    payload.year,
    payload.hallCode,
    payload.supervisorFacultyId ?? null,
    payload.supervisorName ?? null
  ]
}

async function syncMirrorTableRow(connection, payload, previousPayload = null) {
  const previous = previousPayload || payload
  const [updateResult] = await connection.query(
    `
      UPDATE \`${MIRROR_TABLE}\`
      SET
        exam_date = ?,
        session_name = ?,
        exam_type = ?,
        course_code = ?,
        course_name = ?,
        department = ?,
        year = ?,
        hall_code = ?,
        supervisor_faculty_id = ?,
        supervisor_name = ?
      WHERE exam_date = ?
        AND session_name = ?
        AND course_code = ?
        AND hall_code = ?
    `,
    [
      ...getScheduleParams(payload),
      previous.examDate,
      previous.sessionName,
      previous.courseCode,
      previous.hallCode
    ]
  )

  if (Number(updateResult.affectedRows || 0) > 0) {
    return
  }

  await connection.query(
    `
      INSERT INTO \`${MIRROR_TABLE}\`
        (
          exam_date,
          session_name,
          exam_type,
          course_code,
          course_name,
          department,
          year,
          hall_code,
          supervisor_faculty_id,
          supervisor_name
        )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        exam_type = VALUES(exam_type),
        course_name = VALUES(course_name),
        department = VALUES(department),
        year = VALUES(year),
        supervisor_faculty_id = VALUES(supervisor_faculty_id),
        supervisor_name = VALUES(supervisor_name)
    `,
    getScheduleParams(payload)
  )
}

async function deleteMirrorTableRow(connection, payload) {
  await connection.query(
    `
      DELETE FROM \`${MIRROR_TABLE}\`
      WHERE exam_date = ?
        AND session_name = ?
        AND course_code = ?
        AND hall_code = ?
    `,
    [payload.examDate, payload.sessionName, payload.courseCode, payload.hallCode]
  )
}

async function initSchema() {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureScheduleTableSchema(PRIMARY_TABLE)
      await ensureScheduleTableSchema(MIRROR_TABLE)
    })()
  }

  await initPromise
}

function mapRow(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    examDate: row.exam_date,
    sessionName: row.session_name,
    examType: row.exam_type,
    courseCode: row.course_code,
    courseName: row.course_name,
    department: row.department,
    year: row.year,
    hallCode: row.hall_code,
    supervisorFacultyId: row.supervisor_faculty_id ? Number(row.supervisor_faculty_id) : null,
    supervisorName: row.supervisor_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function getHallDepartmentLabelFromAllocationLayout(layout = {}) {
  const departments = []

  for (const row of layout?.rows || []) {
    const dept = String(row?.dept || '')
      .trim()
      .toUpperCase()

    if (dept && dept !== '-' && !departments.includes(dept)) {
      departments.push(dept)
    }
  }

  return departments.join(', ')
}

async function getAllocationDepartmentMapByExamType(examType) {
  const allocation = await allocationRepository.findLatestAllocation(examType)
  const map = new Map()

  for (const layout of allocation?.hallLayouts || []) {
    const hallCode = String(layout?.hall?.hallCode || '')
      .trim()
      .toUpperCase()
    const departmentLabel = getHallDepartmentLabelFromAllocationLayout(layout)

    if (hallCode && departmentLabel) {
      map.set(hallCode, departmentLabel)
    }
  }

  return map
}

async function getAll(filters = {}) {
  await initSchema()

  const where = []
  const params = []

  const examDate = String(filters.examDate || '').trim()
  const examType = String(filters.examType || '')
    .trim()
    .toUpperCase()
  const department = String(filters.department || '')
    .trim()
    .toUpperCase()
  const search = String(filters.search || '').trim()

  if (examDate) {
    where.push('exam_date = ?')
    params.push(examDate)
  }

  if (examType) {
    where.push('exam_type = ?')
    params.push(examType)
  }

  if (department) {
    where.push('department = ?')
    params.push(department)
  }

  if (search) {
    where.push('(course_code LIKE ? OR course_name LIKE ? OR hall_code LIKE ?)')
    const like = `%${search}%`
    params.push(like, like, like)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const [rows] = await db.query(
    `
      SELECT
        id,
        exam_date,
        session_name,
        exam_type,
        course_code,
        course_name,
        department,
        year,
        hall_code,
        supervisor_faculty_id,
        supervisor_name,
        created_at,
        updated_at
      FROM exam_schedules
      ${whereSql}
      ORDER BY exam_date ASC, session_name ASC, course_code ASC
    `,
    params
  )

  const schedules = rows.map(mapRow)
  const examTypes = [...new Set(schedules.map((item) => String(item?.examType || '').trim().toUpperCase()).filter(Boolean))]
  const allocationDepartmentMaps = new Map()

  for (const examTypeKey of examTypes) {
    allocationDepartmentMaps.set(examTypeKey, await getAllocationDepartmentMapByExamType(examTypeKey))
  }

  return schedules.map((schedule) => {
    const examTypeKey = String(schedule?.examType || '').trim().toUpperCase()
    const hallCodeKey = String(schedule?.hallCode || '').trim().toUpperCase()
    const mappedDepartment = allocationDepartmentMaps.get(examTypeKey)?.get(hallCodeKey)

    if (!mappedDepartment) {
      return schedule
    }

    return {
      ...schedule,
      department: mappedDepartment
    }
  })
}

async function getFilters(filters = {}) {
  await initSchema()
  const examType = String(filters.examType || '')
    .trim()
    .toUpperCase()
  const where = []
  const params = []

  if (examType) {
    where.push('exam_type = ?')
    params.push(examType)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const [rows] = await db.query(
    `
      SELECT DISTINCT exam_type, department, session_name
      FROM exam_schedules
      ${whereSql}
      ORDER BY exam_type ASC, department ASC, session_name ASC
    `,
    params
  )

  const [dateRows] = await db.query(
    `
      SELECT DISTINCT exam_date
      FROM exam_schedules
      ${whereSql}
      ORDER BY exam_date ASC
    `,
    params
  )

  const examTypes = []
  const departments = []
  const sessions = []
  const dates = []

  for (const row of rows) {
    if (row.exam_type && !examTypes.includes(row.exam_type)) {
      examTypes.push(row.exam_type)
    }
    if (row.department && !departments.includes(row.department)) {
      departments.push(row.department)
    }
    if (row.session_name && !sessions.includes(row.session_name)) {
      sessions.push(row.session_name)
    }
  }

  for (const row of dateRows) {
    if (row.exam_date) {
      dates.push(row.exam_date)
    }
  }

  return { examTypes, departments, sessions, dates }
}

async function findById(id) {
  await initSchema()
  const [rows] = await db.query(
    `
      SELECT
        id,
        exam_date,
        session_name,
        exam_type,
        course_code,
        course_name,
        department,
        year,
        hall_code,
        supervisor_faculty_id,
        supervisor_name,
        created_at,
        updated_at
      FROM exam_schedules
      WHERE id = ?
      LIMIT 1
    `,
    [Number(id)]
  )

  return mapRow(rows[0])
}

async function findDuplicateSlot(payload, excludeId = null) {
  await initSchema()

  if (excludeId === null || excludeId === undefined) {
    const [rows] = await db.query(
      `
        SELECT id
        FROM exam_schedules
        WHERE exam_date = ?
          AND session_name = ?
          AND course_code = ?
          AND hall_code = ?
        LIMIT 1
      `,
      [payload.examDate, payload.sessionName, payload.courseCode, payload.hallCode]
    )
    return rows[0] || null
  }

  const [rows] = await db.query(
    `
      SELECT id
      FROM exam_schedules
      WHERE exam_date = ?
        AND session_name = ?
        AND course_code = ?
        AND hall_code = ?
        AND id <> ?
      LIMIT 1
    `,
    [payload.examDate, payload.sessionName, payload.courseCode, payload.hallCode, Number(excludeId)]
  )
  return rows[0] || null
}

async function create(payload) {
  await initSchema()
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.query(
      `
        INSERT INTO exam_schedules
          (
            exam_date,
            session_name,
            exam_type,
            course_code,
            course_name,
            department,
            year,
            hall_code,
            supervisor_faculty_id,
            supervisor_name
          )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      getScheduleParams(payload)
    )

    const created = {
      ...payload,
      id: Number(result.insertId)
    }

    await syncMirrorTableRow(connection, created)
    await connection.commit()
    return findById(result.insertId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function updateById(id, payload) {
  await initSchema()
  const existing = await findById(id)
  if (!existing) {
    return null
  }

  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.query(
      `
        UPDATE exam_schedules
        SET
          exam_date = ?,
          session_name = ?,
          exam_type = ?,
          course_code = ?,
          course_name = ?,
          department = ?,
          year = ?,
          hall_code = ?,
          supervisor_faculty_id = ?,
          supervisor_name = ?
        WHERE id = ?
      `,
      [...getScheduleParams(payload), Number(id)]
    )

    if (result.affectedRows === 0) {
      await connection.rollback()
      return null
    }

    await syncMirrorTableRow(connection, payload, existing)
    await connection.commit()
    return findById(id)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function deleteById(id) {
  await initSchema()
  const existing = await findById(id)
  if (!existing) {
    return false
  }

  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()
    const [result] = await connection.query('DELETE FROM exam_schedules WHERE id = ?', [Number(id)])
    await deleteMirrorTableRow(connection, existing)
    await connection.commit()
    return result.affectedRows > 0
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function deleteAll() {
  await initSchema()
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()
    const [result] = await connection.query('DELETE FROM exam_schedules')
    await connection.query(`DELETE FROM \`${MIRROR_TABLE}\``)
    await connection.commit()
    return Number(result.affectedRows || 0)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

module.exports = {
  getAll,
  getFilters,
  findById,
  findDuplicateSlot,
  create,
  updateById,
  deleteById,
  deleteAll
}
