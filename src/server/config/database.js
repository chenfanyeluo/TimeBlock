/**
 * 数据库配置
 *
 * 双数据库架构: MySQL (云端生产) + SQLite (本地开发)
 * 生产环境必须使用 MySQL 8.0
 */
const { Sequelize } = require('sequelize')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

// 默认使用 MySQL (生产标准)，开发环境可用 SQLite
const dialect = process.env.DB_DIALECT || 'mysql'

const commonDefine = {
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
}

let sequelize

if (dialect === 'sqlite') {
  const dbDir = path.join(__dirname, '..', 'data')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || path.join(dbDir, 'timeblock.db'),
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: commonDefine
  })
} else {
  // MySQL (默认)
  sequelize = new Sequelize(
    process.env.DB_NAME || 'time_block',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      dialect: 'mysql',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      define: commonDefine,
      // MySQL 字符集设置
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    }
  )
}

module.exports = sequelize
