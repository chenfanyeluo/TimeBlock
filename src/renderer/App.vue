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
import { computed, onMounted, ref } from 'vue'
import { platformInfo, database } from '@shared/platform'
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
        
        // 获取数据库详细信息（调试）
        const debugInfo = await database.getDebugInfo()
        console.log('[App] 数据库详细信息:', debugInfo)
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
  
  // Web 端监听窗口尺寸变化
  if (!platformInfo.isElectron && !platformInfo.isCapacitor) {
    window.addEventListener('resize', () => {
      windowWidth.value = window.innerWidth
    })
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
