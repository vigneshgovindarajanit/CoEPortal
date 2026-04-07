const allocationService = require('./allocation.service')

async function generateAllocation(req, res, next) {
  try {
    const data = await allocationService.generateAllocation(req.body || {})
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function getLatestAllocation(req, res, next) {
  try {
    const data = await allocationService.getLatestAllocation({
      examType: req.query.examType
    })
    if (!data) {
      res.status(404).json({ error: 'No seating allocation found' })
      return
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
}

async function assignFaculty(req, res, next) {
  try {
    const data = await allocationService.assignFacultyToAllocation(req.params.id)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  generateAllocation,
  getLatestAllocation,
  assignFaculty
}
