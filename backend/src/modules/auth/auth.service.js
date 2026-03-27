const crypto = require('crypto')
const env = require('../../config/env')
const { createToken, verifyToken } = require('../../utils/jwt')
const authRepository = require('./auth.repository')
const { normalizeUsername, validateLoginPayload } = require('./auth.model')

const DEFAULT_ADMIN_USERNAME = env.adminUsername
const DEFAULT_ADMIN_PASSWORD = env.adminPassword
const JWT_EXPIRES_IN_SECONDS = env.jwtExpiresInSeconds

let authReadyPromise

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex')
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  return {
    passwordSalt: salt,
    passwordHash: hashPassword(password, salt)
  }
}

async function ensureAuthReady() {
  if (!authReadyPromise) {
    authReadyPromise = (async () => {
      await authRepository.ensureAdminUsersTable()
      const totalUsers = await authRepository.countAdminUsers()
      if (totalUsers > 0) {
        return
      }

      const passwordRecord = createPasswordRecord(DEFAULT_ADMIN_PASSWORD)
      await authRepository.createAdminUser({
        username: normalizeUsername(DEFAULT_ADMIN_USERNAME),
        passwordHash: passwordRecord.passwordHash,
        passwordSalt: passwordRecord.passwordSalt,
        role: 'admin'
      })
    })().catch((err) => {
      authReadyPromise = null
      throw err
    })
  }

  return authReadyPromise
}

async function login(payload = {}) {
  await ensureAuthReady()
  const credentials = validateLoginPayload(payload)
  const user = await authRepository.findAdminUserByUsername(credentials.username)

  if (!user) {
    const err = new Error('Invalid username or password')
    err.status = 401
    throw err
  }

  const incomingHash = hashPassword(credentials.password, user.passwordSalt)
  if (incomingHash !== user.passwordHash) {
    const err = new Error('Invalid username or password')
    err.status = 401
    throw err
  }

  const safeUser = {
    id: user.id,
    username: user.username,
    role: user.role
  }

  return {
    token: createToken(safeUser),
    user: safeUser,
    expiresIn: JWT_EXPIRES_IN_SECONDS
  }
}

async function getProfile(authUser = {}) {
  await ensureAuthReady()
  const user = await authRepository.findAdminUserById(authUser.id)
  if (!user) {
    const err = new Error('User not found')
    err.status = 404
    throw err
  }

  return user
}

module.exports = {
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
  ensureAuthReady,
  login,
  getProfile,
  verifyToken
}
