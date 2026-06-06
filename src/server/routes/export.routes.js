const { Router } = require('express')
const { authenticate } = require('../middleware/auth')
const exportController = require('../controllers/export.controller')

const router = Router()

// GET /api/export
router.get('/', authenticate, exportController.exportData)

// POST /api/import
router.post('/import', authenticate, exportController.importData)

module.exports = router
