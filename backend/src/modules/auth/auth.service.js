const crypto = require('crypto')
const authRepository = require('./auth.repository')
const { normalizeUsername, validateLoginPayload } = require('./auth.model')

const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const JWT_SECRET = process.env.JWT_SECRET || 'coeportal-dev-secret'
const JWT_EXPIRES_IN_SECONDS = Number(process.env.JWT_EXPIRES_IN_SECONDS || 60 * 60 * 12)

let authReadyPromise

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64').toString('utf8')
}

function signHmac(value) {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(value)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

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

function createToken(user) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    sub: String(user.id),
    username: user.username,
    role: user.role,
    iat: now,
    exp: now + JWT_EXPIRES_IN_SECONDS
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signHmac(`${encodedHeader}.${encodedPayload}`)
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

function verifyToken(token) {
  const [encodedHeader, encodedPayload, signature] = String(token || '').split('.')
  if (!encodedHeader || !encodedPayload || !signature) {
    const err = new Error('Invalid token')
    err.status = 401
    throw err
  }

  const expectedSignature = signHmac(`${encodedHeader}.${encodedPayload}`)
  if (signature.length !== expectedSignature.length) {
    const err = new Error('Invalid token signature')
    err.status = 401
    throw err
  }

  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  if (!isValid) {
    const err = new Error('Invalid token signature')
    err.status = 401
    throw err
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload))
  const now = Math.floor(Date.now() / 1000)
  if (!payload.exp || payload.exp < now) {
    const err = new Error('Token expired')
    err.status = 401
    throw err
  }

  return payload
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
