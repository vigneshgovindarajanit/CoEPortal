const mysql = require('mysql2/promise')

const shouldUseSsl = ['1', 'true', 'yes'].includes(String(process.env.DB_SSL || '').toLowerCase())

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'coeportal',
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
  dateStrings: ['DATE']
})

module.exports = pool
