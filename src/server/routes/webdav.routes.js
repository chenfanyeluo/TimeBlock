const { Router } = require('express')
const { body } = require('express-validator')
const { authenticate } = require('../middleware/auth')
const validate = require('../middleware/validate')
const webdavController = require('../controllers/webdav.controller')

const router = Router()

// GET /api/webdav/config
router.get('/config', authenticate, webdavController.getConfig)

// POST /api/webdav/config
router.post('/config', authenticate, [
  body('serverUrl').isURL().withMessage('服务器地址格式不正确'),
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空'),
  body('syncInterval').optional().isInt({ min: 1 }).withMessage('同步间隔至少1分钟'),
  validate
], webdavController.saveConfig)

// POST /api/webdav/test
router.post('/test', authenticate, webdavController.testConnection)

// GET /api/webdav/sync-history (必须在 /sync/:syncId 之前)
router.get('/sync-history', authenticate, webdavController.getSyncHistory)

// POST /api/webdav/sync
router.post('/sync', authenticate, webdavController.triggerSync)

// GET /api/webdav/sync/:syncId
router.get('/sync/:syncId', authenticate, webdavController.getSyncStatus)

module.exports = router
