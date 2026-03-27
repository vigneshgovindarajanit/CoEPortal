const crypto = require('crypto')
const jwtConfig = require('../config/jwt')

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
    .createHmac('sha256', jwtConfig.secret)
    .update(value)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function createToken(user) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    sub: String(user.id),
    username: user.username,
    role: user.role,
    iat: now,
    exp: now + jwtConfig.expiresInSeconds
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

module.exports = {
  createToken,
  verifyToken
}
