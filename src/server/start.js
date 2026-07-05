/**
 * TimeBlock 服务器一键启动脚本
 *
 * 功能:
 * - 环境检查 (Node.js 版本、npm)
 * - 条件初始化 (.env 文件创建、依赖安装)
 * - MySQL 数据库连接检查和表结构初始化
 * - 启动服务器
 *
 * 跨平台支持: Windows / Linux / macOS
 *
 * 使用方式:
 * - Windows: start.bat 或 node start.js
 * - Linux/Mac: ./start.sh 或 node start.js
 */

const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

// =============================================
// 配置常量
// =============================================

const MIN_NODE_VERSION = 18
const REQUIRED_DEPENDENCIES = [
  'express', 'sequelize', 'mysql2',
  'jsonwebtoken', 'bcryptjs', 'dotenv', 'cors', 'helmet'
]

const ENV_TEMPLATE = `# =============================================
# TimeBlock 后端 API 服务 - 环境变量配置
# =============================================

# 服务端口
PORT=3000

# 环境 (development / production)
NODE_ENV=development

# =============================================
# 数据库配置 (MySQL)
# =============================================
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=time_block
DB_USER=root
DB_PASSWORD=

# =============================================
# JWT 认证配置
# =============================================
JWT_SECRET=timeblock_jwt_secret_key_change_in_production_32chars
JWT_EXPIRES_IN=7d

# =============================================
# 安全配置
# =============================================
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
`

// =============================================
// 工具函数
// =============================================

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
}

function log(color, symbol, message) {
  console.log(`${COLORS[color]}${symbol} ${message}${COLORS.reset}`)
}

function logSection(title) {
  console.log('')
  console.log(`${COLORS.cyan}╔════════════════════════════════════════╗${COLORS.reset}`)
  console.log(`${COLORS.cyan}║  ${title.padEnd(36)}  ║${COLORS.reset}`)
  console.log(`${COLORS.cyan}╚════════════════════════════════════════╝${COLORS.reset}`)
}

function execCommand(cmd, options = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: options.cwd || __dirname,
      env: { ...process.env, ...options.env }
    })
  } catch (err) {
    if (options.ignoreError) return null
    throw err
  }
}

function isWindows() {
  return os.platform() === 'win32'
}

// =============================================
// 步骤 1: 环境检查
// =============================================

function checkEnvironment() {
  logSection('环境检查')

  // 检查 Node.js
  const nodeVersion = process.version.replace('v', '').split('.')[0]
  if (parseInt(nodeVersion) < MIN_NODE_VERSION) {
    log('red', '❌', `Node.js 版本过低: ${process.version}, 需要 >= ${MIN_NODE_VERSION}`)
    log('yellow', '💡', '请升级 Node.js: https://nodejs.org/')
    process.exit(1)
  }
  log('green', '✅', `Node.js 版本: ${process.version}`)

  // 检查 npm
  try {
    const npmVersion = execCommand('npm --version', { silent: true })
    log('green', '✅', `npm 版本: ${npmVersion.trim()}`)
  } catch {
    log('red', '❌', 'npm 未安装')
    process.exit(1)
  }

  // 检查操作系统
  log('blue', '💻', `操作系统: ${os.type()} ${os.release()}`)
  log('blue', '📁', `工作目录: ${__dirname}`)

  return true
}

// =============================================
// 步骤 2: 检查并初始化配置文件
// =============================================

function initConfigFiles() {
  logSection('配置文件初始化')

  const envPath = path.join(__dirname, '.env')
  const envExamplePath = path.join(__dirname, '.env.example')

  // 检查 .env 文件
  if (fs.existsSync(envPath)) {
    log('green', '✅', '.env 文件已存在')

    // 验证必要配置
    const envContent = fs.readFileSync(envPath, 'utf8')
    const requiredKeys = ['PORT', 'NODE_ENV', 'DB_DIALECT', 'JWT_SECRET']

    let missingKeys = []
    for (const key of requiredKeys) {
      if (!envContent.includes(`${key}=`)) {
        missingKeys.push(key)
      }
    }

    if (missingKeys.length > 0) {
      log('yellow', '⚠️', `缺少配置项: ${missingKeys.join(', ')}`)
      log('yellow', '💡', '建议重新生成 .env 文件')
    }
  } else {
    log('yellow', '⚠️', '.env 文件不存在')

    // 检查 .env.example
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath)
      log('green', '✅', '已从 .env.example 复制创建 .env')
    } else {
      fs.writeFileSync(envPath, ENV_TEMPLATE)
      log('green', '✅', '已创建默认 .env 文件')
    }

    log('yellow', '💡', '请根据实际情况修改 .env 配置')
  }

  return true
}

// =============================================
// 步骤 3: 检查并安装依赖
// =============================================

function installDependencies() {
  logSection('依赖检查与安装')

  const nodeModulesPath = path.join(__dirname, 'node_modules')

  // 检查 node_modules
  if (!fs.existsSync(nodeModulesPath)) {
    log('yellow', '⚠️', 'node_modules 不存在，开始安装依赖...')
    execCommand('npm install')
    log('green', '✅', '依赖安装完成')
    return true
  }

  // 检查关键依赖是否存在
  let missingDeps = []
  for (const dep of REQUIRED_DEPENDENCIES) {
    if (!fs.existsSync(path.join(nodeModulesPath, dep))) {
      missingDeps.push(dep)
    }
  }

  if (missingDeps.length > 0) {
    log('yellow', '⚠️', `缺少依赖: ${missingDeps.join(', ')}`)
    log('blue', '📦', '开始安装缺失依赖...')
    execCommand('npm install')
    log('green', '✅', '依赖安装完成')
  } else {
    log('green', '✅', '所有依赖已安装')
  }

  return true
}

// =============================================
// 步骤 4: 数据库初始化 (MySQL)
// =============================================

async function initDatabase() {
  logSection('数据库初始化')

  // 加载环境变量
  require('dotenv').config({ path: path.join(__dirname, '.env') })

  const dialect = process.env.DB_DIALECT || 'mysql'

  if (dialect !== 'mysql') {
    log('yellow', '⚠️', `配置的数据库类型为 ${dialect}, 但服务器仅支持 MySQL`)
    log('blue', 'ℹ️', '自动设置为 MySQL')
  }

  log('blue', '📊', '数据库类型: MySQL')
  log('blue', '🔗', `连接地址: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`)
  log('blue', '📁', `数据库名: ${process.env.DB_NAME || 'time_block'}`)
  log('blue', '👤', `用户名: ${process.env.DB_USER || 'root'}`)

  try {
    // 动态加载 Sequelize
    const sequelize = require('./config/database')

    // 测试连接
    log('yellow', '⏳', '正在测试数据库连接...')
    await sequelize.authenticate()
    log('green', '✅', '数据库连接成功')

    // 加载模型关联
    require('./models')

    // 同步表结构
    log('yellow', '⏳', '正在同步数据库表结构...')
    const syncOptions = process.env.NODE_ENV === 'production'
      ? {} // 生产环境: 仅创建新表
      : { alter: true } // 开发环境: 自动更新表结构

    await sequelize.sync(syncOptions)

    // 显示已创建的表
    const tables = await sequelize.getQueryInterface().showAllTables()
    log('green', '✅', `已创建 ${tables.length} 张数据表:`)

    for (const table of tables) {
      console.log(`    ${COLORS.green}- ${table}${COLORS.reset}`)
    }

    await sequelize.close()

  } catch (err) {
    log('red', '❌', `数据库连接失败: ${err.message}`)

    // 常见错误提示
    if (err.message.includes('ECONNREFUSED')) {
      log('yellow', '💡', 'MySQL 服务未启动，请检查:')
      console.log(`    ${COLORS.yellow}- 确保 MySQL 服务已启动${COLORS.reset}`)
      console.log(`    ${COLORS.yellow}- Windows: 在服务管理器中启动 MySQL${COLORS.reset}`)
      console.log(`    ${COLORS.yellow}- Linux: systemctl start mysql${COLORS.reset}`)
      console.log(`    ${COLORS.yellow}- 检查 DB_HOST 和 DB_PORT 配置${COLORS.reset}`)
    } else if (err.message.includes('Access denied')) {
      log('yellow', '💡', '数据库认证失败，请检查:')
      console.log(`    ${COLORS.yellow}- DB_USER 和 DB_PASSWORD 配置${COLORS.reset}`)
      console.log(`    ${COLORS.yellow}- MySQL 用户权限${COLORS.reset}`)
    } else if (err.message.includes('Unknown database')) {
      log('yellow', '💡', '数据库不存在，请先创建:')
      console.log(`    ${COLORS.cyan}    CREATE DATABASE ${process.env.DB_NAME || 'time_block'} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;${COLORS.reset}`)
    }

    // 询问是否继续
    log('yellow', '⚠️', '数据库初始化失败，是否继续启动服务器？(可能无法正常运行)')
    log('blue', 'ℹ️', '按 Ctrl+C 取消，或等待 5 秒后自动继续...')

    await new Promise(resolve => setTimeout(resolve, 5000))
  }

  return true
}

// =============================================
// 步骤 5: 启动服务器
// =============================================

function startServer() {
  logSection('启动服务器')

  require('dotenv').config({ path: path.join(__dirname, '.env') })

  const port = process.env.PORT || 3000
  const env = process.env.NODE_ENV || 'development'

  log('blue', '🚀', `服务端口: ${port}`)
  log('blue', '⚙️', `运行环境: ${env}`)

  // 使用 spawn 启动，保持进程存活
  const serverProcess = spawn('node', ['index.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env
  })

  serverProcess.on('error', (err) => {
    log('red', '❌', `服务器启动失败: ${err.message}`)
    process.exit(1)
  })

  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      log('red', '❌', `服务器异常退出 (code: ${code})`)
    }
    process.exit(code)
  })

  // 处理退出信号
  process.on('SIGINT', () => {
    log('yellow', '⏳', '正在停止服务器...')
    serverProcess.kill('SIGINT')
  })

  process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM')
  })

  return serverProcess
}

// =============================================
// 主流程
// =============================================

async function main() {
  console.log('')
  console.log(`${COLORS.cyan}╔══════════════════════════════════════════════╗${COLORS.reset}`)
  console.log(`${COLORS.cyan}║     🕐 TimeBlock 服务器一键启动脚本          ║${COLORS.reset}`)
  console.log(`${COLORS.cyan}║     跨平台支持: Windows / Linux / macOS     ║${COLORS.reset}`)
  console.log(`${COLORS.cyan}╚══════════════════════════════════════════════╝${COLORS.reset}`)
  console.log('')

  const startTime = Date.now()

  try {
    // 1. 环境检查
    checkEnvironment()

    // 2. 配置文件初始化
    initConfigFiles()

    // 3. 依赖安装
    installDependencies()

    // 4. 数据库初始化
    await initDatabase()

    // 5. 启动服务器
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log('')
    log('green', '✅', `初始化完成，耗时 ${elapsed} 秒`)
    console.log('')

    startServer()

  } catch (err) {
    log('red', '❌', `启动失败: ${err.message}`)
    console.log('')
    console.log(err.stack)
    process.exit(1)
  }
}

// 执行主流程
main()