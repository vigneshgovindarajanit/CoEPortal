const repository = require('./courseRegistration.repository')

async function listRegistrations(params = {}) {
  return repository.listRegistrations(params)
}

module.exports = { listRegistrations }
