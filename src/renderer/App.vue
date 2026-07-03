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
import { platformInfo } from '@shared/platform'
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

// 监听窗口尺寸变化（仅 Web 端）
onMounted(() => {
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

  // 移动端主内容区域（预留底部 TabBar 空间）
  .mobile-content {
    padding-bottom: 56px; // TabBar 高度
    padding-bottom: calc(56px + env(safe-area-inset-bottom)); // iOS 安全区域
  }
}
</style>
