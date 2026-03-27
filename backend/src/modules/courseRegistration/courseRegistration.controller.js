const service = require('./courseRegistration.service')

async function getRegistrations(req, res, next) {
  try {
    const { search = '', department = '', semester = '', limit = 200, offset = 0 } = req.query
    const items = await service.listRegistrations({
      search: String(search).trim() || undefined,
      department: String(department).trim() || undefined,
      semester: String(semester).trim() || undefined,
      limit: Number(limit) || 200,
      offset: Number(offset) || 0
    })
    res.json({ items })
  } catch (err) {
    err.message = err.message || 'Failed to load course registrations'
    next(err)
  }
}

module.exports = { getRegistrations }
