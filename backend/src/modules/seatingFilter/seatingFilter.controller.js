const seatingFilterService = require('./seatingFilter.service')

async function saveSeatingFilter(req, res, next) {
  try {
    const { yearFilter, examType, examDate, sessionName } = req.body || {}
    const data = await seatingFilterService.saveSeatingFilter({ yearFilter, examType, examDate, sessionName })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
}

async function getLatestSeatingFilter(req, res, next) {
  try {
    const data = await seatingFilterService.getLatestSeatingFilter()
    if (!data) {
      res.status(404).json({ error: 'No seating filter found' })
      return
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  saveSeatingFilter,
  getLatestSeatingFilter
}
