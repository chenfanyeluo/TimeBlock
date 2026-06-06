<template>
  <div class="app-container">
    <AppSidebar />
    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import AppSidebar from './components/layout/AppSidebar.vue'
</script>

<style lang="scss" scoped>
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;

  .main-content {
    flex: 1;
    overflow: auto;
    background: var(--bg-primary);
  }
}
</style>
