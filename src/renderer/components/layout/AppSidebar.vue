<template>
  <aside class="sidebar">
    <div class="logo">
      <el-icon :size="28" color="#fff"><Clock /></el-icon>
      <span class="logo-text">TimeBlock</span>
    </div>
    <nav class="nav-menu">
      <router-link
        v-for="route in menuRoutes"
        :key="route.path"
        :to="route.path"
        :class="['nav-item', { active: $route.path === route.path }]"
      >
        <el-icon :size="18">
          <component :is="route.meta.icon" />
        </el-icon>
        <span>{{ route.meta.title }}</span>
      </router-link>
    </nav>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import router from '../../router'

const $route = useRoute()

const menuRoutes = computed(() =>
  router.getRoutes().filter(r => r.meta?.title)
)
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  .logo-text {
    color: #fff;
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
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  transition: all 0.3s;
  cursor: pointer;

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.05);
  }

  &.active {
    color: #fff;
    background: var(--primary-color);
  }
}
</style>
