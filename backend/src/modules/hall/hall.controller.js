const hallService = require('./hall.service')

async function listHalls(req, res, next) {
  try {
    const halls = await hallService.getHalls(req.query.search)
    res.json(halls)
  } catch (err) {
    next(err)
  }
}

async function getHallStats(req, res, next) {
  try {
    const stats = await hallService.getHallStats()
    res.json(stats)
  } catch (err) {
    next(err)
  }
}

async function createHall(req, res, next) {
  try {
    const hall = await hallService.createHall(req.body)
    res.status(201).json(hall)
  } catch (err) {
    next(err)
  }
}

async function updateHall(req, res, next) {
  try {
    const hall = await hallService.updateHall(req.params.id, req.body)
    res.json(hall)
  } catch (err) {
    next(err)
  }
}

async function updateHallStatus(req, res, next) {
  try {
    const hall = await hallService.setHallStatus(req.params.id, req.body.isActive)
    res.json(hall)
  } catch (err) {
    next(err)
  }
}

async function deleteHall(req, res, next) {
  try {
    await hallService.removeHall(req.params.id)
    res.status(200).json({ deleted: true })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listHalls,
  getHallStats,
  createHall,
  updateHall,
  updateHallStatus,
  deleteHall
}
