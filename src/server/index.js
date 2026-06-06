/**
 * TimeBlock 后端 API 服务 - 入口文件
 *
 * 成员D: 后端 & 账号系统开发
 * 技术栈: Node.js + Express + Sequelize + MySQL/SQLite + JWT + bcrypt
 *
 * 启动: node index.js
 * 开发: node --watch index.js
 */

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const path = require('path')

// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '.env') })

const sequelize = require('./config/database')
const routes = require('./routes')
const errorHandler = require('./middleware/errorHandler')

const app = express()
const PORT = process.env.PORT || 3000

// =============================================
// 中间件
// =============================================

// 安全头
app.use(helmet())

// CORS 跨域
app.use(cors({
  origin: [
    'http://localhost:5173',   // Vite 开发服务器
    'http://localhost:5174',
    'app://.',                 // Electron 打包后
  ],
  credentials: true
}))

// 日志
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'))
}

// 请求体解析
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// =============================================
// 路由
// =============================================

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  })
})

// API 路由
app.use('/api', routes)

// 404 处理
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `接口 ${req.method} ${req.originalUrl} 不存在`
    }
  })
})

// =============================================
// 全局错误处理
// =============================================

app.use(errorHandler)

// =============================================
// 启动服务
// =============================================

async function start() {
  try {
    // 连接数据库并同步模型
    await sequelize.authenticate()
    console.log('✅ 数据库连接成功')

    // 开发环境下自动创建表 (首次) / MySQL 下可开启 alter
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: process.env.DB_DIALECT === 'mysql' })
      console.log('✅ 数据库表已同步')
    }

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════╗
║       🕐 TimeBlock API Server 已启动        ║
╠══════════════════════════════════════════════╣
║  地址: http://localhost:${PORT}                  ║
║  环境: ${(process.env.NODE_ENV || 'development').padEnd(11)}                   ║
║  数据库: ${(process.env.DB_DIALECT || 'sqlite').padEnd(6)}                  ║
║  健康检查: /api/health                      ║
╚══════════════════════════════════════════════╝
      `)
    })
  } catch (err) {
    console.error('❌ 启动失败:', err.message)
    process.exit(1)
  }
}

start()

module.exports = app
