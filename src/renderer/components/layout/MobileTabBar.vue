<template>
  <nav class="mobile-tabbar">
    <router-link
      v-for="item in menuItems"
      :key="item.path"
      :to="item.path"
      class="tabbar-item"
      :class="{ active: $route.path === item.path }"
    >
      <el-icon :size="20">
        <component :is="item.icon" />
      </el-icon>
      <span class="tabbar-label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { EditPen, DataAnalysis, Setting } from '@element-plus/icons-vue'

const $route = useRoute()

const menuItems = computed(() => [
  { path: '/record', label: '记录', icon: EditPen },
  { path: '/stats', label: '统计', icon: DataAnalysis },
  { path: '/settings', label: '设置', icon: Setting }
])
</script>

<style lang="scss" scoped>
.mobile-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--bg-sidebar);
  border-top: 1px solid var(--sidebar-border);
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 1000;
  padding-bottom: env(safe-area-inset-bottom); // iOS 安全区域
}

.tabbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  text-decoration: none;
  color: var(--sidebar-text);
  transition: all 0.3s;

  .tabbar-label {
    font-size: 12px;
  }

  &:hover {
    color: var(--text-on-primary);
  }

  &.active {
    color: var(--primary-color);

    .el-icon {
      transform: scale(1.1);
    }
  }
}

// Capacitor 深色模式适配
@media (prefers-color-scheme: dark) {
  .mobile-tabbar {
    background: #1a1a1a;
  }
}
</style>