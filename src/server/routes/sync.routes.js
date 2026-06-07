const { Router } = require('express')
const { authenticate } = require('../middleware/auth')
const syncController = require('../controllers/sync.controller')

const router = Router()

// POST /api/sync/upload - 客户端上传变更
router.post('/upload', authenticate, syncController.upload)

// GET /api/sync/download - 客户端下载变更
router.get('/download', authenticate, syncController.download)

// GET /api/sync/status - 同步状态
router.get('/status', authenticate, syncController.status)

// GET /api/sync/logs - 同步记录
router.get('/logs', authenticate, syncController.logs)

// POST /api/sync/statistics/refresh - 刷新统计
router.post('/statistics/refresh', authenticate, syncController.refreshStatistics)

module.exports = router
