const { Router } = require('express')
const { authenticate } = require('../middleware/auth')
const statisticsController = require('../controllers/statistics.controller')

const router = Router()

// GET /api/statistics/daily
router.get('/daily', authenticate, statisticsController.daily)

// GET /api/statistics/weekly
router.get('/weekly', authenticate, statisticsController.weekly)

// GET /api/statistics/monthly
router.get('/monthly', authenticate, statisticsController.monthly)

module.exports = router
