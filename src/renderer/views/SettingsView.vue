<template>
  <div class="view-container">
    <div class="view-header">
      <h2>设置</h2>
    </div>

    <!-- 移动端:竖向列表式设置选项（点击跳转到子页面） -->
    <div class="settings-content mobile-settings-list" v-if="isMobile">
      <div
        v-for="item in settingItems"
        :key="item.key"
        class="setting-item-card"
        @click="openSettingDetail(item.key)"
      >
        <div class="item-icon">
          <el-icon :size="24"><component :is="item.icon" /></el-icon>
        </div>
        <div class="item-content">
          <h4 class="item-title">{{ item.label }}</h4>
          <p class="item-desc">{{ item.description }}</p>
        </div>
        <div class="item-arrow">
          <el-icon :size="20"><ArrowRight /></el-icon>
        </div>
      </div>
    </div>

    <!-- PC端:横向Tabs布局 -->
    <div class="settings-content desktop-tabs" v-else>
      <el-tabs type="border-card">
        <el-tab-pane label="数据与同步">
          <!-- 同步设置 -->
          <el-form label-width="120px" class="settings-form">
            <el-form-item label="同步状态">
              <el-tag :type="isOnline ? 'success' : 'warning'">
                {{ isOnline ? '已连接' : '离线模式' }}
              </el-tag>
            </el-form-item>
            <el-form-item label="最后同步时间">
              <span>{{ lastSyncTime || '从未同步' }}</span>
            </el-form-item>
            <el-form-item label="自动同步">
              <el-switch v-model="autoSync" active-text="开启" inactive-text="关闭" />
            </el-form-item>
            <el-form-item label="同步间隔" v-if="autoSync">
              <el-select v-model="syncInterval" placeholder="选择同步间隔">
                <el-option label="每5分钟" value="5min" />
                <el-option label="每15分钟" value="15min" />
                <el-option label="每30分钟" value="30min" />
                <el-option label="每小时" value="1hour" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="syncNow">立即同步</el-button>
              <el-button @click="viewSyncLog">查看同步日志</el-button>
            </el-form-item>
          </el-form>
          <div class="sync-stats">
            <el-row :gutter="20">
              <el-col :span="8">
                <el-statistic title="本地记录数" :value="localCount" />
              </el-col>
              <el-col :span="8">
                <el-statistic title="云端记录数" :value="cloudCount" />
              </el-col>
              <el-col :span="8">
                <el-statistic title="待同步" :value="pendingCount" />
              </el-col>
            </el-row>
          </div>

          <!-- 分割线 -->
          <el-divider />

          <!-- 数据管理 -->
          <div class="data-actions">
            <el-card class="action-card">
              <template #header>数据导出</template>
              <p class="action-desc">将所有时间块数据导出为 JSON 文件</p>
              <el-button type="primary" :icon="Download" @click="exportData">导出数据</el-button>
            </el-card>

            <el-card class="action-card">
              <template #header>数据导入</template>
              <p class="action-desc">从 JSON 文件导入时间块数据</p>
              <el-upload
                action="#"
                :auto-upload="false"
                :on-change="handleImport"
                accept=".json"
              >
                <el-button type="primary" :icon="Upload">导入数据</el-button>
              </el-upload>
            </el-card>

            <el-card class="action-card danger">
              <template #header>清除数据</template>
              <p class="action-desc">清除所有本地数据，此操作不可恢复</p>
              <el-button type="danger" :icon="Delete" @click="clearAllData">清除所有数据</el-button>
            </el-card>
          </div>
        </el-tab-pane>

        <el-tab-pane label="账号管理">
          <el-form :model="accountForm" label-width="120px" class="settings-form">
            <el-form-item label="当前账号">
              <span v-if="isLoggedIn">{{ userInfo.email }}</span>
              <span v-else class="text-secondary">未登录</span>
            </el-form-item>

            <template v-if="!isLoggedIn">
              <el-form-item label="邮箱">
                <el-input v-model="accountForm.email" placeholder="请输入邮箱" />
              </el-form-item>
              <el-form-item label="密码">
                <el-input
                  v-model="accountForm.password"
                  type="password"
                  placeholder="请输入密码"
                  show-password
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="login">登录</el-button>
                <el-button @click="register">注册</el-button>
                <el-button type="warning" link @click="openForgotPassword">忘记密码?</el-button>
              </el-form-item>
            </template>

            <template v-else>
              <el-form-item label="用户名">
                <el-input v-model="userInfo.username" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="updateProfile">更新资料</el-button>
                <el-button type="danger" @click="logout">退出登录</el-button>
              </el-form-item>
            </template>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="便签管理">
          <div class="category-list">
            <div
              v-for="note in notes"
              :key="note.id"
              class="category-item"
            >
              <el-color-picker
                v-model="note.color"
                size="small"
                @change="(val) => handleNoteColorChange(note, val)"
              />
              <el-input
                v-model="note.name"
                size="small"
                class="category-name-input"
                @blur="handleNoteNameChange(note)"
                @keyup.enter="handleNoteNameChange(note)"
              />
              <el-button
                type="danger"
                size="small"
                :icon="Delete"
                circle
                @click="handleDeleteNote(note.id)"
              />
            </div>
            <el-button type="primary" :icon="Plus" @click="handleAddNote" :loading="addingNote">添加便签</el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane label="提醒管理">
          <div class="reminder-section" v-loading="loadingReminders">
            <!-- 时间块提醒区域 -->
            <el-card class="reminder-card">
              <template #header>时间块提醒</template>
              <div v-if="reminderTimeBlocks.length === 0" class="empty-hint">
                暂无设置了提醒的时间块
              </div>
              <div v-else class="reminder-list">
                <div
                  v-for="reminder in reminderTimeBlocks"
                  :key="reminder.id"
                  class="reminder-item"
                >
                  <div class="reminder-info">
                    <span class="reminder-title">{{ reminder.title }}</span>
                    <span class="reminder-time">提醒时间: {{ new Date(reminder.remind_at).toLocaleString() }}</span>
                  </div>
                  <el-button
                    type="danger"
                    size="small"
                    @click="cancelReminder(reminder)"
                  >
                    取消提醒
                  </el-button>
                </div>
              </div>
            </el-card>

            <!-- 便签自动提醒区域 -->
            <el-card class="reminder-card">
              <template #header>便签自动提醒</template>
              <div v-if="notes.length === 0" class="empty-hint">
                暂无便签
              </div>
              <div v-else class="auto-remind-list">
                <div
                  v-for="note in notes"
                  :key="note.id"
                  class="auto-remind-item"
                >
                  <div class="note-info">
                    <el-color-picker v-model="note.color" size="small" disabled />
                    <span class="note-name">{{ note.name }}</span>
                  </div>
                  <div class="note-remind-controls">
                    <el-switch
                      :model-value="note.auto_remind === 1"
                      @change="(val) => toggleNoteAutoRemind(note.id, val, note.default_advance_minutes || 5)"
                      active-text="开"
                      inactive-text="关"
                    />
                    <el-input-number
                      v-if="note.auto_remind === 1"
                      :model-value="note.default_advance_minutes || 5"
                      @change="(val) => toggleNoteAutoRemind(note.id, true, val)"
                      :min="1"
                      :max="60"
                      size="small"
                      style="width: 100px; margin-left: 8px;"
                    />
                    <span v-if="note.auto_remind === 1" class="advance-hint">分钟前提醒</span>
                  </div>
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>

        <el-tab-pane label="通用设置">
          <el-form label-width="120px" class="settings-form">
            <el-form-item label="默认视图">
              <el-radio-group v-model="defaultView">
                <el-radio-button label="record">记录</el-radio-button>
                <el-radio-button label="stats">统计</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="外观设置">
          <el-form label-width="120px" class="settings-form">
            <el-form-item label="主题">
              <div class="theme-picker">
                <div
                  v-for="t in themeOptions"
                  :key="t.value"
                  class="theme-option"
                  :class="{ active: store.theme === t.value }"
                  @click="handleThemeChange(t.value)"
                >
                  <div class="theme-preview">
                    <span class="preview-sidebar" :style="{ background: t.preview.sidebar }"></span>
                    <div class="preview-content">
                      <div class="preview-header" :style="{ background: t.preview.header, borderColor: t.preview.border }"></div>
                      <div class="preview-body" :style="{ background: t.preview.body }">
                        <div class="preview-line short" :style="{ background: t.preview.line }"></div>
                        <div class="preview-line mid" :style="{ background: t.preview.lineLight }"></div>
                        <div class="preview-line long" :style="{ background: t.preview.lineDim }"></div>
                      </div>
                    </div>
                  </div>
                  <span class="theme-name">{{ t.label }}</span>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="UI 动画效果">
              <el-switch
                v-model="animationEnabled"
                active-text="开启"
                inactive-text="关闭"
                @change="handleAnimationChange"
              />
              <span class="setting-hint">开启后全局 UI 将使用平滑过渡动画，关闭可提升性能</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>

      </el-tabs>
    </div>

    <!-- 密码找回对话框 -->
    <el-dialog v-model="showForgotPasswordDialog" title="找回密码" width="400px">
      <!-- 步骤1：输入邮箱 -->
      <el-form v-if="forgotPasswordStep === 1" label-width="80px">
        <el-form-item label="邮箱">
          <el-input v-model="forgotEmail" placeholder="请输入注册邮箱" />
        </el-form-item>
      </el-form>

      <!-- 步骤2：输入Token和新密码 -->
      <div v-if="forgotPasswordStep === 2">
        <el-alert type="info" :closable="false" style="margin-bottom: 16px">
          <template #title>
            <span v-if="receivedResetToken">重置Token已生成（开发模式显示）：{{ receivedResetToken }}</span>
            <span v-else>请输入收到的重置Token</span>
          </template>
        </el-alert>
        <el-form label-width="100px">
          <el-form-item label="重置Token">
            <el-input v-model="resetTokenInput" placeholder="请输入重置Token" />
          </el-form-item>
          <el-form-item label="新密码">
            <el-input
              v-model="newPassword"
              type="password"
              placeholder="请输入新密码（至少6位）"
              show-password
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button v-if="forgotPasswordStep === 1" @click="showForgotPasswordDialog = false">取消</el-button>
        <el-button v-if="forgotPasswordStep === 2" @click="forgotPasswordStep = 1">返回</el-button>
        <el-button type="primary" @click="forgotPasswordStep === 1 ? handleForgotPassword() : handleResetPassword()" :loading="forgotPasswordStep === 1 ? sendingResetToken : resettingPassword">
          {{ forgotPasswordStep === 1 ? '发送重置链接' : '重置密码' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Delete, Plus, Download, Upload, ArrowRight, Connection, User, Tickets, Setting, Brush, FolderOpened, Bell } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTimeBlockStore } from '@stores/timeBlock'
import * as authApi from '@api/auth'
import * as syncApi from '@api/sync'
import { getTimeBlockReminder, cancelTimeBlockReminder, setNoteAutoRemind, getPendingReminders } from '../services/reminder'

const router = useRouter()
const store = useTimeBlockStore()

// 移动端判断
const isMobile = ref(false)
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 799
}

// 登录状态（基于 Token）
const isLoggedIn = ref(false)
const userInfo = ref({
  username: 'User',
  email: 'user@example.com'
})

// 数据同步相关
const isOnline = ref(navigator.onLine)
const lastSyncTime = ref('')
const autoSync = ref(false)
const syncInterval = ref('15min')
const localCount = computed(() => store.blocks.length)
const cloudCount = ref(0)
const pendingCount = ref(0)
const syncing = ref(false) // 同步进行中标志

// 检查登录状态并加载用户信息
async function checkAuthStatus() {
  isLoggedIn.value = authApi.checkLogin()
  if (isLoggedIn.value) {
    try {
      const user = await authApi.getCurrentUser()
      userInfo.value = {
        username: user.name || 'User',
        email: user.email || 'user@example.com'
      }
    } catch (err) {
      console.error('[Settings] 获取用户信息失败:', err)
      // Token 可能已过期，清除登录状态
      isLoggedIn.value = false
    }
  }
}

// 加载同步状态
async function loadSyncStatus() {
  if (!isLoggedIn.value) return
  try {
    const status = await syncApi.getSyncStatus()
    if (status.lastSyncAt) {
      lastSyncTime.value = new Date(status.lastSyncAt).toLocaleString()
    }
    cloudCount.value = status.totalSyncs || 0
  } catch (err) {
    console.error('[Settings] 加载同步状态失败:', err)
  }
}

onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  // 初始化登录状态
  await checkAuthStatus()
  // 加载同步状态
  await loadSyncStatus()
  // 加载提醒数据
  await loadReminders()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

// 设置项列表(移动端竖向列表)
const settingItems = [
  {
    key: 'sync',
    label: '数据与同步',
    description: '同步状态、自动同步、同步间隔设置',
    icon: Connection
  },
  {
    key: 'account',
    label: '账号管理',
    description: '登录注册、用户资料管理',
    icon: User
  },
  {
    key: 'notes',
    label: '便签管理',
    description: '添加、编辑、删除便签分类',
    icon: Tickets
  },
  {
    key: 'reminder',
    label: '提醒管理',
    description: '时间块提醒、便签自动提醒设置',
    icon: Bell
  },
  {
    key: 'general',
    label: '通用设置',
    description: '默认视图、其他通用选项',
    icon: Setting
  },
  {
    key: 'appearance',
    label: '外观设置',
    description: '主题切换、UI动画效果',
    icon: Brush
  },
  {
    key: 'data',
    label: '数据管理',
    description: '数据导出、导入、清除',
    icon: FolderOpened
  }
]

// 移动端：使用路由跳转到子页面
function openSettingDetail(key) {
  router.push(`/settings/${key}`)
}

// 监听网络状态
window.addEventListener('online', () => { isOnline.value = true })
window.addEventListener('offline', () => { isOnline.value = false })

const accountForm = ref({
  email: '',
  password: ''
})

const defaultView = ref('record')

// ---- 密码找回功能 ----
const showForgotPasswordDialog = ref(false)
const forgotPasswordStep = ref(1)
const forgotEmail = ref('')
const receivedResetToken = ref('')
const resetTokenInput = ref('')
const newPassword = ref('')
const sendingResetToken = ref(false)
const resettingPassword = ref(false)

// 打开密码找回对话框
function openForgotPassword() {
  showForgotPasswordDialog.value = true
  forgotPasswordStep.value = 1
  forgotEmail.value = accountForm.value.email || ''
  receivedResetToken.value = ''
  resetTokenInput.value = ''
  newPassword.value = ''
}

// 发送重置Token
async function handleForgotPassword() {
  if (!forgotEmail.value) {
    ElMessage.warning('请输入邮箱')
    return
  }

  sendingResetToken.value = true
  try {
    const result = await authApi.forgotPassword(forgotEmail.value)
    ElMessage.success(result.message || '重置链接已发送')

    // 开发模式：显示Token
    if (result.resetToken) {
      receivedResetToken.value = result.resetToken
      resetTokenInput.value = result.resetToken
    }

    // 进入步骤2
    forgotPasswordStep.value = 2
  } catch (err) {
    console.error('[Settings] 发送重置Token失败:', err)
    ElMessage.error(err.message || '发送失败')
  } finally {
    sendingResetToken.value = false
  }
}

// 重置密码
async function handleResetPassword() {
  if (!resetTokenInput.value || !newPassword.value) {
    ElMessage.warning('请填写完整信息')
    return
  }

  if (newPassword.value.length < 6) {
    ElMessage.warning('密码长度至少6位')
    return
  }

  resettingPassword.value = true
  try {
    const result = await authApi.resetPassword(resetTokenInput.value, newPassword.value)
    ElMessage.success(result.message || '密码已重置成功')

    // 自动登录
    isLoggedIn.value = true
    userInfo.value = {
      username: result.user?.name || 'User',
      email: result.user?.email || forgotEmail.value
    }

    // 关闭对话框
    showForgotPasswordDialog.value = false
    forgotPasswordStep.value = 1

    // 加载同步状态
    await loadSyncStatus()
  } catch (err) {
    console.error('[Settings] 重置密码失败:', err)
    ElMessage.error(err.message || '重置密码失败')
  } finally {
    resettingPassword.value = false
  }
}

// 主题选项（含预览色）
const themeOptions = [
  {
    value: 'light',
    label: '浅色',
    preview: { sidebar: '#304156', header: '#fff', body: '#f5f7fa', border: '#e4e7ed', line: '#303133', lineLight: '#606266', lineDim: '#c0c4cc' }
  },
  {
    value: 'dark',
    label: '深色',
    preview: { sidebar: '#1a1a2e', header: '#1f1f1f', body: '#141414', border: '#434343', line: '#e0e0e0', lineLight: '#b0b0b0', lineDim: '#555555' }
  },
  {
    value: 'green',
    label: '护眼绿',
    preview: { sidebar: '#2d5038', header: '#f7fbf7', body: '#f0f5f0', border: '#cce0d0', line: '#1a3320', lineLight: '#3d5c46', lineDim: '#8aa894' }
  },
  {
    value: 'warm',
    label: '暖色',
    preview: { sidebar: '#6b5344', header: '#fdfbf7', body: '#faf6f0', border: '#e8ded2', line: '#3d3027', lineLight: '#5c4d41', lineDim: '#b0a498' }
  },
  {
    value: 'blue',
    label: '深蓝',
    preview: { sidebar: '#0d1f38', header: '#132240', body: '#0a1628', border: '#1e3a5f', line: '#c9d6df', lineLight: '#98a8b8', lineDim: '#4a6580' }
  },
  {
    value: 'contrast',
    label: '高对比',
    preview: { sidebar: '#000000', header: '#ffffff', body: '#ffffff', border: '#000000', line: '#000000', lineLight: '#333333', lineDim: '#777777' }
  },
  {
    value: 'auto',
    label: '跟随系统',
    preview: { sidebar: '#606266', header: '#fff', body: '#f5f7fa', border: '#e4e7ed', line: '#303133', lineLight: '#909399', lineDim: '#c0c4cc' }
  }
]

const themeLabels = Object.fromEntries(themeOptions.map(t => [t.value, t.label]))

// 主题切换（通过 store.setTheme 写回 + 持久化）
async function handleThemeChange(val) {
  await store.setTheme(val)
  ElMessage.success(`主题已切换为：${themeLabels[val] || val}`)
}

// 动画开关（从 store 读取）
const animationEnabled = computed({
  get: () => store.animationEnabled,
  set: async (val) => {
    await store.setAnimationEnabled(val)
  }
})

async function handleAnimationChange(val) {
  await store.setAnimationEnabled(val)
  ElMessage.success(val ? 'UI 动画已开启' : 'UI 动画已关闭（性能模式）')
}

const notes = computed(() => store.notes)
const addingNote = ref(false)

// 提醒管理相关状态
const reminderTimeBlocks = ref([])
const autoRemindNotes = ref([])
const loadingReminders = ref(false)

// 加载提醒数据
async function loadReminders() {
  loadingReminders.value = true
  try {
    // 获取待提醒的时间块列表
    const pendingReminders = await getPendingReminders()
    reminderTimeBlocks.value = pendingReminders.filter(r => r.target_type === 'time_block')

    // 获取开启了自动提醒的便签
    autoRemindNotes.value = notes.value.filter(n => n.auto_remind === 1).map(n => ({
      ...n,
      advanceMinutes: n.default_advance_minutes || 5
    }))
  } catch (err) {
    console.error('[SettingsView] 加载提醒数据失败:', err)
    ElMessage.error('加载提醒数据失败')
  } finally {
    loadingReminders.value = false
  }
}

// 取消单个提醒
async function cancelReminder(reminder) {
  try {
    // 使用 target_id (时间块ID) 取消提醒
    await cancelTimeBlockReminder(reminder.target_id)
    ElMessage.success('提醒已取消')
    await loadReminders()
  } catch (err) {
    console.error('[SettingsView] 取消提醒失败:', err)
    ElMessage.error('取消提醒失败')
  }
}

// 开关便签自动提醒
async function toggleNoteAutoRemind(noteId, enabled, advanceMinutes = 5) {
  try {
    await setNoteAutoRemind(noteId, enabled, advanceMinutes)
    ElMessage.success(enabled ? '已开启自动提醒' : '已关闭自动提醒')
    await loadReminders()
  } catch (err) {
    console.error('[SettingsView] 设置便签自动提醒失败:', err)
    ElMessage.error('设置便签自动提醒失败')
  }
}

// 便签管理 - 添加便签（调用 store.createNote 持久化到数据库）
async function handleAddNote() {
  addingNote.value = true
  try {
    const newNote = await store.createNote({
      name: '新便签',
      color: '#909399'
    })
    if (newNote) {
      ElMessage.success('便签已添加')
    } else {
      ElMessage.error('添加便签失败')
    }
  } catch (err) {
    console.error('[SettingsView] 添加便签失败:', err)
    ElMessage.error('添加便签失败')
  } finally {
    addingNote.value = false
  }
}

// 便签管理 - 删除便签（调用 store.deleteNote 持久化到数据库）
async function handleDeleteNote(noteId) {
  try {
    await ElMessageBox.confirm(
      '确定要删除此便签吗？关联的时间块将解除绑定。',
      '删除便签',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )

    const success = await store.deleteNote(noteId)
    if (success) {
      ElMessage.success('便签已删除')
    } else {
      ElMessage.error('删除便签失败')
    }
  } catch (err) {
    if (err !== 'cancel') {
      console.error('[SettingsView] 删除便签失败:', err)
      ElMessage.error('删除便签失败')
    }
  }
}

// 便签管理 - 更新便签名称（失焦或回车时触发）
async function handleNoteNameChange(note) {
  if (!note.name || note.name.trim() === '') {
    ElMessage.warning('便签名称不能为空')
    return
  }
  try {
    await store.updateNote(note.id, { name: note.name.trim() })
  } catch (err) {
    console.error('[SettingsView] 更新便签名称失败:', err)
    ElMessage.error('更新便签名称失败')
  }
}

// 便签管理 - 更新便签颜色（颜色选择器变化时触发）
async function handleNoteColorChange(note, newColor) {
  if (!newColor) return
  try {
    await store.updateNote(note.id, { color: newColor })
  } catch (err) {
    console.error('[SettingsView] 更新便签颜色失败:', err)
    ElMessage.error('更新便签颜色失败')
  }
}

// 数据同步方法 - 执行完整同步（上传 + 下载）
async function syncNow() {
  if (!isOnline.value) {
    ElMessage.warning('当前离线模式，无法同步')
    return
  }

  if (!isLoggedIn.value) {
    ElMessage.warning('请先登录后再同步')
    return
  }

  syncing.value = true
  ElMessage.info('正在同步数据...')

  try {
    // 收集本地数据
    const localData = {
      notes: store.notes.map(n => ({
        id: n.id,
        name: n.name,
        color: n.color
      })),
      timeBlocks: store.blocks.map(b => ({
        id: b.id,
        noteId: b.noteId,
        title: b.title,
        description: b.remark || b.description,
        startTime: `${b.date}T${b.startTime}:00`,
        endTime: `${b.date}T${b.endTime}:00`,
        isCompleted: b.isCompleted ? 1 : 0
      })),
      syncType: 'manual'
    }

    // 执行同步
    const result = await syncApi.fullSync(localData, lastSyncTime.value)

    // 更新同步时间
    lastSyncTime.value = new Date(result.serverTime).toLocaleString()

    // 合并云端数据到本地（可选：根据业务需求决定是否覆盖）
    if (result.data.notes && result.data.notes.length > 0) {
      // 简单合并策略：云端数据覆盖本地
      store.notes = result.data.notes.map(n => ({
        id: n.id,
        name: n.name,
        color: n.color
      }))
    }

    if (result.data.timeBlocks && result.data.timeBlocks.length > 0) {
      // 简单合并策略：云端数据覆盖本地
      store.blocks = result.data.timeBlocks.map(tb => ({
        id: tb.id,
        noteId: tb.noteId,
        noteName: tb.note?.name || '未分类',
        noteColor: tb.note?.color || '#909399',
        title: tb.title,
        description: tb.description,
        startTime: tb.startTime.split('T')[1]?.slice(0, 5) || '00:00',
        endTime: tb.endTime.split('T')[1]?.slice(0, 5) || '00:00',
        date: tb.startTime.split('T')[0] || new Date().toISOString().split('T')[0],
        isCompleted: tb.isCompleted === 1,
        remark: tb.description || ''
      }))
    }

    pendingCount.value = 0
    ElMessage.success(`同步成功！上传 ${result.uploaded} 条，下载 ${result.downloaded.notes + result.downloaded.timeBlocks} 条`)

  } catch (err) {
    console.error('[Settings] 同步失败:', err)
    ElMessage.error(err.message || '数据同步失败')
  } finally {
    syncing.value = false
  }
}

// 查看同步日志
async function viewSyncLog() {
  if (!isLoggedIn.value) {
    ElMessage.warning('请先登录')
    return
  }
  try {
    const result = await syncApi.getSyncLogs(1, 10)
    if (result.items && result.items.length > 0) {
      ElMessage.info(`最近同步：${result.items[0].syncType}，${result.items[0].recordsSynced || 0} 条记录`)
    } else {
      ElMessage.info('暂无同步记录')
    }
  } catch (err) {
    ElMessage.error('获取同步日志失败')
  }
}

// 用户登录
async function login() {
  if (!accountForm.value.email || !accountForm.value.password) {
    ElMessage.warning('请输入邮箱和密码')
    return
  }

  try {
    const result = await authApi.login(accountForm.value.email, accountForm.value.password)
    isLoggedIn.value = true
    userInfo.value = {
      username: result.user.name || 'User',
      email: result.user.email || accountForm.value.email
    }
    ElMessage.success('登录成功')
    // 登录后自动加载同步状态
    await loadSyncStatus()
  } catch (err) {
    console.error('[Settings] 登录失败:', err)
    ElMessage.error(err.message || '登录失败，请检查邮箱和密码')
  }
}

// 用户注册
async function register() {
  if (!accountForm.value.email || !accountForm.value.password) {
    ElMessage.warning('请输入邮箱和密码')
    return
  }

  try {
    await authApi.register(accountForm.value.email, accountForm.value.password, accountForm.value.email.split('@')[0])
    ElMessage.success('注册成功，已自动登录')
    // 注册后自动登录，刷新状态
    await checkAuthStatus()
  } catch (err) {
    console.error('[Settings] 注册失败:', err)
    ElMessage.error(err.message || '注册失败')
  }
}

// 退出登录
function logout() {
  authApi.logout()
  isLoggedIn.value = false
  userInfo.value = { username: 'User', email: 'user@example.com' }
  lastSyncTime.value = ''
  cloudCount.value = 0
  ElMessage.success('已退出登录')
}

// 更新用户资料（暂未实现后端 API）
function updateProfile() {
  ElMessage.success('资料已更新')
}

/**
 * 导出数据（用于跨设备/用户分享）
 *
 * 导出包含便签和时间块的完整数据包
 */
function exportData() {
  const exportPackage = {
    version: '1.0',
    exportTime: new Date().toISOString(),
    app: 'TimeBlock',
    // 导出便签（包含颜色信息）
    notes: store.notes.map(n => ({
      name: n.name,
      color: n.color
      // 不导出 ID，导入时重新生成
    })),
    // 导出时间块
    timeBlocks: store.blocks.map(b => ({
      noteName: store.getNoteName(b.noteId), // 便签名称（用于匹配）
      title: b.title,
      description: b.remark || b.description || '',
      startTime: `${b.date}T${b.startTime}:00`,
      endTime: `${b.date}T${b.endTime}:00`,
      isCompleted: b.isCompleted ? 1 : 0,
      date: b.date
      // 不导出 ID，导入时重新生成
    }))
  }

  const data = JSON.stringify(exportPackage, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `timeblock-share-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`导出成功：${store.notes.length} 个便签，${store.blocks.length} 个时间块`)
}

/**
 * 导入数据（从其他设备/用户分享的文件）
 *
 * 智能合并策略：
 * - 便签：按名称匹配，不存在则新建
 * - 时间块：生成新 ID，匹配便签后导入
 */
async function handleImport(file) {
  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const importPackage = JSON.parse(e.target.result)

      // 验证数据格式
      if (!importPackage.app || importPackage.app !== 'TimeBlock') {
        ElMessage.error('无效的 TimeBlock 数据文件')
        return
      }

      const importedNotes = importPackage.notes || []
      const importedBlocks = importPackage.timeBlocks || []

      if (importedNotes.length === 0 && importedBlocks.length === 0) {
        ElMessage.warning('文件中没有可导入的数据')
        return
      }

      // 显示导入确认对话框
      const confirmResult = await ElMessageBox.confirm(
        `即将导入 ${importedNotes.length} 个便签和 ${importedBlocks.length} 个时间块。\n数据将与本地数据合并，是否继续？`,
        '导入数据确认',
        {
          confirmButtonText: '合并导入',
          cancelButtonText: '取消',
          type: 'info'
        }
      ).catch(() => 'cancel')

      if (confirmResult === 'cancel') {
        return
      }

      // 导入便签（按名称匹配）
      const noteNameToId = {} // 导入便签名称 -> 本地便签 ID
      let newNotesCount = 0

      for (const importedNote of importedNotes) {
        // 查找是否存在同名便签
        const existingNote = store.notes.find(n => n.name === importedNote.name)

        if (existingNote) {
          // 已存在同名便签，使用现有 ID
          noteNameToId[importedNote.name] = existingNote.id
        } else {
          // 创建新便签
          const newNote = await store.createNote({
            name: importedNote.name,
            color: importedNote.color || '#909399'
          })
          if (newNote) {
            noteNameToId[importedNote.name] = newNote.id
            newNotesCount++
          }
        }
      }

      // 导入时间块（生成新 ID）
      let newBlocksCount = 0
      for (const importedBlock of importedBlocks) {
        // 匹配便签 ID
        const noteId = noteNameToId[importedBlock.noteName] || null

        // 创建新时间块
        const newBlock = await store.addBlock({
          noteId: noteId,
          title: importedBlock.title || '导入的时间块',
          remark: importedBlock.description || '',
          startTime: importedBlock.startTime.split('T')[1]?.slice(0, 5) || '09:00',
          endTime: importedBlock.endTime.split('T')[1]?.slice(0, 5) || '10:00',
          date: importedBlock.date || importedBlock.startTime.split('T')[0] || new Date().toISOString().split('T')[0],
          isCompleted: importedBlock.isCompleted === 1
        })

        if (newBlock) {
          newBlocksCount++
        }
      }

      ElMessage.success(`导入成功！新增 ${newNotesCount} 个便签，${newBlocksCount} 个时间块`)

    } catch (err) {
      console.error('[Settings] 导入失败:', err)
      if (err instanceof SyntaxError) {
        ElMessage.error('文件格式错误，请选择有效的 JSON 文件')
      } else {
        ElMessage.error(err.message || '导入失败')
      }
    }
  }
  reader.readAsText(file.raw)
}

function clearAllData() {
  ElMessageBox.confirm(
    '确定要清除所有数据吗？此操作不可恢复！',
    '警告',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    store.blocks = []
    ElMessage.success('数据已清除')
  })
}
</script>

<style lang="scss" scoped>
// PC端保持原样
.desktop-tabs {
  height: calc(100% - 60px);
  overflow: auto;
}

// 移动端竖向列表样式
.mobile-settings-list {
  height: calc(100% - 50px);
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .setting-item-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--bg-secondary);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid var(--border-lighter);

    &:active {
      transform: scale(0.98);
      background: var(--bg-hover-soft);
    }

    .item-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--primary-light);
      border-radius: 8px;
      color: var(--primary-color);
      flex-shrink: 0;
    }

    .item-content {
      flex: 1;
      min-width: 0;

      .item-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 4px 0;
      }

      .item-desc {
        font-size: 12px;
        color: var(--text-secondary);
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .item-arrow {
      color: var(--text-secondary);
      flex-shrink: 0;
    }
  }
}

.settings-content {
  height: calc(100% - 60px);
  overflow: auto;
}

.sync-info {
  padding: 16px 20px;
}

.sync-stats {
  padding: 20px;
  margin-top: 10px;
  background: var(--bg-tertiary);
  border-radius: 8px;
}

.settings-form {
  max-width: 500px;
  padding: 20px;
}

.category-list {
  padding: 20px;

  .category-item {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    .category-name-input {
      width: 200px;
    }
  }
}

.data-actions {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  .action-card {
    .action-desc {
      color: var(--text-secondary);
      margin-bottom: 12px;
      font-size: 13px;
    }

    &.danger {
      :deep(.el-card__header) {
        color: var(--danger-color);
      }
    }
  }
}

.text-secondary {
  color: var(--text-secondary);
}

.setting-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

// ---- 主题选择器 ----
.theme-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  max-width: 520px;

  .theme-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 8px;
    border-radius: 10px;
    border: 2px solid transparent;
    background: transparent;
    transition: all 0.2s ease;

    &:hover {
      background: var(--bg-hover-soft);
      border-color: var(--border-light);
    }

    &.active {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.15);

      .theme-name { color: var(--primary-color); font-weight: 600; }
    }
  }

  .theme-preview {
    width: 72px;
    height: 48px;
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
    border: 1px solid var(--border-lighter);

    .preview-sidebar {
      width: 16px;
      height: 100%;
      flex-shrink: 0;
    }

    .preview-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;

      .preview-header {
        height: 10px;
        width: 100%;
        border-bottom: 1px solid #ddd;
        flex-shrink: 0;
      }

      .preview-body {
        flex: 1;
        padding: 5px 4px;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
    }
  }

  .preview-line {
    height: 3px;
    border-radius: 1.5px;
    &.short { width: 60%; }
    &.mid { width: 80%; }
    &.long { width: 45%; }
  }

  .theme-name {
    font-size: 12px;
    color: var(--text-regular);
    transition: color 0.2s ease;
  }
}

// ---- 提醒管理样式 ----
.reminder-section {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  .reminder-card {
    .empty-hint {
      color: var(--text-secondary);
      font-size: 14px;
      padding: 16px;
      text-align: center;
    }

    .reminder-list {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .reminder-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 16px;
        background: var(--bg-tertiary);
        border-radius: 8px;

        .reminder-info {
          flex: 1;
          min-width: 0;

          .reminder-title {
            font-size: 14px;
            font-weight: 500;
            color: var(--text-primary);
            display: block;
            margin-bottom: 4px;
          }

          .reminder-time {
            font-size: 12px;
            color: var(--text-secondary);
          }
        }
      }
    }

    .auto-remind-list {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .auto-remind-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 16px;
        background: var(--bg-tertiary);
        border-radius: 8px;

        .note-info {
          display: flex;
          align-items: center;
          gap: 8px;

          .note-name {
            font-size: 14px;
            color: var(--text-primary);
          }
        }

        .note-remind-controls {
          display: flex;
          align-items: center;
          gap: 8px;

          .advance-hint {
            font-size: 12px;
            color: var(--text-secondary);
          }
        }
      }
    }
  }
}
</style>
