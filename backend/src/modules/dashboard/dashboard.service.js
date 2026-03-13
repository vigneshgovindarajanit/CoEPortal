const dashboardRepository = require('./dashboard.repository')

async function getDashboardOverview() {
  return dashboardRepository.getDashboardOverview()
}

module.exports = {
  getDashboardOverview
}
