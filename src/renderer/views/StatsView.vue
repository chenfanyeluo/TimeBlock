<template>
  <div class="view-container stats-view-wrapper">
    <div class="view-header">
      <h2>统计</h2>
      <!-- 统计模式切换：周 / 月 / 年 -->
      <div class="mode-tabs">
        <el-radio-group v-model="activeMode" size="default">
          <el-radio-button value="week">周统计</el-radio-button>
          <el-radio-button value="month">月统计</el-radio-button>
          <el-radio-button value="year">年统计</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="stats-content">
      <!-- 周统计 -->
      <WeekView v-if="activeMode === 'week'" :hide-header="true" />

      <!-- 月统计 -->
      <MonthView v-if="activeMode === 'month'" :hide-header="true" />

      <!-- 年统计 -->
      <YearView v-if="activeMode === 'year'" :hide-header="true" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import WeekView from '@views/WeekView.vue'
import MonthView from '@views/MonthView.vue'
import YearView from '@views/YearView.vue'

const activeMode = ref('month') // 默认显示月统计
</script>

<style lang="scss" scoped>
.stats-view-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px 12px;
  flex-shrink: 0;

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.mode-tabs {
  :deep(.el-radio-group) {
    .el-radio-button__inner {
      padding: 8px 20px;
    }
  }
}

.stats-content {
  flex: 1;
  overflow: auto;
  padding: 0 4px;
}
</style>
