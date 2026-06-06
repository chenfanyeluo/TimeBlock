const { Router } = require('express')

const authRoutes = require('./auth.routes')
const userRoutes = require('./user.routes')
const categoryRoutes = require('./category.routes')
const timeBlockRoutes = require('./timeBlock.routes')
const statisticsRoutes = require('./statistics.routes')
const webdavRoutes = require('./webdav.routes')
const exportRoutes = require('./export.routes')

const router = Router()

// 注册所有路由
router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/categories', categoryRoutes)
router.use('/time-blocks', timeBlockRoutes)
router.use('/statistics', statisticsRoutes)
router.use('/webdav', webdavRoutes)
router.use('/export', exportRoutes)
router.use('/', exportRoutes) // /api/import 也在这里

module.exports = router
