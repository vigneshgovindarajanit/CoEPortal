const db = require('../../config/db')
const { calculateCapacity, calculateSupervisors } = require('./hall.model')
let initPromise

const BASE_SELECT = `
  SELECT
    id,
    block_name AS block,
    hall_number AS number,
    hall_code,
    seat_rows,
    seat_cols,
    students_per_bench,
    exam_type,
    capacity,
    supervisors,
    is_active,
    created_at,
    updated_at
  FROM hall
`

async function initSchema() {
  if (!initPromise) {
    initPromise = (async () => {
      const [columnRows] = await db.query(
        `
          SELECT COUNT(*) AS total
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'hall'
            AND COLUMN_NAME = 'exam_type'
        `
      )

      if (!Number(columnRows[0]?.total || 0)) {
        await db.query(
          "ALTER TABLE hall ADD COLUMN exam_type VARCHAR(20) NOT NULL DEFAULT 'SEMESTER' AFTER students_per_bench"
        )
      }
    })()
  }

  await initPromise
}

function mapRowToHall(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    block: row.block,
    number: row.number,
    hallCode: row.hall_code,
    rows: row.seat_rows,
    cols: row.seat_cols,
    studentsPerBench: row.students_per_bench,
    examType: row.exam_type || 'SEMESTER',
    capacity: calculateCapacity(
      Number(row.seat_rows || 0),
      Number(row.seat_cols || 0),
      Number(row.students_per_bench || 0),
      row.exam_type || 'SEMESTER'
    ),
    supervisors: calculateSupervisors(
      calculateCapacity(
        Number(row.seat_rows || 0),
        Number(row.seat_cols || 0),
        Number(row.students_per_bench || 0),
        row.exam_type || 'SEMESTER'
      ),
      Number(row.students_per_bench || 0),
      row.exam_type || 'SEMESTER'
    ),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function getAll(search = '') {
  await initSchema()
  const normalizedSearch = String(search || '')
    .toLowerCase()
    .replace(/\s+/g, '')

  if (!normalizedSearch) {
    const [rows] = await db.query(`${BASE_SELECT} ORDER BY block_name, hall_number`)
    return rows.map(mapRowToHall)
  }

  const likeValue = `%${normalizedSearch}%`
  const [rows] = await db.query(
    `
      ${BASE_SELECT}
      WHERE REPLACE(LOWER(hall_code), ' ', '') LIKE ?
         OR REPLACE(LOWER(CONCAT(block_name, hall_number)), ' ', '') LIKE ?
         OR REPLACE(LOWER(CONCAT(block_name, ' ', hall_number)), ' ', '') LIKE ?
      ORDER BY block_name, hall_number
    `,
    [likeValue, likeValue, likeValue]
  )
  return rows.map(mapRowToHall)
}

async function findAllByStatus(isActive) {
  await initSchema()
  const [rows] = await db.query(
    `${BASE_SELECT} WHERE is_active = ? ORDER BY block_name, hall_number`,
    [isActive ? 1 : 0]
  )
  return rows.map(mapRowToHall)
}

async function getStats() {
  await initSchema()
  const [rows] = await db.query(
    `
      SELECT
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_halls,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive_halls,
        SUM(
          CASE
            WHEN is_active = 1 THEN seat_rows * seat_cols * students_per_bench
            ELSE 0
          END
        ) AS total_capacity
      FROM hall
    `
  )

  return {
    activeHalls: Number(rows[0]?.active_halls || 0),
    inactiveHalls: Number(rows[0]?.inactive_halls || 0),
    totalCapacity: Number(rows[0]?.total_capacity || 0)
  }
}

async function findById(id) {
  await initSchema()
  const [rows] = await db.query(`${BASE_SELECT} WHERE id = ? LIMIT 1`, [Number(id)])
  return mapRowToHall(rows[0])
}

async function findByCode(hallCode, excludeId = null) {
  await initSchema()
  if (excludeId === null || excludeId === undefined) {
    const [rows] = await db.query(`${BASE_SELECT} WHERE hall_code = ? LIMIT 1`, [hallCode])
    return mapRowToHall(rows[0])
  }

  const [rows] = await db.query(
    `${BASE_SELECT} WHERE hall_code = ? AND id <> ? LIMIT 1`,
    [hallCode, Number(excludeId)]
  )
  return mapRowToHall(rows[0])
}

async function create(payload) {
  await initSchema()
  const [result] = await db.query(
    `
      INSERT INTO hall
      (
        block_name,
        hall_number,
        hall_code,
        seat_rows,
        seat_cols,
        students_per_bench,
        exam_type,
        capacity,
        supervisors,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.block,
      payload.number,
      payload.hallCode,
      payload.rows,
      payload.cols,
      payload.studentsPerBench,
      payload.examType,
      payload.capacity,
      payload.supervisors,
      payload.isActive ? 1 : 0
    ]
  )

  return findById(result.insertId)
}

async function updateById(id, payload) {
  await initSchema()
  const [result] = await db.query(
    `
      UPDATE hall
      SET
        block_name = ?,
        hall_number = ?,
        hall_code = ?,
        seat_rows = ?,
        seat_cols = ?,
        students_per_bench = ?,
        exam_type = ?,
        capacity = ?,
        supervisors = ?,
        is_active = ?
      WHERE id = ?
    `,
    [
      payload.block,
      payload.number,
      payload.hallCode,
      payload.rows,
      payload.cols,
      payload.studentsPerBench,
      payload.examType,
      payload.capacity,
      payload.supervisors,
      payload.isActive ? 1 : 0,
      Number(id)
    ]
  )

  if (result.affectedRows === 0) {
    return null
  }

  return findById(id)
}

async function updateStatusById(id, isActive) {
  await initSchema()
  const [result] = await db.query('UPDATE hall SET is_active = ? WHERE id = ?', [
    isActive ? 1 : 0,
    Number(id)
  ])

  if (result.affectedRows === 0) {
    return null
  }

  return findById(id)
}

async function deleteById(id) {
  await initSchema()
  const [result] = await db.query('DELETE FROM hall WHERE id = ?', [Number(id)])
  return result.affectedRows > 0
}

module.exports = {
  getAll,
  getStats,
  findAllByStatus,
  create,
  findById,
  findByCode,
  updateById,
  updateStatusById,
  deleteById
}
