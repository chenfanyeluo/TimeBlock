<template>
  <div class="app-container" :class="{ 'is-mobile': isMobile }">
    <!-- 桌面端布局：侧边栏 + 主内容 -->
    <template v-if="isDesktop">
      <AppSidebar />
      <div class="main-content">
        <router-view />
      </div>
    </template>

    <!-- 移动端布局：主内容 + 底部 TabBar -->
    <template v-if="isMobile">
      <div class="main-content mobile-content">
        <router-view />
      </div>
      <MobileTabBar />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { App } from '@capacitor/app'
import { platformInfo, database } from '@shared/platform'
import { initReminderService } from './services/reminder'
import AppSidebar from './components/layout/AppSidebar.vue'
import MobileTabBar from './components/layout/MobileTabBar.vue'

// 响应式窗口宽度（用于 Web 端动态切换布局）
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)

// 判断是否显示桌面端布局
const isDesktop = computed(() => {
  // Capacitor 移动端：强制移动端布局
  if (platformInfo.isCapacitor) return false

  // Electron：强制桌面端布局
  if (platformInfo.isElectron) return true

  // Web：根据窗口宽度动态判断（≥768px 为桌面端）
  return windowWidth.value >= 768
})

// 判断是否显示移动端布局
const isMobile = computed(() => !isDesktop.value)

/**
 * 应用暂停时保存数据（进入后台）
 */
async function handleAppPause() {
  console.log('[App] 应用暂停，保存数据库...')
  try {
    // ⚠️ 性能优化：应用暂停时立即执行 checkpoint（immediate=true）
    await database.checkpoint(true)
    console.log('[App] ✅ 数据已持久化')
  } catch (err) {
    console.error('[App] ❌ 数据持久化失败:', err)
  }
}

/**
 * 应用退出时关闭数据库
 */
async function handleAppExit() {
  console.log('[App] 应用退出，关闭数据库...')
  try {
    // ⚠️ 性能优化：应用退出时立即执行 checkpoint（immediate=true）
    await database.checkpoint(true)
    // 关闭数据库连接
    await database.close()
    console.log('[App] ✅ 数据库已关闭')
  } catch (err) {
    console.error('[App] ❌ 数据库关闭失败:', err)
  }
}

// 应用启动时初始化数据库
onMounted(async () => {
  // 初始化数据库（Electron/Capacitor 平台）
  console.log('[App] 开始初始化数据库...')
  console.log('[App] 当前平台:', platformInfo)

  try {
    const success = await database.init()
    if (success) {
      console.log('[App] ✅ 数据库初始化成功')

      // 验证数据库可用性
      const isValid = await database.validateDatabase()
      if (isValid) {
        console.log('[App] ✅ 数据库验证成功')

        // 验证关键表是否存在
        try {
          const tablesResult = await database.query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'notes', 'time_blocks', 'reminders', 'sync_logs', 'statistics');",
            []
          )
          const existingTables = tablesResult.map(row => row.name)
          const requiredTables = ['users', 'notes', 'time_blocks', 'reminders']
          const missingTables = requiredTables.filter(t => !existingTables.includes(t))

          if (missingTables.length > 0) {
            console.error('[App] ❌ 关键表缺失:', missingTables)
            console.error('[App] 提醒功能将无法正常工作')
          } else {
            console.log('[App] ✅ 所有关键表已存在:', existingTables)
          }
        } catch (err) {
          console.error('[App] 表验证失败:', err)
        }

        // 获取数据库详细信息（调试）
        const debugInfo = await database.getDebugInfo()
        console.log('[App] 数据库详细信息:', debugInfo)

        // 数据库就绪后启动提醒服务
        try {
          await initReminderService()
          console.log('[App] ✅ 提醒服务已启动')
        } catch (reminderErr) {
          console.error('[App] ❌ 提醒服务启动失败:', reminderErr)
        }
      } else {
        console.error('[App] ❌ 数据库验证失败')
      }
    } else {
      console.warn('[App] ⚠️ 数据库初始化失败或不支持')
      console.warn('[App] 平台可能不支持本地数据库（Web端）')
    }
  } catch (err) {
    console.error('[App] ❌ 数据库初始化异常:', err)
    console.error('[App] 错误堆栈:', err.stack)
  }

  // Capacitor 移动端：监听应用生命周期事件
  if (platformInfo.isCapacitor) {
    // 应用暂停（进入后台）
    App.addListener('appPause', handleAppPause)

    // 应用退出（关闭应用）
    App.addListener('appExit', handleAppExit)

    console.log('[App] 已注册应用生命周期监听器')
  }

  // Web 端监听窗口尺寸变化
  if (!platformInfo.isElectron && !platformInfo.isCapacitor) {
    window.addEventListener('resize', () => {
      windowWidth.value = window.innerWidth
    })
  }
})

// 应用卸载时清理资源
onUnmounted(async () => {
  // 移除 Capacitor 事件监听器
  if (platformInfo.isCapacitor) {
    App.removeAllListeners()
    console.log('[App] 已移除应用生命周期监听器')
  }
  
  // 关闭数据库连接
  if (platformInfo.isCapacitor) {
    await handleAppExit()
  }
})
</script>

<style lang="scss" scoped>
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;

  &.is-mobile {
    flex-direction: column;
  }

  .main-content {
    flex: 1;
    overflow: auto;
    background: var(--bg-primary);
  }

  // 移动端主内容区域（预留底部 TabBar 空间 + 安全区域）
  .mobile-content {
    padding-bottom: 56px; // TabBar 高度
    padding-bottom: calc(56px + env(safe-area-inset-bottom)); // iOS/Android 安全区域（底部导航键留空）
  }
}
</style>
