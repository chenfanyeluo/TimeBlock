<template>
  <div class="view-container settings-detail">
    <!-- 顶部返回导航 -->
    <div class="view-header">
      <el-button :icon="ArrowLeft" circle size="small" @click="goBack" />
      <h2>{{ currentTitle }}</h2>
    </div>

    <div class="settings-detail-content">
      <!-- 数据与同步 -->
      <div v-if="currentKey === 'sync'" class="setting-section">
        <div class="settings-card">
          <div class="setting-row">
            <span class="row-label">同步状态</span>
            <el-tag :type="isOnline ? 'success' : 'warning'">
              {{ isOnline ? '已连接' : '离线模式' }}
            </el-tag>
          </div>
          <div class="setting-row">
            <span class="row-label">最后同步</span>
            <span class="row-value">{{ lastSyncTime || '从未同步' }}</span>
          </div>
          <div class="setting-row">
            <span class="row-label">自动同步</span>
            <el-switch v-model="autoSync" inline-prompt active-text="开" inactive-text="关" />
          </div>
          <div class="setting-row" v-if="autoSync">
            <span class="row-label">同步间隔</span>
            <el-select v-model="syncInterval" placeholder="选择同步间隔" style="width: 140px">
              <el-option label="每5分钟" value="5min" />
              <el-option label="每15分钟" value="15min" />
              <el-option label="每30分钟" value="30min" />
              <el-option label="每小时" value="1hour" />
            </el-select>
          </div>
        </div>
        <div class="sync-stats">
          <div class="stat-item">
            <div class="stat-title">本地记录数</div>
            <div class="stat-value">{{ localCount }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-title">云端记录数</div>
            <div class="stat-value">{{ cloudCount }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-title">待同步</div>
            <div class="stat-value">{{ pendingCount }}</div>
          </div>
        </div>
        <div class="action-buttons">
          <el-button type="primary" @click="syncNow">立即同步</el-button>
          <el-button @click="viewSyncLog">查看日志</el-button>
        </div>
      </div>

      <!-- 账号管理 -->
      <div v-if="currentKey === 'account'" class="setting-section">
        <div class="settings-card">
          <div class="setting-row">
            <span class="row-label">当前账号</span>
            <span v-if="isLoggedIn" class="row-value">{{ userInfo.email }}</span>
            <span v-else class="row-value text-secondary">未登录</span>
          </div>
        </div>

        <template v-if="!isLoggedIn">
          <el-form :model="accountForm" label-position="top" class="settings-form">
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
          </el-form>
          <div class="action-buttons">
            <el-button type="primary" @click="login">登录</el-button>
            <el-button @click="register">注册</el-button>
          </div>
        </template>

        <template v-else>
          <el-form :model="userInfo" label-position="top" class="settings-form">
            <el-form-item label="用户名">
              <el-input v-model="userInfo.username" />
            </el-form-item>
          </el-form>
          <div class="action-buttons">
            <el-button type="primary" @click="updateProfile">更新资料</el-button>
            <el-button type="danger" @click="logout">退出登录</el-button>
          </div>
        </template>
      </div>

      <!-- 便签管理 -->
      <div v-if="currentKey === 'notes'" class="setting-section">
        <div class="notes-list">
          <div
            v-for="note in localNotes"
            :key="note.id"
            class="note-item"
          >
            <el-color-picker
              v-model="note.color"
              size="small"
              @change="(val) => updateNoteInfo(note.id, { color: val })"
            />
            <el-input
              v-model="note.name"
              size="small"
              class="note-name-input"
              @blur="(e) => updateNoteInfo(note.id, { name: e.target.value })"
            />
            <el-button
              type="danger"
              size="small"
              :icon="Delete"
              circle
              @click="deleteNote(note.id)"
            />
          </div>
          <el-button type="primary" :icon="Plus" @click="addNote" class="add-note-btn">
            添加便签
          </el-button>
        </div>
      </div>

      <!-- 通用设置 -->
      <div v-if="currentKey === 'general'" class="setting-section">
        <div class="settings-card">
          <div class="setting-row">
            <span class="row-label">默认视图</span>
            <el-radio-group v-model="defaultView" size="small">
              <el-radio-button label="record">记录</el-radio-button>
              <el-radio-button label="stats">统计</el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <!-- 提醒管理区域 -->
        <div class="reminder-section" v-loading="loadingReminders">
          <!-- 时间块提醒 -->
          <div class="reminder-card">
            <h4 class="section-label">时间块提醒</h4>
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
                  <span class="reminder-time">{{ new Date(reminder.remind_at).toLocaleString() }}</span>
                </div>
                <el-button
                  type="danger"
                  size="small"
                  @click="cancelReminder(reminder)"
                >
                  取消
                </el-button>
              </div>
            </div>
          </div>

          <!-- 便签自动提醒 -->
          <div class="reminder-card">
            <h4 class="section-label">便签自动提醒</h4>
            <div v-if="localNotes.length === 0" class="empty-hint">
              暂无便签
            </div>
            <div v-else class="auto-remind-list">
              <div
                v-for="note in localNotes"
                :key="note.id"
                class="auto-remind-item"
              >
                <div class="note-info">
                  <el-color-picker v-model="note.color" size="small" disabled />
                  <span class="note-name">{{ note.name }}</span>
                </div>
                <div class="note-remind-controls">
                  <el-input-number
                    v-if="note.auto_remind === 1"
                    :model-value="note.default_advance_minutes || 5"
                    @change="(val) => toggleNoteAutoRemind(note.id, true, val)"
                    :min="1"
                    :max="60"
                    size="small"
                    style="width: 80px"
                  />
                  <span v-if="note.auto_remind === 1" class="advance-hint">分钟前提醒</span>
                  <el-switch
                    :model-value="note.auto_remind === 1"
                    @change="(val) => toggleNoteAutoRemind(note.id, val, note.default_advance_minutes || 5)"
                    inline-prompt
                    active-text="开"
                    inactive-text="关"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 外观设置 -->
      <div v-if="currentKey === 'appearance'" class="setting-section">
        <div class="settings-card">
          <div class="setting-row">
            <span class="row-label">UI动画</span>
            <el-switch
              v-model="animationEnabled"
              inline-prompt
              active-text="开"
              inactive-text="关"
              @change="handleAnimationChange"
            />
          </div>
        </div>

        <div class="theme-section">
          <h4 class="section-label">主题</h4>
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
                  </div>
                </div>
              </div>
              <span class="theme-name">{{ t.label }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 数据管理 -->
      <div v-if="currentKey === 'data'" class="setting-section">
        <div class="data-actions">
          <div class="data-action-row">
            <div class="action-info">
              <div class="action-title">数据导出</div>
              <div class="action-desc">将所有时间块数据导出为 JSON 文件</div>
            </div>
            <el-button type="primary" :icon="Download" @click="exportData">
              导出
            </el-button>
          </div>

          <div class="data-action-row">
            <div class="action-info">
              <div class="action-title">数据导入</div>
              <div class="action-desc">从 JSON 文件导入时间块数据</div>
            </div>
            <el-upload
              action="#"
              :auto-upload="false"
              :on-change="handleImport"
              accept=".json"
            >
              <el-button type="primary" :icon="Upload">导入</el-button>
            </el-upload>
          </div>

          <div class="data-action-row danger">
            <div class="action-info">
              <div class="action-title">清除数据</div>
              <div class="action-desc">清除所有本地数据，此操作不可恢复</div>
            </div>
            <el-button type="danger" :icon="Delete" @click="clearAllData">
              清除
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, Delete, Plus, Download, Upload } from '@element-plus/icons-vue'
import { getTimeBlockReminder, cancelTimeBlockReminder, getPendingReminders } from '../services/reminder'
import { ElMessageBox } from 'element-plus'
import { ElMessage } from '@utils/message'
import { useTimeBlockStore } from '@stores/timeBlock'

const router = useRouter()
const route = useRoute()
const store = useTimeBlockStore()

// 设置项映射
const settingItems = {
  sync: { title: '数据与同步', key: 'sync' },
  account: { title: '账号管理', key: 'account' },
  notes: { title: '便签管理', key: 'notes' },
  general: { title: '通用设置', key: 'general' },
  appearance: { title: '外观设置', key: 'appearance' },
  data: { title: '数据管理', key: 'data' }
}

// 当前设置项
const currentKey = computed(() => route.params.key || 'sync')
const currentTitle = computed(() => {
  const item = settingItems[currentKey.value]
  return item ? item.title : '设置'
})

// 返回上一页
function goBack() {
  router.push('/settings')
}

// 数据同步相关
const isOnline = ref(navigator.onLine)
const lastSyncTime = ref('')
const autoSync = ref(false)
const syncInterval = ref('15min')
const localCount = computed(() => store.blocks.length)
const cloudCount = ref(0)
const pendingCount = ref(0)

// 监听网络状态
window.addEventListener('online', () => { isOnline.value = true })
window.addEventListener('offline', () => { isOnline.value = false })

// 初始化加载提醒数据
loadReminders()

const accountForm = ref({
  email: '',
  password: ''
})

const userInfo = ref({
  username: 'User',
  email: 'user@example.com'
})

const isLoggedIn = ref(false)
const defaultView = ref('record')

// 主题选项
const themeOptions = [
  {
    value: 'light',
    label: '浅色',
    preview: { sidebar: '#304156', header: '#fff', body: '#f5f7fa', border: '#e4e7ed', line: '#303133', lineLight: '#606266' }
  },
  {
    value: 'dark',
    label: '深色',
    preview: { sidebar: '#1a1a2e', header: '#1f1f1f', body: '#141414', border: '#434343', line: '#e0e0e0', lineLight: '#b0b0b0' }
  },
  {
    value: 'green',
    label: '护眼绿',
    preview: { sidebar: '#2d5038', header: '#f7fbf7', body: '#f0f5f0', border: '#cce0d0', line: '#1a3320', lineLight: '#3d5c46' }
  },
  {
    value: 'warm',
    label: '暖色',
    preview: { sidebar: '#6b5344', header: '#fdfbf7', body: '#faf6f0', border: '#e8ded2', line: '#3d3027', lineLight: '#5c4d41' }
  },
  {
    value: 'blue',
    label: '深蓝',
    preview: { sidebar: '#0d1f38', header: '#132240', body: '#0a1628', border: '#1e3a5f', line: '#c9d6df', lineLight: '#98a8b8' }
  },
  {
    value: 'contrast',
    label: '高对比',
    preview: { sidebar: '#000000', header: '#ffffff', body: '#ffffff', border: '#000000', line: '#000000', lineLight: '#333333' }
  },
  {
    value: 'auto',
    label: '跟随系统',
    preview: { sidebar: '#606266', header: '#fff', body: '#f5f7fa', border: '#e4e7ed', line: '#303133', lineLight: '#909399' }
  }
]

const themeLabels = Object.fromEntries(themeOptions.map(t => [t.value, t.label]))

// 主题切换
async function handleThemeChange(val) {
  await store.setTheme(val)
  ElMessage.success(`主题已切换为：${themeLabels[val] || val}`)
}

// 动画开关
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

// 便签数据：使用 watch 确保响应式更新
const localNotes = ref([])

// 监听 store.notes 的变化，确保界面及时同步
const stopWatchNotes = watch(
  () => store.notes,
  (newNotes) => {
    localNotes.value = [...newNotes]  // 创建新数组触发响应式更新
  },
  { immediate: true, deep: true }
)

// 组件卸载时停止监听
onUnmounted(() => {
  stopWatchNotes()
})

// 提醒管理相关状态
const reminderTimeBlocks = ref([])
const loadingReminders = ref(false)

// 加载提醒数据
async function loadReminders() {
  loadingReminders.value = true
  try {
    const pendingReminders = await getPendingReminders()
    reminderTimeBlocks.value = pendingReminders.filter(r => r.target_type === 'time_block')
  } catch (err) {
    console.error('[SettingsDetailView] 加载提醒数据失败:', err)
    ElMessage.error('加载提醒数据失败: ' + (err.message || '未知错误'))
  } finally {
    loadingReminders.value = false
  }
}

// 取消提醒
async function cancelReminder(reminder) {
  try {
    await cancelTimeBlockReminder(reminder.target_id)
    ElMessage.success('提醒已取消')
    await loadReminders()
  } catch (err) {
    console.error('[SettingsDetailView] 取消提醒失败:', err)
    ElMessage.error('取消提醒失败')
  }
}

// 开关便签自动提醒
async function toggleNoteAutoRemind(noteId, enabled, advanceMinutes = 5) {
  try {
    await store.updateNote(noteId, {
      auto_remind: enabled ? 1 : 0,
      default_advance_minutes: advanceMinutes
    })
    ElMessage.success(enabled ? '已开启自动提醒' : '已关闭自动提醒')
  } catch (err) {
    console.error('[SettingsDetailView] 设置便签自动提醒失败:', err)
    ElMessage.error('设置便签自动提醒失败')
  }
}

// 数据同步方法
function syncNow() {
  if (!isOnline.value) {
    ElMessage.warning('当前离线模式，无法同步')
    return
  }
  ElMessage.info('正在同步数据...')
  setTimeout(() => {
    lastSyncTime.value = new Date().toLocaleString()
    pendingCount.value = 0
    ElMessage.success('数据同步成功！')
  }, 1500)
}

function viewSyncLog() {
  ElMessage.info('暂无同步日志')
}

function login() {
  isLoggedIn.value = true
  ElMessage.success('登录成功')
}

function register() {
  ElMessage.success('注册成功，请登录')
}

function logout() {
  isLoggedIn.value = false
  ElMessage.success('已退出登录')
}

function updateProfile() {
  ElMessage.success('资料已更新')
}

async function addNote() {
  await store.createNote({
    name: '新便签',
    color: '#909399'
  })
}

async function deleteNote(id) {
  await store.deleteNote(id)
}

// 更新便签信息（名称或颜色）
async function updateNoteInfo(noteId, updates) {
  await store.updateNote(noteId, updates)
}

function exportData() {
  const data = JSON.stringify(store.blocks, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `timeblock-backup-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('数据导出成功')
}

function handleImport(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      store.blocks = data
      ElMessage.success('数据导入成功')
    } catch {
      ElMessage.error('文件格式错误')
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
.settings-detail {
  background: var(--bg-primary);
}

.view-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);

  h2 {
    flex: 1;
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary);
    text-align: center;
    padding-right: 32px; // 为左侧返回按钮留出对称空间
  }
}

.settings-detail-content {
  height: calc(100% - 60px);
  overflow-y: auto;
  padding: 16px;
}

.setting-section {
  max-width: 100%;
  width: 100%;
}

.settings-form {
  :deep(.el-form-item) {
    margin-bottom: 16px;
  }

  :deep(.el-form-item__label) {
    font-size: 14px;
    color: var(--text-regular);
    padding-bottom: 6px;
  }
}

// 移动端设置卡片（左右布局：左侧标题，右侧值/控件）
.settings-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  min-height: 52px;
  border-bottom: 1px solid var(--border-lighter);

  &:last-child {
    border-bottom: none;
  }

  .row-label {
    font-size: 15px;
    color: var(--text-primary);
    flex-shrink: 0;
  }

  // 右侧内容区域：靠右显示，允许换行
  & > :not(.row-label) {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }

  .row-value {
    font-size: 14px;
    color: var(--text-regular);
    text-align: right;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.theme-section {
  margin-top: 16px;

  .section-label {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0 0 12px 4px;
  }
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.sync-stats {
  display: flex;
  gap: 10px;
  margin-top: 12px;

  .stat-item {
    flex: 1;
    min-width: 0;
    padding: 12px 8px;
    background: var(--bg-secondary);
    border-radius: 10px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

    .stat-title {
      font-size: 11px;
      color: var(--text-secondary);
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .stat-value {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
    }
  }
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .note-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--bg-secondary);
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

    .note-name-input {
      flex: 1;
      min-width: 0;
    }
  }

  .add-note-btn {
    width: 100%;
    margin-top: 4px;
  }
}

// 主题选择器
.theme-picker {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;

  .theme-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px;
    border-radius: 8px;
    border: 2px solid transparent;
    background: var(--bg-secondary);
    cursor: pointer;
    transition: all 0.2s ease;

    &:active {
      transform: scale(0.96);
    }

    &.active {
      border-color: var(--primary-color);
      background: var(--primary-light);

      .theme-name {
        color: var(--primary-color);
        font-weight: 600;
      }
    }

    .theme-preview {
      width: 56px;
      height: 36px;
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      border: 1px solid var(--border-lighter);

      .preview-sidebar {
        width: 12px;
        height: 100%;
        flex-shrink: 0;
      }

      .preview-content {
        flex: 1;
        display: flex;
        flex-direction: column;

        .preview-header {
          height: 8px;
          width: 100%;
          border-bottom: 1px solid;
          flex-shrink: 0;
        }

        .preview-body {
          flex: 1;
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
      }
    }

    .preview-line {
      height: 2px;
      border-radius: 1px;
      &.short { width: 60%; }
      &.mid { width: 80%; }
    }

    .theme-name {
      font-size: 12px;
      color: var(--text-regular);
    }
  }
}

.data-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.data-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

  .action-info {
    flex: 1;
    min-width: 0;

    .action-title {
      font-size: 15px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .action-desc {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.4;
    }
  }

  &.danger .action-title {
    color: var(--danger-color);
  }
}

.text-secondary {
  color: var(--text-secondary);
}

// ---- 提醒管理区域样式 ----
.reminder-section {
  margin-top: 16px;
}

// ---- 提醒管理样式 ----
.reminder-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

  .section-label {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0 0 12px 0;
  }

  .empty-hint {
    color: var(--text-secondary);
    font-size: 14px;
    text-align: center;
    padding: 16px 0;
  }

  .reminder-list {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .reminder-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      background: var(--bg-tertiary);
      border-radius: 10px;

      .reminder-info {
        flex: 1;
        min-width: 0;

        .reminder-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          display: block;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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
    gap: 10px;

    .auto-remind-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      background: var(--bg-tertiary);
      border-radius: 10px;

      .note-info {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;

        .note-name {
          font-size: 14px;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .note-remind-controls {
        display: flex;
        align-items: center;
        gap: 8px;

        .advance-hint {
          font-size: 12px;
          color: var(--text-secondary);
          white-space: nowrap;
        }
      }
    }
  }
}
</style>