const { app, BrowserWindow, ipcMain, Notification } = require('electron')
const path = require('path')
const fs = require('fs')
const sqlite = require('../shared/sqlite')

/** @type {BrowserWindow|null} */
let mainWindow = null

/** 默认用户 ID（本地单用户模式） */
const DEFAULT_USER_ID = 1

/** Windows 通知中心应用 ID */
if (process.platform === 'win32') {
  app.setAppUserModelId('app.timeblock.desktop')
}

/**
 * 创建浏览器窗口
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset'
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'))
  }
}

/**
 * 初始化数据库和默认数据
 */
async function initDatabase() {
  try {
    let dbPath
    let appPath
    
    if (app.isPackaged) {
      // 生产环境（打包后）：使用应用可执行文件所在目录
      // Windows: 应用exe所在目录\data\timeblock_local.db
      // macOS: /Applications/TimeBlock.app/Contents/MacOS/data/
      // Linux: /opt/TimeBlock/data/
      // ⚠️ 不能使用 app.getAppPath()，因为它返回 asar 归档路径，无法写入
      appPath = path.dirname(app.getPath('exe'))
    } else {
      // 开发环境：使用项目根目录（与生产环境保持一致，数据库放在应用目录下）
      appPath = path.join(__dirname, '..', '..')
    }
    
    const dataDir = path.join(appPath, 'data')
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    dbPath = path.join(dataDir, 'timeblock_local.db')
    console.log('[Main] 数据库路径:', dbPath, '(', app.isPackaged ? '生产环境' : '开发环境', ')')
    
    // 初始化 SQLite 数据库
    await sqlite.init({ dbPath })
    console.log('[Main] SQLite 数据库初始化成功')

    // 确保默认用户存在
    const defaultUser = sqlite.user.findById(DEFAULT_USER_ID)
    if (!defaultUser) {
      sqlite.user.create({
        email: 'local@timeblock.app',
        password: 'local_no_auth',
        name: '本地用户'
      })
      console.log('[Main] 创建默认本地用户')
    }

    // 确保默认便签存在
    const existingNotes = sqlite.note.findByUserId(DEFAULT_USER_ID)
    if (existingNotes.length === 0) {
      const defaultNotes = [
        { user_id: DEFAULT_USER_ID, name: '工作', color: '#409eff' },
        { user_id: DEFAULT_USER_ID, name: '学习', color: '#67c23a' },
        { user_id: DEFAULT_USER_ID, name: '休息', color: '#e6a23c' },
        { user_id: DEFAULT_USER_ID, name: '运动', color: '#f56c6c' },
        { user_id: DEFAULT_USER_ID, name: '生活', color: '#9254de' },
        { user_id: DEFAULT_USER_ID, name: '其他', color: '#909399' }
      ]
      for (const note of defaultNotes) {
        sqlite.note.create(note)
      }
      console.log('[Main] 创建默认便签')
    }

  } catch (err) {
    console.error('[Main] 数据库初始化失败:', err.message)
    throw err
  }
}

/**
 * 注册 IPC 处理程序
 */
function registerIPCHandlers() {
  // =============================================
  // 时间块操作
  // =============================================

  /** 获取指定日期的时间块 */
  ipcMain.handle('timeBlock:getByDate', async (_event, date, userId) => {
    try {
      const uid = userId || DEFAULT_USER_ID
      const blocks = sqlite.timeBlock.findByDate(uid, date)
      return { success: true, data: blocks }
    } catch (err) {
      console.error('[IPC] timeBlock:getByDate 失败:', err.message)
      return { success: false, error: err.message }
    }
  })

  /** 获取周视图时间块 */
  ipcMain.handle('timeBlock:getByWeek', async (_event, startDate, endDate, userId) => {
    try {
      const uid = userId || DEFAULT_USER_ID
      const blocks = sqlite.timeBlock.findByWeek(uid, startDate, endDate)
      return { success: true, data: blocks }
    } catch (err) {
      console.error('[IPC] timeBlock:getByWeek 失败:', err.message)
      return { success: false, error: err.message }
    }
  })

  /** 获取月视图时间块 */
  ipcMain.handle('timeBlock:getByMonth', async (_event, year, month, userId) => {
    try {
      const uid = userId || DEFAULT_USER_ID
      const blocks = sqlite.timeBlock.findByMonth(uid, year, month)
      return { success: true, data: blocks }
    } catch (err) {
      console.error('[IPC] timeBlock:getByMonth 失败:', err.message)
      return { success: false, error: err.message }
    }
  })

  /** 创建时间块 */
  ipcMain.handle('timeBlock:create', async (_event, data) => {
    try {
      const block = sqlite.timeBlock.create({
        user_id: data.userId || DEFAULT_USER_ID,
        note_id: data.note_id || null,
        title: data.title,
        description: data.description || null,
        start_time: data.start_time,
        end_time: data.end_time,
        is_completed: data.is_completed || false
      })
      return { success: true, data: block }
    } catch (err) {
      console.error('[IPC] timeBlock:create 失败:', err.message)
      return { success: false, error: err.message }
    }
  })

  /** 更新时间块 */
  ipcMain.handle('timeBlock:update', async (_event, id, data) => {
    try {
      const block = sqlite.timeBlock.update(id, data)
      return { success: true, data: block }
    } catch (err) {
      console.error('[IPC] timeBlock:update 失败:', err.message)
      return { success: false, error: err.message }
    }
  })

  /** 删除时间块（软删除） */
  ipcMain.handle('timeBlock:delete', async (_event, id) => {
    try {
      const result = sqlite.timeBlock.softDelete(id)
      return { success: result }
    } catch (err) {
      console.error('[IPC] timeBlock:delete 失败:', err.message)
      return { success: false, error: err.message }
    }
  })

  // =============================================
  // 便签操作
  // =============================================

  /** 获取所有便签 */
  ipcMain.handle('note:getAll', async (_event, userId) => {
    try {
      const uid = userId || DEFAULT_USER_ID
      const notes = sqlite.note.findByUserId(uid)
      return { success: true, data: notes }
    } catch (err) {
      console.error('[IPC] note:getAll 失败:', err.message)
      return { success: false, error: err.message }
    }
  })

  /** 根据 ID 获取便签 */
  ipcMain.handle('note:getById', async (_event, id) => {
    try {
      const note = sqlite.note.findById(id)
      return { success: true, data: note }
    } catch (err) {
      console.error('[IPC] note:getById 失败:', err.message)
      return { success: false, error: err.message }
    }
  })

  /** 创建便签 */
  ipcMain.handle('note:create', async (_event, data) => {
    try {
      const note = sqlite.note.create({
        user_id: data.userId || DEFAULT_USER_ID,
        name: data.name,
        color: data.color || '#409eff',
        auto_remind: data.auto_remind !== undefined ? data.auto_remind : 0,
        default_advance_minutes: data.default_advance_minutes !== undefined ? data.default_advance_minutes : 5
      })
      return { success: true, data: note }
    } catch (err) {
      console.error('[IPC] note:create 失败:', err.message)
      return { success: false, error: err.message }
    }
  })

  /** 更新便签 */
  ipcMain.handle('note:update', async (_event, id, data) => {
    try {
      const note = sqlite.note.update(id, data)
      return { success: true, data: note }
    } catch (err) {
      console.error('[IPC] note:update 失败:', err.message)
      return { success: false, error: err.message }
    }
  })

  /** 删除便签 */
  ipcMain.handle('note:delete', async (_event, id) => {
    try {
      const result = sqlite.note.delete(id)
      return result
    } catch (err) {
      console.error('[IPC] note:delete 失败:', err.message)
      return { success: false, error: err.message }
    }
  })

  // =============================================
  // 通用数据库操作（保留原有 API）
  // =============================================

  ipcMain.handle('db:query', async (_event, sql, params) => {
    try {
      const result = sqlite.all(sql, params)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('db:insert', async (_event, sql, params) => {
    try {
      const result = sqlite.exec(sql, params)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('db:update', async (_event, sql, params) => {
    try {
      const result = sqlite.exec(sql, params)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('db:delete', async (_event, sql, params) => {
    try {
      const result = sqlite.exec(sql, params)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // =============================================
  // 系统通知（Electron 原生通知）
  // =============================================

  // =============================================
  // 同步操作
  // =============================================

  /** 手动触发同步 */
  ipcMain.handle('sync:start', async () => {
    try {
      return { success: true, message: '同步功能需连接后端服务' }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  /** 同步状态监听 — 暂不支持推送，返回默认状态 */
  ipcMain.handle('sync:status', async () => {
    return { success: true, data: { status: 'idle', lastSync: null } }
  })

  // =============================================
  // 认证操作
  // =============================================

  /** 用户登录（本地模式） */
  ipcMain.handle('auth:login', async (_event, credentials) => {
    try {
      if (!credentials || !credentials.email) {
        return { success: false, error: '邮箱不能为空' }
      }
      const user = sqlite.user.findByEmail(credentials.email)
      if (!user) {
        return { success: false, error: '用户不存在' }
      }
      return {
        success: true,
        data: {
          user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
          accessToken: 'local-token'
        }
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  /** 用户登出 */
  ipcMain.handle('auth:logout', async () => {
    return { success: true }
  })

  /** 获取当前用户信息 */
  ipcMain.handle('auth:getUser', async () => {
    try {
      const user = sqlite.user.findById(DEFAULT_USER_ID)
      if (!user) {
        return { success: false, error: '用户不存在' }
      }
      return {
        success: true,
        data: { id: user.id, email: user.email, name: user.name, avatar: user.avatar }
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // =============================================
  // 系统通知（Electron 原生通知）
  // =============================================

  /** 显示原生系统通知 */
  ipcMain.handle('notification:show', async (_event, { title, body, icon }) => {
    try {
      if (!Notification.isSupported()) {
        return { success: false, error: '当前系统不支持通知' }
      }

      // 解析图标绝对路径（若提供相对路径）
      let iconPath = icon
      if (iconPath && !path.isAbsolute(iconPath)) {
        const basePath = app.isPackaged
          ? path.dirname(app.getPath('exe'))
          : path.join(__dirname, '..', '..')
        iconPath = path.join(basePath, iconPath.replace(/^\//, ''))
        if (!fs.existsSync(iconPath)) {
          iconPath = undefined
        }
      } else if (iconPath && !fs.existsSync(iconPath)) {
        iconPath = undefined
      }

      const notificationOptions = {
        title: title || 'TimeBlock',
        body: body || '',
        icon: iconPath
      }
      // timeoutType 仅在 Windows 上受支持，用于让通知长期显示
      if (process.platform === 'win32') {
        notificationOptions.timeoutType = 'never'
      }

      const notification = new Notification(notificationOptions)

      notification.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
          mainWindow.focus()
        }
      })

      notification.show()
      return { success: true }
    } catch (err) {
      console.error('[IPC] notification:show 失败:', err.message)
      return { success: false, error: err.message }
    }
  })
}

// 应用启动
app.whenReady().then(async () => {
  try {
    // 先初始化数据库
    await initDatabase()

    // 注册 IPC 处理程序
    registerIPCHandlers()

    // 创建窗口
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  } catch (err) {
    console.error('[Main] 应用启动失败:', err)
    app.quit()
  }
})

// 关闭时保存数据库
app.on('window-all-closed', () => {
  try {
    sqlite.save()
    sqlite.close()
    console.log('[Main] 数据库已关闭')
  } catch (err) {
    console.error('[Main] 数据库关闭失败:', err)
  }

  if (process.platform !== 'darwin') app.quit()
})

// 安全退出
app.on('before-quit', () => {
  try {
    sqlite.save()
  } catch (err) {
    console.error('[Main] 数据库保存失败:', err)
  }
})