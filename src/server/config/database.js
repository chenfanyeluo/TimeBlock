const { Sequelize } = require('sequelize')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const dialect = process.env.DB_DIALECT || 'sqlite'

let sequelize

if (dialect === 'mysql') {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'time_block',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || 'root',
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
      define: {
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
      }
    }
  )
} else {
  const dbDir = path.join(__dirname, '..', 'data')
  const fs = require('fs')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || path.join(dbDir, 'timeblock.db'),
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  })
}

module.exports = sequelize
