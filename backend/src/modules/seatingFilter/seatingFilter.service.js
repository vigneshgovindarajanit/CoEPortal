const seatingFilterRepository = require('./seatingFilter.repository')

async function saveSeatingFilter(payload) {
  const id = await seatingFilterRepository.saveSeatingFilter(payload)
  return { id, ...payload }
}

async function getLatestSeatingFilter() {
  return seatingFilterRepository.getLatestSeatingFilter()
}

module.exports = {
  saveSeatingFilter,
  getLatestSeatingFilter
}
