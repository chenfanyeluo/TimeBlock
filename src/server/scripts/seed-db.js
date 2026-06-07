/**
 * 数据库种子数据脚本
 * 用法: node scripts/seed-db.js
 *
 * 创建默认分类和测试数据
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const sequelize = require('../config/database')
const { User, Category, TimeBlock } = require('../models')
const bcrypt = require('bcryptjs')

async function seed() {
  try {
    await sequelize.authenticate()
    await sequelize.sync()

    // 检查是否已有数据
    const userCount = await User.count()
    if (userCount > 0) {
      console.log(`已有 ${userCount} 个用户，跳过种子数据`)
      await sequelize.close()
      return
    }

    // 创建测试用户
    const password = await bcrypt.hash('123456', 10)
    const user = await User.create({
      email: 'demo@timeblock.com',
      password,
      name: '演示用户'
    })
    console.log(`✅ 创建测试用户: demo@timeblock.com / 123456`)

    // 默认分类
    const defaultCategories = [
      { name: '工作', color: '#1890ff', icon: 'briefcase', sort_order: 1 },
      { name: '学习', color: '#52c41a', icon: 'book', sort_order: 2 },
      { name: '生活', color: '#faad14', icon: 'home', sort_order: 3 },
      { name: '休息', color: '#f5222d', icon: 'coffee', sort_order: 4 },
      { name: '运动', color: '#9254de', icon: 'run', sort_order: 5 }
    ]

    const categories = []
    for (const cat of defaultCategories) {
      const c = await Category.create({
        user_id: user.id,
        ...cat
      })
      categories.push(c)
    }
    console.log(`✅ 创建 ${categories.length} 个默认分类`)

    // 示例时间块
    const today = new Date().toISOString().split('T')[0]
    const demoBlocks = [
      { title: '晨间规划', categoryId: categories[0].id, start: '07:00', end: '07:30' },
      { title: '深度开发', categoryId: categories[0].id, start: '08:00', end: '11:00' },
      { title: '学习新技术', categoryId: categories[1].id, start: '11:00', end: '12:00' },
      { title: '午饭休息', categoryId: categories[3].id, start: '12:00', end: '13:30' },
      { title: '代码审查', categoryId: categories[0].id, start: '14:00', end: '16:00' },
      { title: '运动健身', categoryId: categories[4].id, start: '17:00', end: '18:00' },
      { title: '家庭晚餐', categoryId: categories[2].id, start: '19:00', end: '20:00' }
    ]

    for (const block of demoBlocks) {
      await TimeBlock.create({
        user_id: user.id,
        category_id: block.categoryId,
        title: block.title,
        start_time: new Date(`${today}T${block.start}:00`),
        end_time: new Date(`${today}T${block.end}:00`),
        is_completed: true
      })
    }
    console.log(`✅ 创建 ${demoBlocks.length} 个示例时间块`)

    await sequelize.close()
    console.log('\n种子数据创建完成')

  } catch (err) {
    console.error('❌ 种子数据创建失败:', err.message)
    process.exit(1)
  }
}

seed()
