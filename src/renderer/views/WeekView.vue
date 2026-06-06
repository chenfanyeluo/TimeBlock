<template>
  <div class="view-container">
    <div class="view-header">
      <h2>周视图</h2>
      <div class="date-nav">
        <el-button @click="prevWeek" :icon="ArrowLeft" circle />
        <span class="current-date">{{ weekRange }}</span>
        <el-button @click="nextWeek" :icon="ArrowRight" circle />
        <el-button type="primary" @click="goToday">本周</el-button>
      </div>
    </div>

    <div class="week-view-content">
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
        >
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

const store = useTimeBlockStore()
const currentWeekStart = ref(dayjs().startOf('week').add(1, 'day'))
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
  currentWeekStart.value = dayjs().startOf('week').add(1, 'day')
}

function updateBlock(id, updates) {
  store.updateBlock(id, updates)
}
</script>

<style lang="scss" scoped>
.week-view-content {
  display: flex;
  flex-direction: column;
  height: calc(100% - 60px);
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
  flex: 1;
  overflow: auto;
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

.date-nav {
  display: flex;
  align-items: center;
  gap: 12px;

  .current-date {
    font-size: 16px;
    font-weight: 500;
    min-width: 200px;
    text-align: center;
  }
}
</style>
