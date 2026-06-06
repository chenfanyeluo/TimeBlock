const { v4: uuidv4 } = require('uuid')
const { WebdavConfig, SyncHistory } = require('../models')
const { success, error } = require('../utils/response')
const crypto = require('crypto')

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'timeblock-aes-256-encryption-key-32ch'
const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16

/**
 * AES-256 加密
 */
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

/**
 * AES-256 解密
 */
function decrypt(text) {
  const parts = text.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * 过滤返回给客户端的 WebDAV 配置
 */
function sanitizeConfig(config) {
  if (!config) return null
  return {
    id: config.id,
    serverUrl: config.server_url,
    username: config.username,
    lastSyncAt: config.last_sync_at,
    syncInterval: config.sync_interval,
    createdAt: config.created_at,
    updatedAt: config.updated_at
  }
}

/**
 * GET /api/webdav/config
 * 获取 WebDAV 配置
 */
async function getConfig(req, res, next) {
  try {
    const config = await WebdavConfig.findOne({
      where: { user_id: req.user.id }
    })

    if (!config) {
      return error(res, 'NOT_FOUND', '尚未配置 WebDAV', 404)
    }

    return success(res, sanitizeConfig(config))

  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/webdav/config
 * 配置/更新 WebDAV
 */
async function saveConfig(req, res, next) {
  try {
    const { serverUrl, username, password, syncInterval } = req.body

    // 加密存储密码
    const encryptedPassword = encrypt(password)

    const [config, created] = await WebdavConfig.findOrCreate({
      where: { user_id: req.user.id },
      defaults: {
        user_id: req.user.id,
        server_url: serverUrl,
        username,
        password: encryptedPassword,
        sync_interval: syncInterval || 30
      }
    })

    if (!created) {
      await config.update({
        server_url: serverUrl,
        username,
        password: encryptedPassword,
        sync_interval: syncInterval || 30
      })
    }

    return success(res, sanitizeConfig(config), created ? 'WebDAV 配置成功' : 'WebDAV 配置已更新')

  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/webdav/test
 * 测试 WebDAV 连接
 */
async function testConnection(req, res, next) {
  try {
    const config = await WebdavConfig.findOne({
      where: { user_id: req.user.id }
    })

    if (!config) {
      return error(res, 'NOT_FOUND', '尚未配置 WebDAV', 404)
    }

    // 尝试连接测试 (这里做基础模拟，实际应用中使用 webdav 库测试)
    const decryptedPassword = decrypt(config.password)

    // TODO: 实际集成 webdav 库测试连接
    // const client = createWebDAVClient(config.server_url, {
    //   username: config.username,
    //   password: decryptedPassword
    // })
    // await client.getDirectoryContents('/')

    console.log(`[WebDAV] 测试连接到: ${config.server_url} (用户: ${config.username})`)

    return success(res, {
      connected: true,
      serverUrl: config.server_url,
      username: config.username
    }, 'WebDAV 连接测试成功（模拟）')

  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/webdav/sync
 * 手动触发同步
 */
async function triggerSync(req, res, next) {
  try {
    const config = await WebdavConfig.findOne({
      where: { user_id: req.user.id }
    })

    if (!config) {
      return error(res, 'NOT_FOUND', '尚未配置 WebDAV，请先配置后再同步', 404)
    }

    const syncId = 'sync-' + uuidv4().slice(0, 12)

    // 创建同步记录
    const syncRecord = await SyncHistory.create({
      user_id: req.user.id,
      sync_id: syncId,
      status: 'in_progress',
      started_at: new Date(),
      uploaded: 0,
      downloaded: 0,
      conflicts: 0
    })

    // TODO: 实际同步逻辑
    // 1. 下载云端数据
    // 2. 对比本地变更
    // 3. 上传本地变更
    // 4. 解决冲突
    // 5. 更新同步状态

    // 模拟同步完成
    await syncRecord.update({
      status: 'completed',
      completed_at: new Date()
    })

    // 更新最后同步时间
    await config.update({ last_sync_at: new Date() })

    return success(res, {
      syncId,
      status: 'completed',
      startedAt: syncRecord.started_at
    })

  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/webdav/sync/:syncId
 * 获取同步状态
 */
async function getSyncStatus(req, res, next) {
  try {
    const { syncId } = req.params

    const record = await SyncHistory.findOne({
      where: { sync_id: syncId, user_id: req.user.id }
    })

    if (!record) {
      return error(res, 'NOT_FOUND', '同步记录不存在', 404)
    }

    return success(res, {
      syncId: record.sync_id,
      status: record.status,
      startedAt: record.started_at,
      completedAt: record.completed_at,
      uploaded: record.uploaded,
      downloaded: record.downloaded,
      conflicts: record.conflicts,
      errorMessage: record.error_message
    })

  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/webdav/sync-history
 * 获取同步历史
 */
async function getSyncHistory(req, res, next) {
  try {
    const { page = 1, pageSize = 20 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const limit = parseInt(pageSize)

    const { count, rows } = await SyncHistory.findAndCountAll({
      where: { user_id: req.user.id },
      order: [['started_at', 'DESC']],
      offset,
      limit
    })

    const items = rows.map(r => ({
      syncId: r.sync_id,
      status: r.status,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      uploaded: r.uploaded,
      downloaded: r.downloaded,
      conflicts: r.conflicts,
      errorMessage: r.error_message
    }))

    return res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: count,
          totalPages: Math.ceil(count / parseInt(pageSize))
        }
      }
    })

  } catch (err) {
    next(err)
  }
}

module.exports = {
  getConfig, saveConfig,
  testConnection,
  triggerSync, getSyncStatus, getSyncHistory
}
