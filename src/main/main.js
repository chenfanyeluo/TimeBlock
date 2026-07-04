const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const sqlite = require('../shared/sqlite')

/** @type {BrowserWindow|null} */
let mainWindow = null

/** 默认用户 ID（本地单用户模式） */
const DEFAULT_USER_ID = 1

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
    // 根据打包状态选择数据库路径
    let dbPath
    
    if (app.isPackaged) {
      // 生产环境（打包后）：使用应用目录，随应用卸载删除
      // Windows: 应用exe所在目录\data\timeblock_local.db
      // macOS: /Applications/TimeBlock.app/Contents/Resources/data/
      // Linux: /opt/TimeBlock/data/
      const appPath = app.getAppPath()
      const dataDir = path.join(appPath, 'data')
      
      // 确保数据目录存在
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }
      
      dbPath = path.join(dataDir, 'timeblock_local.db')
      console.log('[Main] 生产环境 - 应用目录数据库:', dbPath)
    } else {
      // 开发环境：使用用户数据目录（方便调试，不影响开发时的应用更新）
      const userDataPath = app.getPath('userData')
      dbPath = path.join(userDataPath, 'timeblock_local.db')
      console.log('[Main] 开发环境 - 用户数据目录:', dbPath)
    }
    
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
  ipcMain.handle('timeBlock:getByDate', async (_event, date) => {
    try {
      const blocks = sqlite.timeBlock.findByDate(DEFAULT_USER_ID, date)
      return { success: true, data: blocks }
    } catch (err) {
      console.error('[IPC] timeBlock:getByDate 失败:', err.message)
      return { success: false, error: err.message }
    }
  })

  /** 获取周视图时间块 */
  ipcMain.handle('timeBlock:getByWeek', async (_event, startDate, endDate) => {
    try {
      const blocks = sqlite.timeBlock.findByWeek(DEFAULT_USER_ID, startDate, endDate)
      return { success: true, data: blocks }
    } catch (err) {
      console.error('[IPC] timeBlock:getByWeek 失败:', err.message)
      return { success: false, error: err.message }
    }
  })

  /** 获取月视图时间块 */
  ipcMain.handle('timeBlock:getByMonth', async (_event, year, month) => {
    try {
      const blocks = sqlite.timeBlock.findByMonth(DEFAULT_USER_ID, year, month)
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
        user_id: DEFAULT_USER_ID,
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
  ipcMain.handle('note:getAll', async () => {
    try {
      const notes = sqlite.note.findByUserId(DEFAULT_USER_ID)
      return { success: true, data: notes }
    } catch (err) {
      console.error('[IPC] note:getAll 失败:', err.message)
      return { success: false, error: err.message }
    }
  })

  /** 创建便签 */
  ipcMain.handle('note:create', async (_event, data) => {
    try {
      const note = sqlite.note.create({
        user_id: DEFAULT_USER_ID,
        name: data.name,
        color: data.color || '#409eff'
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