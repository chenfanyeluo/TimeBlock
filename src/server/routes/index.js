const { Router } = require('express')

const authRoutes = require('./auth.routes')
const userRoutes = require('./user.routes')
const noteRoutes = require('./note.routes')
const timeBlockRoutes = require('./timeBlock.routes')
const reminderRoutes = require('./reminder.routes')
const statisticsRoutes = require('./statistics.routes')
const syncRoutes = require('./sync.routes')
const exportRoutes = require('./export.routes')

const router = Router()

// 注册所有路由
router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/notes', noteRoutes)
router.use('/time-blocks', timeBlockRoutes)
router.use('/reminders', reminderRoutes)
router.use('/statistics', statisticsRoutes)
router.use('/sync', syncRoutes)
router.use('/export', exportRoutes)
router.use('/', exportRoutes) // /api/import 也在这里

module.exports = router
