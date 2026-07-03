<template>
  <div class="month-view-content">
    <!-- 月份导航栏 -->
    <div class="month-toolbar">
      <div class="month-nav">
        <el-button @click="prevMonth" :icon="ArrowLeft" circle size="small" />
        <span class="current-month">{{ currentMonthStr }}</span>
        <el-button @click="nextMonth" :icon="ArrowRight" circle size="small" />
        <el-button type="primary" size="small" @click="goToday">本月</el-button>
      </div>
    </div>

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
          <div class="stat-label">主要时间</div>
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

      <el-card class="calendar-card">
        <template #header>
          <div class="calendar-header">
            <span>月日历</span>
            <el-select
              v-model="selectedNoteId"
              size="small"
              placeholder="全部便签"
              style="width: 140px"
              clearable
            >
              <el-option
                v-for="note in notes"
                :key="note.id"
                :label="note.name"
                :value="note.id"
              >
                <span class="note-option">
                  <span class="note-dot" :style="{ background: note.color }"></span>
                  {{ note.name }}
                </span>
              </el-option>
            </el-select>
          </div>
        </template>

        <!-- 月日历网格 -->
        <div class="month-calendar">
          <!-- 星期标题行 -->
          <div class="cal-weekdays">
            <span v-for="wd in weekdayLabels" :key="wd" class="cal-weekday">{{ wd }}</span>
          </div>

          <!-- 日期格子：双模式切换 -->
          <!-- 模式A：全部便签 - 显示每日Top3便签分布 -->
          <div v-if="!selectedNoteId" class="cal-grid cal-grid-distribution">
            <div
              v-for="cell in calendarCells"
              :key="cell.key"
              class="cal-cell"
              :class="{
                'other-month': !cell.isCurrentMonth,
                'today': cell.isToday,
                'has-data': cell.topNotes.length > 0
              }"
              :style="!cell.isCurrentMonth ? {
                background: 'var(--bg-tertiary)',
                '--day-color': 'var(--text-placeholder)',
                '--hours-color': 'var(--text-secondary)'
              } : {}"
            >
              <div class="cal-cell-header">
                <span class="cal-day-num">{{ cell.dayNum }}</span>
                <span v-if="cell.totalHours > 0" class="cal-hours">{{ cell.totalHours }}h</span>
              </div>

              <!-- 便签分布区域 -->
              <div v-if="cell.topNotes.length > 0" class="cal-dist-area">
                <!-- #1 主色块：面积按占比放大，显示名称 -->
                <div
                  class="dist-primary"
                  :style="{
                    background: cell.topNotes[0].color,
                    flex: Math.max(1, Math.round(cell.topNotes[0].ratio * 10))
                  }"
                  :title="`${cell.topNotes[0].name} ${cell.topNotes[0].hours.toFixed(1)}h`"
                >
                  <span class="dist-primary-name">{{ cell.topNotes[0].name }}</span>
                </div>
                <!-- #2 #3 小色点 -->
                <div class="dist-minors">
                  <span
                    v-for="(note, ni) in cell.topNotes.slice(1)"
                    :key="ni"
                    class="dist-dot"
                    :style="{ background: note.color }"
                    :title="`${note.name} ${note.hours.toFixed(1)}h`"
                  ></span>
                </div>
              </div>
            </div>
          </div>

          <!-- 模式B：单便签 - GitHub风格热力图 -->
          <div v-else class="cal-grid cal-grid-heatmap">
            <div
              v-for="cell in heatCells"
              :key="cell.key"
              class="cal-cell heat-cell"
              :class="{
                'other-month': !cell.isCurrentMonth,
                'today': cell.isToday
              }"
              :style="{
                background: cell.heatColor,
                ...( !cell.isCurrentMonth ? { '--heat-day-color': 'var(--text-placeholder)' } : {} )
              }"
              :title="cell.tooltip"
            >
              <span class="heat-day-num">{{ cell.dayNum }}</span>
            </div>
          </div>
        </div>
      </el-card>
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

// 便签列表 & 选中的便签（用于日历筛选）
const notes = computed(() => store.notes)
const selectedNoteId = ref(null) // null = 全部便签

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
    const key = block.noteId || 'other'
    counts[key] = (counts[key] || 0) + 1
  })
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top ? store.getNoteName(top[0]) : '-'
})

/** 读取 CSS 变量的实际计算值（ECharts 不解析 var() 字符串） */
function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const pieOption = computed(() => {
  const data = {}
  monthBlocks.value.forEach(block => {
    const start = timeToMinutes(block.startTime)
    const end = timeToMinutes(block.endTime)
    const hours = (end - start) / 60
    const key = block.noteId || 'other'
    data[key] = (data[key] || 0) + hours
  })

  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: '0%' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: getCssVar('--chart-border'), borderWidth: 2 },
      label: { show: false },
      data: Object.entries(data).map(([key, value]) => ({
        name: store.getNoteName(key),
        value: value.toFixed(1),
        itemStyle: { color: store.getNoteColor(key) }
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

// ---- 月日历数据 ----

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

// 获取选中便签的颜色（用于热力图）
const selectedNoteColor = computed(() => {
  if (!selectedNoteId.value) return null
  const note = notes.value.find(n => n.id === selectedNoteId.value)
  return note?.color || '#909399'
})

/**
 * 模式A：全部便签 - 每日Top3便签分布
 * 按时长聚合每个便签，取前3（#1显示大色块+名称，#2/#3仅色点）
 * 相等时长时按名称排序保证稳定
 */
const calendarCells = computed(() => {
  const year = currentMonth.value.year()
  const month = currentMonth.value.month()
  const firstDay = dayjs(new Date(year, month, 1))
  const daysInMonth = firstDay.daysInMonth()

  let startDow = firstDay.day()
  startDow = startDow === 0 ? 6 : startDow - 1

  const today = dayjs().format('YYYY-MM-DD')
  const cells = []

  // 上月填充
  const prevMonth = currentMonth.value.subtract(1, 'month')
  const prevDaysInMonth = prevMonth.daysInMonth()
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({
      key: `prev-${i}`,
      dayNum: prevDaysInMonth - i,
      isCurrentMonth: false,
      isToday: false,
      totalHours: 0,
      topNotes: []
    })
  }

  // 当月每天：按便签聚合 -> 排序 -> 取Top3
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayBlocks = store.getBlocksByDate(dateStr)

    // 按便签聚合时长
    const noteMap = new Map() // key: noteId/noteName -> { id, name, color, hours }
    let totalHours = 0

    dayBlocks.forEach(block => {
      const startMin = timeToMinutes(block.startTime)
      const endMin = timeToMinutes(block.endTime)
      const hours = (endMin - startMin) / 60
      totalHours += hours

      const key = block.noteId || block.noteName || block.taskName || 'other'
      const name = block.noteName || block.taskName || ''
      const color = block.noteColor || '#909399'

      if (noteMap.has(key)) {
        noteMap.get(key).hours += hours
      } else {
        noteMap.set(key, { id: key, name, color, hours })
      }
    })

    // 降序排列（时长优先，相同时按名称字典序保证稳定）
    const sorted = Array.from(noteMap.values()).sort((a, b) => {
      if (Math.abs(b.hours - a.hours) < 0.01) return a.name.localeCompare(b.name)
      return b.hours - a.hours
    })

    // 取Top3，计算占比
    const topNotes = sorted.slice(0, 3).map(item => ({
      ...item,
      ratio: totalHours > 0 ? item.hours / totalHours : 0
    }))

    cells.push({
      key: dateStr,
      dayNum: d,
      isCurrentMonth: true,
      isToday: dateStr === today,
      totalHours: parseFloat(totalHours.toFixed(1)),
      topNotes
    })
  }

  // 下月填充
  const totalFilled = startDow + daysInMonth
  const remaining = totalFilled % 7 === 0 ? 0 : 7 - (totalFilled % 7)
  for (let i = 1; i <= remaining; i++) {
    cells.push({
      key: `next-${i}`,
      dayNum: i,
      isCurrentMonth: false,
      isToday: false,
      totalHours: 0,
      topNotes: []
    })
  }

  return cells
})

/**
 * 模式B：单便签 - GitHub风格热力图
 * 每个格子颜色强度 = 该便签当日时长 / 月内该便签最大单日时长
 * 强度分为5级（0-4），用选中便签颜色的深浅表示
 */
const heatCells = computed(() => {
  if (!selectedNoteId.value) return []

  const year = currentMonth.value.year()
  const month = currentMonth.value.month()
  const firstDay = dayjs(new Date(year, month, 1))
  const daysInMonth = firstDay.daysInMonth()

  let startDow = firstDay.day()
  startDow = startDow === 0 ? 6 : startDow - 1

  const today = dayjs().format('YYYY-MM-DD')
  const baseColor = selectedNoteColor.value

  // 先收集每日该便签的时长，找出最大值
  const dailyHours = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayBlocks = store.getBlocksByDate(dateStr).filter(
      b => b.noteId === selectedNoteId.value
    )
    let hours = 0
    dayBlocks.forEach(block => {
      hours += (timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / 60
    })
    dailyHours.push({ dateStr, hours })
  }

  const maxHours = Math.max(...dailyHours.map(d => d.hours), 0.01) // 避免除零

  const cells = []
  let dayIdx = 0

  // 上月填充
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({
      key: `prev-${i}`,
      dayNum: firstDay.subtract(startDow - i, 'day').date(),
      isCurrentMonth: false,
      isToday: false,
      heatColor: 'transparent',
      tooltip: ''
    })
  }

  // 当月每天
  for (let d = 1; d <= daysInMonth; d++) {
    const { dateStr, hours } = dailyHours[dayIdx++]
    const level = hours <= 0 ? 0 : Math.min(4, Math.ceil((hours / maxHours) * 4))

    cells.push({
      key: dateStr,
      dayNum: d,
      isCurrentMonth: true,
      isToday: dateStr === today,
      heatColor: getHeatColor(baseColor, level),
      tooltip: hours > 0 ? `${dateStr} · ${hours.toFixed(1)}h` : `${dateStr} · 无记录`
    })
  }

  // 下月填充
  const totalFilled = startDow + daysInMonth
  const remaining = totalFilled % 7 === 0 ? 0 : 7 - (totalFilled % 7)
  for (let i = 1; i <= remaining; i++) {
    cells.push({
      key: `next-${i}`,
      dayNum: i,
      isCurrentMonth: false,
      isToday: false,
      heatColor: 'transparent',
      tooltip: ''
    })
  }

  return cells
})

/**
 * 根据基础色和强度等级(0-4)生成热力图颜色
 * level 0: 透明/无数据
 * level 1-4: 基础色的不同透明度/亮度
 */
function getHeatColor(hexColor, level) {
  if (level === 0) return 'var(--heat-empty-bg)' // 无数据底色

  // 解析 hex 为 RGB
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // 5级强度对应不同的混合比例（与白色混合实现浅→深）
  // level 1: 最浅(~85% white), level 4: 纯色 (0% white)
  const alphaMap = [0, 0.18, 0.40, 0.65, 0.90]
  const alpha = alphaMap[level] || 0.5

  // 使用 rgba 格式，保持基础色调
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

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
// ---- 月份导航工具栏(始终显示)----
.month-toolbar {
  display: flex;
  align-items: center;
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 10px;

  .current-month {
    font-size: 16px;
    font-weight: 600;
    min-width: 120px;
    text-align: center;
  }
}

.month-view-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  overflow: auto;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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

// =============================================
// 移动端竖屏布局优化
// =============================================
@media screen and (max-width: 799px) {
  .month-view-content {
    gap: 12px;
    padding: 8px;
  }

  .month-nav {
    gap: 6px;

    .current-month {
      font-size: 14px;
      min-width: 100px;
    }
  }

  // 统计卡片改为单列纵向堆叠
  .stats-cards {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .stat-card {
    padding: 12px;

    .stat-value {
      font-size: 22px;
      margin-bottom: 6px;
    }

    .stat-label {
      font-size: 12px;
    }
  }

  // 图表改为纵向排列
  .charts-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .chart-card {
    .chart {
      height: 240px; // 移动端降低高度
    }
  }

  // 月日历优化
  .calendar-card {
    .calendar-header {
      padding: 0 8px;

      span {
        font-size: 13px;
      }
    }

    // 日历网格保持7列,但优化样式
    .cal-grid {
      gap: 1px;
    }

    .cal-weekday {
      font-size: 11px;
      padding: 4px 0;
    }

    .cal-cell {
      min-height: 60px; // 稍微压缩高度
      padding: 2px 3px;

      .cal-day-num {
        font-size: 11px;
      }

      .cal-hours {
        font-size: 9px;
      }

      // 便签分布区域优化
      .cal-dist-area {
        flex-direction: column; // 改为纵向排列
        gap: 2px;
      }

      .dist-primary-name {
        font-size: 10px;
        padding: 2px 4px;
      }

      .dist-minors {
        flex-direction: row; // 小色点改为横向排列
        width: 100%;
        height: auto;
        gap: 2px;
        padding-top: 0;
      }

      .dist-dot {
        width: 8px;
        height: 8px;
      }
    }

    // 热力图优化
    &.cal-grid-heatmap .cal-cell {
      min-height: 30px;

      .heat-day-num {
        font-size: 8px;
      }
    }
  }
}

// 超小屏幕
@media screen and (max-width: 480px) {
  .month-nav {
    .current-month {
      font-size: 12px;
      min-width: 90px;
    }
  }

  .stat-card {
    padding: 10px;

    .stat-value {
      font-size: 18px;
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 11px;
    }
  }

  .chart-card {
    .chart {
      height: 200px;
    }
  }

  .calendar-card {
    .cal-cell {
      min-height: 50px;
      padding: 1px 2px;

      .cal-day-num {
        font-size: 10px;
      }

      .cal-hours {
        font-size: 8px;
      }

      .dist-primary-name {
        font-size: 9px;
        padding: 1px 2px;
      }

      .dist-dot {
        width: 6px;
        height: 6px;
      }
    }

    &.cal-grid-heatmap .cal-cell {
      min-height: 24px;

      .heat-day-num {
        font-size: 7px;
      }
    }
  }
}

// ---- 月日历样式 ----
.calendar-card {
  :deep(.el-card__body) {
    padding: 12px;
  }

  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .note-option {
    display: flex;
    align-items: center;
    gap: 8px;

    .note-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
  }

  .month-calendar {
    width: 100%;
  }

  .cal-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    margin-bottom: 4px;
  }

  .cal-weekday {
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    padding: 6px 0;
  }

  // ====== 网格公共 ======
  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }

  .cal-cell {
    min-height: 72px;
    border-radius: 4px;
    padding: 3px 4px;
    display: flex;
    flex-direction: column;
    transition: all 0.15s;

    &:hover {
      z-index: 1;
      box-shadow: var(--shadow-lg);
    }
  }

  // ====== 模式A：便签分布网格 ======
  &.cal-grid-distribution .cal-cell {
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);

    &.other-month {
      background: var(--bg-tertiary);

      .cal-day-num { color: var(--text-placeholder) !important; }
      .cal-hours { color: var(--text-secondary) !important; }
    }

    &.today {
      border-color: var(--primary-color);
      border-width: 1.5px;
      background: var(--primary-light);

      .cal-day-num {
        color: var(--primary-color);
        font-weight: 700;
      }
    }

    &.has-data {
      .cal-cell-header { margin-bottom: 2px; }
    }
  }

  .cal-cell-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .cal-day-num {
    font-size: 12px;
    font-weight: 500;
    color: var(--day-color, var(--text-primary));
    line-height: 1;
  }

  .cal-hours {
    font-size: 9px;
    color: var(--hours-color, var(--text-secondary));
    font-weight: 500;
    flex-shrink: 0;
  }

  // 便签分布区域
  .cal-dist-area {
    flex: 1;
    display: flex;
    gap: 3px;
    overflow: hidden;
  }

  // #1 主色块：面积按占比放大
  .dist-primary {
    border-radius: 8px;
    min-width: 0;
    overflow: hidden;
    cursor: default;

    &:hover { opacity: 0.88; }
  }

  .dist-primary-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-on-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 0 2px rgba(0, 0, 0, 0.18);
    line-height: 1.6;
    padding: 3px 6px;
    display: block;
  }

  // #2 #3 小色点
  .dist-minors {
    display: flex;
    flex-direction: column;
    gap: 2px;
    justify-content: flex-start;
    flex-shrink: 0;
    width: 30px;       // 固定宽度，防止被主色块挤压到 0
    padding-top: 1px;
  }

  .dist-dot {
    width: 100%;
    height: 30px;
    border-radius: 5px;
    flex-shrink: 0;
    cursor: default;
    transition: transform 0.15s;

    &:hover { transform: scale(1.2); }
  }

  // ====== 模式B：GitHub热力图 ======
  &.cal-grid-heatmap .cal-cell {
    min-height: 36px;
    aspect-ratio: 1;
    position: relative;
    border: none;
    cursor: default;

    &.other-month {
      opacity: 0.25;

      .heat-day-num { color: var(--text-placeholder); }
    }

    &.today {
      outline: 2px solid var(--text-primary);
      outline-offset: -1px;
      z-index: 2;
    }
  }

  .heat-day-num {
    position: absolute;
    top: 2px;
    left: 3px;
    font-size: 9px;
    font-weight: 600;
    color: var(--heat-day-color, var(--text-placeholder));
    line-height: 1;
    pointer-events: none;
  }
}
</style>
