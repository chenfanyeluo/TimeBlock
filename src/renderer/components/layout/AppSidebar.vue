<template>
  <aside class="sidebar">
    <div class="logo">
      <el-icon :size="28" color="var(--sidebar-text)"><Clock /></el-icon>
      <span class="logo-text">TimeBlock</span>
    </div>
    <nav class="nav-menu">
      <router-link
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        :class="['nav-item', { active: $route.path === item.path }]"
      >
        <el-icon :size="18">
          <component :is="item.icon" />
        </el-icon>
        <span>{{ item.label }}</span>
      </router-link>
    </nav>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Clock, EditPen, DataAnalysis, Setting } from '@element-plus/icons-vue'

const $route = useRoute()

// 侧边栏菜单项（固定三项：记录 / 统计 / 设置�?
const menuItems = computed(() => [
  { path: '/record', label: '记录', icon: EditPen },
  { path: '/stats', label: '统计', icon: DataAnalysis },
  { path: '/settings', label: '设置', icon: Setting }
])
</script>

<style lang="scss" scoped>
.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-sidebar);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.logo {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-bottom: 1px solid var(--sidebar-border);

  .logo-text {
    color: var(--sidebar-text);
    font-size: 18px;
    font-weight: 600;
  }
}

.nav-menu {
  padding: 16px 0;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  color: var(--sidebar-text);
  text-decoration: none;
  transition: all 0.3s;
  cursor: pointer;

  &:hover {
    color: var(--text-on-primary);
    background: var(--bg-hover-soft);
  }

  &.active {
    color: var(--text-on-primary);
    background: var(--primary-color);
  }
}
</style>
