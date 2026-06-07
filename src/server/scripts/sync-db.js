/**
 * 数据库初始化脚本
 * 用法: node scripts/sync-db.js
 *
 * 开发环境: 自动创建/更新表
 * 生产环境: 仅创建不存在的表 (不修改已有结构)
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const sequelize = require('../config/database')
// 加载所有模型以注册关联
require('../models')

async function initDB() {
  try {
    console.log(`数据库类型: ${process.env.DB_DIALECT || 'mysql'}`)
    console.log(`环境: ${process.env.NODE_ENV || 'development'}`)

    // 测试连接
    await sequelize.authenticate()
    console.log('✅ 数据库连接成功')

    // 同步表结构
    if (process.env.NODE_ENV === 'production') {
      await sequelize.sync() // 只创建新表，不修改已有表
      console.log('✅ 生产模式: 数据库表已同步 (仅新增)')
    } else {
      await sequelize.sync({ alter: process.env.DB_DIALECT === 'mysql' })
      console.log('✅ 开发模式: 数据库表已同步')
    }

    console.log('\n已创建的表:')
    const tables = await sequelize.getQueryInterface().showAllTables()
    tables.forEach(t => console.log(`  - ${t}`))

    await sequelize.close()
    console.log('\n数据库初始化完成')

  } catch (err) {
    console.error('❌ 数据库初始化失败:', err.message)
    process.exit(1)
  }
}

initDB()
