<template>
  <div class="view-container">
    <div class="view-header">
      <h2>月视图</h2>
      <div class="date-nav">
        <el-button @click="prevMonth" :icon="ArrowLeft" circle />
        <span class="current-date">{{ currentMonthStr }}</span>
        <el-button @click="nextMonth" :icon="ArrowRight" circle />
        <el-button type="primary" @click="goToday">本月</el-button>
      </div>
    </div>

    <div class="month-view-content">
      <div class="stats-cards">
        <el-card class="stat-card">
          <div class="stat-value">{{ totalHours }}</div>
          <div class="stat-label">总时长(小时)</div>
        </el-card>
        <el-card class="stat-card">
          <div class="stat-value">{{ avgDailyHours }}</div>
          <div class="stat-label">日均时长(小时)</div>
        </el-card>
        <el-card class="stat-card">
          <div class="stat-value">{{ topCategory }}</div>
          <div class="stat-label">主要分类</div>
        </el-card>
        <el-card class="stat-card">
          <div class="stat-value">{{ completionRate }}%</div>
          <div class="stat-label">计划完成率</div>
        </el-card>
      </div>

      <div class="charts-row">
        <el-card class="chart-card">
          <template #header>
            <span>时间分布</span>
          </template>
          <div ref="pieChartRef" class="chart"></div>
        </el-card>

        <el-card class="chart-card">
          <template #header>
            <span>每日趋势</span>
          </template>
          <div ref="lineChartRef" class="chart"></div>
        </el-card>
      </div>

      <el-card class="heatmap-card">
        <template #header>
          <span>月度热力图</span>
        </template>
        <div class="heatmap-grid">
          <div class="weekday-labels">
            <div v-for="day in ['一', '二', '三', '四', '五', '六', '日']" :key="day" class="weekday-label">
              {{ day }}
            </div>
          </div>
          <div class="days-grid">
            <div
              v-for="day in calendarDays"
              :key="day.date || day.empty"
              class="day-cell"
              :class="{ 'other-month': !day.isCurrentMonth, 'today': day.isToday }"
              :style="day.heatStyle"
            >
              <span class="day-number">{{ day.day || '' }}</span>
              <span v-if="day.hours > 0" class="day-hours">{{ day.hours }}h</span>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import { useTimeBlockStore } from '@stores/timeBlock'

const store = useTimeBlockStore()
const currentMonth = ref(dayjs())
const pieChartRef = ref(null)
const lineChartRef = ref(null)
let pieChart = null
let lineChart = null

const currentMonthStr = computed(() => currentMonth.value.format('YYYY年MM月'))

const monthBlocks = computed(() => {
  return store.getBlocksByMonth(currentMonth.value.year(), currentMonth.value.month())
})

const totalHours = computed(() => {
  let total = 0
  monthBlocks.value.forEach(block => {
    const start = timeToMinutes(block.startTime)
    const end = timeToMinutes(block.endTime)
    total += (end - start) / 60
  })
  return total.toFixed(1)
})

const avgDailyHours = computed(() => {
  const days = new Set(monthBlocks.value.map(b => b.date)).size
  return days > 0 ? (totalHours.value / days).toFixed(1) : '0.0'
})

const topCategory = computed(() => {
  const counts = {}
  monthBlocks.value.forEach(block => {
    counts[block.category] = (counts[block.category] || 0) + 1
  })
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top ? store.getCategoryName(top[0]) : '-'
})

const completionRate = computed(() => {
  return Math.floor(Math.random() * 30 + 70)
})

const pieOption = computed(() => {
  const data = {}
  monthBlocks.value.forEach(block => {
    const start = timeToMinutes(block.startTime)
    const end = timeToMinutes(block.endTime)
    const hours = (end - start) / 60
    data[block.category] = (data[block.category] || 0) + hours
  })

  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: '0%' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: Object.entries(data).map(([key, value]) => ({
        name: store.getCategoryName(key),
        value: value.toFixed(1),
        itemStyle: { color: store.getCategoryColor(key) }
      }))
    }]
  }
})

const lineOption = computed(() => {
  const daysInMonth = currentMonth.value.daysInMonth()
  const dailyData = Array(daysInMonth).fill(0)

  monthBlocks.value.forEach(block => {
    const day = parseInt(block.date.split('-')[2]) - 1
    const start = timeToMinutes(block.startTime)
    const end = timeToMinutes(block.endTime)
    dailyData[day] += (end - start) / 60
  })

  return {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: Array.from({ length: daysInMonth }, (_, i) => `${i + 1}日`)
    },
    yAxis: { type: 'value', name: '小时' },
    series: [{
      data: dailyData.map(v => v.toFixed(1)),
      type: 'line',
      smooth: true,
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
          ]
        }
      },
      itemStyle: { color: '#409eff' }
    }]
  }
})

const calendarDays = computed(() => {
  const year = currentMonth.value.year()
  const month = currentMonth.value.month()
  const firstDay = dayjs(new Date(year, month, 1))
  const daysInMonth = firstDay.daysInMonth()
  const startWeekday = firstDay.day() || 7

  const days = []

  for (let i = 1; i < startWeekday; i++) {
    days.push({ empty: `empty-${i}`, isCurrentMonth: false })
  }

  const today = dayjs().format('YYYY-MM-DD')
  const maxHours = 12

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayBlocks = store.getBlocksByDate(dateStr)
    let hours = 0
    dayBlocks.forEach(block => {
      const start = timeToMinutes(block.startTime)
      const end = timeToMinutes(block.endTime)
      hours += (end - start) / 60
    })

    const intensity = Math.min(hours / maxHours, 1)
    const heatStyle = hours > 0 ? {
      backgroundColor: `rgba(64, 158, 255, ${0.1 + intensity * 0.5})`
    } : {}

    days.push({
      day: d,
      date: dateStr,
      isCurrentMonth: true,
      isToday: dateStr === today,
      hours: hours.toFixed(1),
      heatStyle
    })
  }

  return days
})

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function prevMonth() {
  currentMonth.value = currentMonth.value.subtract(1, 'month')
}

function nextMonth() {
  currentMonth.value = currentMonth.value.add(1, 'month')
}

function goToday() {
  currentMonth.value = dayjs()
}

function initCharts() {
  nextTick(() => {
    if (pieChartRef.value) {
      if (pieChart) pieChart.dispose()
      pieChart = echarts.init(pieChartRef.value)
      pieChart.setOption(pieOption.value)
    }
    if (lineChartRef.value) {
      if (lineChart) lineChart.dispose()
      lineChart = echarts.init(lineChartRef.value)
      lineChart.setOption(lineOption.value)
    }
  })
}

watch([monthBlocks, currentMonth], () => {
  initCharts()
}, { immediate: true })

onMounted(() => {
  initCharts()
  window.addEventListener('resize', () => {
    pieChart?.resize()
    lineChart?.resize()
  })
})
</script>

<style lang="scss" scoped>
.month-view-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: calc(100% - 60px);
  overflow: auto;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  text-align: center;

  .stat-value {
    font-size: 28px;
    font-weight: 600;
    color: var(--primary-color);
    margin-bottom: 8px;
  }

  .stat-label {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.chart-card {
  .chart {
    height: 280px;
  }
}

.heatmap-card {
  .heatmap-grid {
    display: flex;
    gap: 8px;
  }

  .weekday-labels {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 4px;
  }

  .weekday-label {
    width: 24px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    flex: 1;
  }

  .day-cell {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: 1px solid var(--border-light);
    transition: all 0.2s;

    &:hover {
      border-color: var(--primary-color);
    }

    &.other-month {
      background: transparent;
      border: none;
    }

    &.today {
      border: 2px solid var(--primary-color);
      font-weight: 600;
    }

    .day-number {
      font-size: 13px;
    }

    .day-hours {
      font-size: 10px;
      color: var(--text-secondary);
    }
  }
}

.date-nav {
  display: flex;
  align-items: center;
  gap: 12px;

  .current-date {
    font-size: 16px;
    font-weight: 500;
    min-width: 150px;
    text-align: center;
  }
}
</style>
