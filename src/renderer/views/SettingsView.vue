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
              <el-color-picker v-model="note.color" size="small" />
              <el-input v-model="note.name" size="small" class="category-name-input" />
              <el-button
                type="danger"
                size="small"
                :icon="Delete"
                circle
                @click="deleteNote(note.id)"
              />
            </div>
            <el-button type="primary" :icon="Plus" @click="addNote">添加便签</el-button>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Delete, Plus, Download, Upload, ArrowRight, Connection, User, Tickets, Setting, Brush, FolderOpened } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTimeBlockStore } from '@stores/timeBlock'

const router = useRouter()
const store = useTimeBlockStore()

// 移动端判断
const isMobile = ref(false)
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 799
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
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

// 数据同步方法
function syncNow() {
  if (!isOnline.value) {
    ElMessage.warning('当前离线模式，无法同步')
    return
  }
  ElMessage.info('正在同步数据...')
  // 模拟同步
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

function addNote() {
  const id = `note-${Date.now()}`
  store.notes.push({
    id,
    name: '新便签',
    color: '#909399'
  })
}

function deleteNote(id) {
  const idx = store.notes.findIndex(n => n.id === id)
  if (idx !== -1) {
    store.notes.splice(idx, 1)
  }
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
</style>
