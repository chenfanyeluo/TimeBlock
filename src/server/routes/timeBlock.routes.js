const { Router } = require('express')
const { body } = require('express-validator')
const { authenticate } = require('../middleware/auth')
const validate = require('../middleware/validate')
const timeBlockController = require('../controllers/timeBlock.controller')

const router = Router()

// GET /api/time-blocks/search (必须放在 /:id 之前)
router.get('/search', authenticate, timeBlockController.search)

// GET /api/time-blocks
router.get('/', authenticate, timeBlockController.list)

// POST /api/time-blocks
router.post('/', authenticate, [
  body('title').notEmpty().withMessage('时间块标题不能为空'),
  body('startTime').isISO8601().withMessage('开始时间格式不正确'),
  body('endTime').isISO8601().withMessage('结束时间格式不正确'),
  validate
], timeBlockController.create)

// PUT /api/time-blocks/:id
router.put('/:id', authenticate, [
  body('title').optional().notEmpty().withMessage('时间块标题不能为空'),
  validate
], timeBlockController.update)

// DELETE /api/time-blocks/:id
router.delete('/:id', authenticate, timeBlockController.remove)

module.exports = router
