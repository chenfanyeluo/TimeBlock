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

// =============================================
// 移动端竖屏布局优化
// =============================================
@media screen and (max-width: 799px) {
  .stats-view-wrapper {
    height: 100%;
  }

  .view-header {
    padding: 12px 16px 8px;
    flex-direction: column; // 移动端改为纵向布局
    align-items: flex-start;
    gap: 12px;

    h2 {
      font-size: 16px;
    }

    .mode-tabs {
      width: 100%; // TabBar占满宽度

      :deep(.el-radio-group) {
        width: 100%;
        display: flex;
        justify-content: space-between;

        .el-radio-button {
          flex: 1;

          .el-radio-button__inner {
            width: 100%;
            padding: 8px 12px;
            font-size: 13px;
            text-align: center;
          }
        }
      }
    }
  }

  .stats-content {
    padding: 0 8px; // 增加内边距
  }
}

// 超小屏幕
@media screen and (max-width: 480px) {
  .view-header {
    padding: 10px 12px 6px;

    h2 {
      font-size: 15px;
    }

    .mode-tabs {
      :deep(.el-radio-group) {
        .el-radio-button__inner {
          padding: 6px 10px;
          font-size: 12px;
        }
      }
    }
  }

  .stats-content {
    padding: 0 4px;
  }
}
</style>
