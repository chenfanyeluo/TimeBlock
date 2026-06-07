<template>
  <div class="view-container">
    <div class="view-header">
      <h2>设置</h2>
    </div>

    <div class="settings-content">
      <el-tabs type="border-card">
        <el-tab-pane label="数据同步">
          <div class="sync-info">
            <el-alert title="双数据库同步方案" type="info" :closable="false" show-icon>
              <template #default>
                <p>本地使用 SQLite 存储，云端使用 MySQL 存储，支持双向同步。</p>
              </template>
            </el-alert>
          </div>
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

        <el-tab-pane label="分类管理">
          <div class="category-list">
            <div
              v-for="cat in categories"
              :key="cat.id"
              class="category-item"
            >
              <el-color-picker v-model="cat.color" size="small" />
              <el-input v-model="cat.name" size="small" class="category-name-input" />
              <el-button
                type="danger"
                size="small"
                :icon="Delete"
                circle
                @click="deleteCategory(cat.id)"
              />
            </div>
            <el-button type="primary" :icon="Plus" @click="addCategory">添加分类</el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane label="外观设置">
          <el-form label-width="120px" class="settings-form">
            <el-form-item label="主题">
              <el-radio-group v-model="theme">
                <el-radio-button label="light">浅色</el-radio-button>
                <el-radio-button label="dark">深色</el-radio-button>
                <el-radio-button label="auto">跟随系统</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="时间粒度">
              <el-radio-group v-model="timeGranularity">
                <el-radio-button label="5">5分钟</el-radio-button>
                <el-radio-button label="15">15分钟</el-radio-button>
                <el-radio-button label="30">30分钟</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="默认视图">
              <el-radio-group v-model="defaultView">
                <el-radio-button label="day">日视图</el-radio-button>
                <el-radio-button label="week">周视图</el-radio-button>
                <el-radio-button label="month">月视图</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="数据管理">
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
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Delete, Plus, Download, Upload } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTimeBlockStore } from '@stores/timeBlock'

const store = useTimeBlockStore()

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
const theme = ref('light')
const timeGranularity = ref('15')
const defaultView = ref('day')

const categories = computed(() => store.categories)

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

function addCategory() {
  const id = `custom-${Date.now()}`
  store.categories.push({
    id,
    name: '新分类',
    color: '#909399'
  })
}

function deleteCategory(id) {
  const idx = store.categories.findIndex(c => c.id === id)
  if (idx !== -1) {
    store.categories.splice(idx, 1)
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
  background: #f8f9fa;
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
</style>
