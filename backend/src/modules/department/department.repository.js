const db = require('../../config/db')

let initPromise

const DEFAULT_DEPARTMENTS = [
  { program: 'BE', code: 'BM', name: 'Biomedical Engineering', intake: 60 },
  { program: 'BE', code: 'CE', name: 'Civil Engineering', intake: 60 },
  { program: 'BE', code: 'CD', name: 'Computer Science & Design', intake: 60 },
  { program: 'BE', code: 'CS', name: 'Computer Science & Engineering', intake: 240 },
  { program: 'BE', code: 'EE', name: 'Electrical & Electronics Engineering', intake: 60 },
  { program: 'BE', code: 'EC', name: 'Electronics & Communication Engineering', intake: 240 },
  { program: 'BE', code: 'EI', name: 'Electronics & Instrumentation Engineering', intake: 60 },
  { program: 'BE', code: 'SE', name: 'Information Science & Engineering', intake: 60 },
  { program: 'BE', code: 'ME', name: 'Mechanical Engineering', intake: 60 },
  { program: 'BE', code: 'MZ', name: 'Mechatronics Engineering', intake: 60 },
  { program: 'BTECH', code: 'AG', name: 'Agricultural Engineering', intake: 60 },
  { program: 'BTECH', code: 'AD', name: 'Artificial Intelligence and Data Science', intake: 240 },
  { program: 'BTECH', code: 'AL', name: 'Artificial Intelligence and Machine Learning', intake: 60 },
  { program: 'BTECH', code: 'BT', name: 'Biotechnology', intake: 60 },
  { program: 'BTECH', code: 'CB', name: 'Computer Science & Business Systems', intake: 60 },
  { program: 'BTECH', code: 'CT', name: 'Computer Technology', intake: 60 },
  { program: 'BTECH', code: 'FD', name: 'Food Technology', intake: 60 },
  { program: 'BTECH', code: 'IT', name: 'Information Technology', intake: 240 },
  { program: 'BTECH', code: 'FT', name: 'Fashion Technology', intake: 60 },
  { program: 'BTECH', code: 'TT', name: 'Textile Technology', intake: 60 }
]

function mapRow(row) {
  return {
    id: row.id,
    program: row.program,
    code: row.code,
    name: row.name,
    intake: Number(row.intake),
    isActive: Boolean(row.is_active)
  }
}

async function seedIfEmpty() {
  const [rows] = await db.query('SELECT COUNT(*) AS total FROM department_catalog')
  const total = Number(rows[0]?.total || 0)
  if (total > 0) {
    return
  }

  for (const item of DEFAULT_DEPARTMENTS) {
    await db.query(
      `
        INSERT INTO department_catalog (program, code, name, intake, is_active)
        VALUES (?, ?, ?, ?, 1)
      `,
      [item.program, item.code, item.name, item.intake]
    )
  }
}

async function initSchema() {
  if (!initPromise) {
    initPromise = (async () => {
      await db.query(
        `
          CREATE TABLE IF NOT EXISTS department_catalog (
            id INT NOT NULL AUTO_INCREMENT,
            program VARCHAR(20) NOT NULL,
            code VARCHAR(10) NOT NULL,
            name VARCHAR(255) NOT NULL,
            intake INT NOT NULL DEFAULT 0,
            is_active TINYINT NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_department_program_code (program, code)
          )
        `
      )
      await seedIfEmpty()
    })()
  }

  await initPromise
}

async function listDepartments() {
  await initSchema()
  const [rows] = await db.query(
    `
      SELECT id, program, code, name, intake, is_active
      FROM department_catalog
      ORDER BY program ASC, code ASC
    `
  )
  return rows.map(mapRow)
}

async function findById(id) {
  await initSchema()
  const [rows] = await db.query(
    `
      SELECT id, program, code, name, intake, is_active
      FROM department_catalog
      WHERE id = ?
      LIMIT 1
    `,
    [Number(id)]
  )
  return rows[0] ? mapRow(rows[0]) : null
}

async function findByProgramCode(program, code, excludeId = null) {
  await initSchema()
  if (!excludeId) {
    const [rows] = await db.query(
      `
        SELECT id, program, code, name, intake, is_active
        FROM department_catalog
        WHERE program = ? AND code = ?
        LIMIT 1
      `,
      [program, code]
    )
    return rows[0] ? mapRow(rows[0]) : null
  }

  const [rows] = await db.query(
    `
      SELECT id, program, code, name, intake, is_active
      FROM department_catalog
      WHERE program = ? AND code = ? AND id <> ?
      LIMIT 1
    `,
    [program, code, Number(excludeId)]
  )
  return rows[0] ? mapRow(rows[0]) : null
}

async function createDepartment(payload) {
  await initSchema()
  const [result] = await db.query(
    `
      INSERT INTO department_catalog (program, code, name, intake, is_active)
      VALUES (?, ?, ?, ?, ?)
    `,
    [payload.program, payload.code, payload.name, payload.intake, payload.isActive ? 1 : 0]
  )
  return findById(result.insertId)
}

async function updateDepartment(id, payload) {
  await initSchema()
  const [result] = await db.query(
    `
      UPDATE department_catalog
      SET program = ?, code = ?, name = ?, intake = ?, is_active = ?
      WHERE id = ?
    `,
    [payload.program, payload.code, payload.name, payload.intake, payload.isActive ? 1 : 0, Number(id)]
  )
  if (result.affectedRows === 0) {
    return null
  }
  return findById(id)
}

async function deleteDepartment(id) {
  await initSchema()
  const [result] = await db.query('DELETE FROM department_catalog WHERE id = ?', [Number(id)])
  return result.affectedRows > 0
}

module.exports = {
  listDepartments,
  findById,
  findByProgramCode,
  createDepartment,
  updateDepartment,
  deleteDepartment
}
