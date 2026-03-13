function isMobileRequest(req) {
  const mobileQuery = String(req.query?.mobile || '').toLowerCase()
  if (mobileQuery === '1' || mobileQuery === 'true' || mobileQuery === 'yes') {
    return true
  }

  const platformHeader = String(req.headers['x-client-platform'] || '').toLowerCase()
  const clientHeader = String(req.headers['x-client'] || '').toLowerCase()

  return platformHeader === 'mobile' || clientHeader === 'mobile'
}

function withMobileEnvelope(req, payload, options = {}) {
  if (!isMobileRequest(req)) {
    return payload
  }

  const message = options.message || 'OK'
  const meta = options.meta || {}

  return {
    success: true,
    message,
    data: payload,
    meta
  }
}

function withMobileError(req, status, message, details = null) {
  if (!isMobileRequest(req)) {
    return { error: message }
  }

  return {
    success: false,
    message,
    error: {
      code: status,
      details
    }
  }
}

module.exports = {
  isMobileRequest,
  withMobileEnvelope,
  withMobileError
}

