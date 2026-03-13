function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase()
}

function validateLoginPayload(payload = {}) {
  const username = normalizeUsername(payload.username)
  const password = String(payload.password || '')

  if (!username || !password) {
    const err = new Error('Username and password are required')
    err.status = 400
    throw err
  }

  return { username, password }
}

module.exports = {
  normalizeUsername,
  validateLoginPayload
}
