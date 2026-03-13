const pool = require('../../config/db')

async function ensureAdminUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      password_salt VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)
}

async function countAdminUsers() {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM admin_users')
  return Number(rows[0]?.total || 0)
}

async function createAdminUser(user) {
  const [result] = await pool.query(
    `
      INSERT INTO admin_users (username, password_hash, password_salt, role)
      VALUES (?, ?, ?, ?)
    `,
    [user.username, user.passwordHash, user.passwordSalt, user.role || 'admin']
  )

  return findAdminUserById(result.insertId)
}

async function findAdminUserByUsername(username) {
  const [rows] = await pool.query(
    `
      SELECT id, username, password_hash AS passwordHash, password_salt AS passwordSalt, role
      FROM admin_users
      WHERE username = ?
      LIMIT 1
    `,
    [username]
  )
  return rows[0] || null
}

async function findAdminUserById(id) {
  const [rows] = await pool.query(
    `
      SELECT id, username, role
      FROM admin_users
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  )
  return rows[0] || null
}

module.exports = {
  ensureAdminUsersTable,
  countAdminUsers,
  createAdminUser,
  findAdminUserByUsername,
  findAdminUserById
}
