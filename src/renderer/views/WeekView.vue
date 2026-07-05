<template>
  <div class="week-view-content">
    <!-- 周导航 -->
    <div class="week-toolbar">
      <div class="week-nav">
        <el-button @click="prevWeek" :icon="ArrowLeft" circle size="small" />
        <span class="current-week">{{ weekRange }}</span>
        <el-button @click="nextWeek" :icon="ArrowRight" circle size="small" />
        <el-button type="primary" size="small" @click="goToday">本周</el-button>
      </div>
    </div>

    <!-- 周网格内容区 -->
    <div class="week-grid-card">
      <div class="week-header">
        <div class="time-column-header"></div>
        <div
          v-for="day in weekDays"
          :key="day.date"
          class="day-header"
          :class="{ today: day.isToday }"
        >
          <div class="day-name">{{ day.name }}</div>
          <div class="day-date">{{ day.dateStr }}</div>
        </div>
      </div>

      <div class="week-body">
        <div class="time-column">
          <div v-for="hour in 24" :key="hour - 1" class="time-label">
            {{ String(hour - 1).padStart(2, '0') }}:00
          </div>
        </div>

        <div
          v-for="day in weekDays"
          :key="day.date"
          class="day-column"
          :class="{ today: day.isToday }"
        >
          <!-- 移动端日期标题 -->
          <div class="day-title-mobile">
            <span class="day-name-mobile">{{ day.name }}</span>
            <span class="day-date-mobile">{{ day.dateStr }}</span>
          </div>

          <div v-for="hour in 24" :key="hour - 1" class="hour-cell"></div>

          <TimeBlockItem
            v-for="block in getDayBlocks(day.date)"
            :key="block.id"
            :block="block"
            :hour-height="hourHeight"
            @update="(updates) => updateBlock(block.id, updates)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import TimeBlockItem from '@components/TimeBlockItem.vue'
import { useTimeBlockStore } from '@stores/timeBlock'

dayjs.locale('zh-cn')

const props = defineProps({
  hideHeader: { type: Boolean, default: false }
})

const store = useTimeBlockStore()
const currentWeekStart = ref(dayjs().startOf('isoWeek'))
const hourHeight = 50

const weekRange = computed(() => {
  const start = currentWeekStart.value
  const end = start.add(6, 'day')
  return `${start.format('MM月DD日')} - ${end.format('MM月DD日')}`
})

const weekDays = computed(() => {
  const days = []
  const start = currentWeekStart.value
  const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

  for (let i = 0; i < 7; i++) {
    const date = start.add(i, 'day')
    days.push({
      name: dayNames[i],
      date: date.format('YYYY-MM-DD'),
      dateStr: date.format('MM/DD'),
      isToday: date.isSame(dayjs(), 'day')
    })
  }
  return days
})

function getDayBlocks(date) {
  return store.getBlocksByDate(date)
}

function prevWeek() {
  currentWeekStart.value = currentWeekStart.value.subtract(7, 'day')
}

function nextWeek() {
  currentWeekStart.value = currentWeekStart.value.add(7, 'day')
}

function goToday() {
  currentWeekStart.value = dayjs().startOf('isoWeek')
}

function updateBlock(id, updates) {
  store.updateBlock(id, updates)
}
</script>

<style lang="scss" scoped>
// ---- 外层容器(与 MonthView / YearView 统一) ----
.week-view-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  overflow: auto;
}

// ---- 周导航工具栏(与 MonthView / YearView 统一) ----
.week-toolbar {
  display: flex;
  align-items: center;
}

.week-nav {
  display: flex;
  align-items: center;
  gap: 10px;

  .current-week {
    font-size: 16px;
    font-weight: 600;
    min-width: 180px;
    text-align: center;
  }
}

// ---- 周网格卡片(类似 MonthView 的 calendar-card) ----
.week-grid-card {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;
}

.week-header {
  display: flex;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.time-column-header {
  width: var(--timeline-width);
  flex-shrink: 0;
  border-right: 1px solid var(--border-light);
}

.day-header {
  flex: 1;
  text-align: center;
  padding: 12px;
  border-right: 1px solid var(--border-light);

  &.today {
    background: var(--primary-light);

    .day-date {
      color: var(--primary-color);
      font-weight: 600;
    }
  }

  .day-name {
    font-size: 14px;
    color: var(--text-regular);
    margin-bottom: 4px;
  }

  .day-date {
    font-size: 18px;
    font-weight: 500;
  }
}

.week-body {
  display: flex;
}

.time-column {
  width: var(--timeline-width);
  flex-shrink: 0;
  border-right: 1px solid var(--border-light);
}

.time-label {
  height: 50px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 8px;
  font-size: 11px;
  color: var(--text-secondary);
}

.day-column {
  flex: 1;
  position: relative;
  border-right: 1px solid var(--border-light);
  min-height: 1200px;
}

.hour-cell {
  height: 50px;
  border-bottom: 1px solid var(--border-light);

  &:hover {
    background: var(--bg-hover);
  }
}

// =============================================
// 移动端竖屏布局优化
// =============================================
@media screen and (max-width: 799px) {
  .week-view-content {
    gap: 12px;
    padding: 8px;
  }

  .week-nav {
    gap: 6px;

    .current-week {
      font-size: 14px;
      min-width: 140px;
    }
  }

  // 周网格改为纵向堆叠布局
  .week-grid-card {
    // 改为纵向堆叠容器
    .week-header {
      display: none; // 移动端隐藏横向表头
    }

    .week-body {
      flex-direction: column; // 改为纵向排列
      gap: 12px;
      padding: 8px;
    }

    .time-column {
      display: none; // 移动端隐藏时间列,每个day-card内部显示时间轴
    }

    // 每天改为独立卡片
    .day-column {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--border-light);
      min-height: auto;
      margin-bottom: 12px;
      border-radius: 8px;
      background: var(--bg-primary);
      padding: 8px;
      position: relative;

      // 移动端日期标题(只在移动端显示)
      .day-title-mobile {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        border-bottom: 1px solid var(--border-lighter);
        margin-bottom: 8px;

        .day-name-mobile {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .day-date-mobile {
          font-size: 12px;
          color: var(--text-secondary);
        }
      }

      // 今天特殊样式
      &.today .day-title-mobile {
        background: var(--primary-light);

        .day-name-mobile {
          color: var(--primary-color);
        }

        .day-date-mobile {
          color: var(--primary-color);
          font-weight: 600;
        }
      }

      &:last-child {
        border-bottom: none;
        margin-bottom: 0;
      }
    }
  }

  // 时间标签优化
  .time-label {
    height: 40px;
    font-size: 10px;
  }

  // 小时格子优化
  .hour-cell {
    height: 40px;
  }
}

// PC端隐藏移动端日期标题
@media screen and (min-width: 800px) {
  .day-title-mobile {
    display: none;
  }
}

// 超小屏幕
@media screen and (max-width: 480px) {
  .week-nav {
    .current-week {
      font-size: 12px;
      min-width: 100px;
    }
  }

  .week-grid-card {
    .day-column {
      padding: 6px;
      margin-bottom: 8px;

      &:before {
        padding: 6px 8px;
        font-size: 12px;
      }
    }
  }
}
</style>
