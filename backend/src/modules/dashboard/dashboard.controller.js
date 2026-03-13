const dashboardService = require('./dashboard.service')

async function getOverview(req, res, next) {
  try {
    const data = await dashboardService.getDashboardOverview()
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getOverview
}
