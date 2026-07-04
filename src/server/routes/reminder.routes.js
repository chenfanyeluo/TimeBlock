const { Router } = require('express')
const { authenticate } = require('../middleware/auth')
const reminderController = require('../controllers/reminder.controller')

const router = Router()

// GET /api/reminders/due/pending 必须在 /:id 之前注册，避免被解析为 id
router.get('/due/pending', authenticate, reminderController.due)

router.get('/', authenticate, reminderController.list)
router.post('/', authenticate, reminderController.create)
router.get('/:id', authenticate, reminderController.getOne)
router.put('/:id', authenticate, reminderController.update)
router.delete('/:id', authenticate, reminderController.remove)
router.post('/:id/dismiss', authenticate, reminderController.dismiss)
router.post('/:id/trigger', authenticate, reminderController.trigger)
router.post('/:id/cancel', authenticate, reminderController.cancel)

module.exports = router
