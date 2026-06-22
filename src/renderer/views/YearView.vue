<template>
  <div class="year-view-content">
    <!-- 年导航栏 -->
    <div class="year-toolbar">
      <div class="year-nav">
        <el-button @click="prevYear" :icon="ArrowLeft" circle size="small" />
        <span class="current-year">{{ currentYearStr }}</span>
        <el-button @click="nextYear" :icon="ArrowRight" circle size="small" />
        <el-button type="primary" size="small" @click="goToday">今年</el-button>
      </div>
    </div>

    <!-- 概览卡片 -->
    <div class="stats-cards">
      <el-card class="stat-card">
        <div class="stat-value">{{ totalHours }}</div>
        <div class="stat-label">总时长(小时)</div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-value">{{ avgMonthlyHours }}</div>
        <div class="stat-label">月均时长(小时)</div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-value">{{ recordDays }}</div>
        <div class="stat-label">记录天数</div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-value">{{ topNoteName }}</div>
        <div class="stat-label">主要便签</div>
      </el-card>
    </div>

    <!-- 便签分布（始终显示，左侧饼图 + 右侧时间排行榜） -->
    <el-card class="distribution-card">
      <template #header><span>便签分布</span></template>
      <div class="distribution-body">
        <div ref="pieChartRef" class="chart pie-chart-area"></div>
        <div class="ranking-list">
          <div
            v-for="(item, idx) in noteRanking"
            :key="item.id"
            class="ranking-item"
          >
            <span class="rank-num" :class="{ 'top3': idx < 3 }">{{ idx + 1 }}</span>
            <span class="rank-dot" :style="{ background: item.color }"></span>
            <span class="rank-name" :title="item.name">{{ item.name }}</span>
            <span class="rank-hours">{{ item.hours }}h</span>
            <div class="rank-bar">
              <div class="rank-bar-fill" :style="{ width: item.percent + '%', background: item.color }"></div>
            </div>
          </div>
          <div v-if="noteRanking.length === 0" class="ranking-empty">暂无数据</div>
        </div>
      </div>
    </el-card>

    <!-- 月度趋势（在便签分布下方，标题随模式变化） -->
    <el-card class="chart-card bar-chart-card">
      <template #header>
        <span>{{ selectedNoteId ? `${store.getNoteName(selectedNoteId)} · 月度趋势` : '月度趋势' }}</span>
      </template>
      <div ref="barChartRef" class="chart"></div>
    </el-card>

    <!-- 年度热力日历 -->
    <el-card class="heatmap-card">
      <template #header>
        <div class="calendar-header">
          <span>年度日历</span>
          <div class="header-right">
            <!-- 便签筛选（放在热力图卡片内） -->
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
            <!-- 图例 -->
            <div class="heat-legend">
              <span>时长</span>
              <span v-for="lvl in 4" :key="lvl" class="legend-box" :style="{ background: getLegendColor(lvl) }"></span>
              <span>时间</span>
            </div>
          </div>
        </div>
      </template>

      <div class="year-heatmap">
        <!-- 12 个月份块，每个自包含：月份名 + 星期 + 格子网格 -->
        <div class="yhm-grid">
          <div
            v-for="(month, mi) in monthGrids"
            :key="mi"
            class="yhm-month-block"
          >
            <!-- 月份 -->
            <div class="yhm-month-name">{{ mi + 1 }}月</div>
            <!-- 星期标题 -->
            <div class="yhm-weekdays">
              <span v-for="wd in weekdayLabels" :key="wd" class="yhm-wd">{{ wd }}</span>
            </div>
            <!-- 格子网格 -->
            <div class="yhm-days-grid">
              <div
                v-for="(day, di) in month.days"
                :key="di"
                class="yhm-day"
                :class="{ 'empty': !day.dateStr, 'today': day.isToday, 'other-year': day.isOtherYear }"
                :style="{ background: day.heatColor }"
                :title="day.tooltip"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import { useTimeBlockStore } from '@stores/timeBlock'

/** 读取 CSS 变量的实际计算值（ECharts 不解析 var() 字符串） */
function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

defineProps({
  hideHeader: { type: Boolean, default: false }
})

const store = useTimeBlockStore()
const currentYear = ref(dayjs())
const barChartRef = ref(null)
const pieChartRef = ref(null)
let barChart = null
let pieChart = null

// 便签筛选
const notes = computed(() => store.notes)
const selectedNoteId = ref(null)

const currentYearStr = computed(() => `${currentYear.value.year()}年`)

// ---- 基础数据 ----

const yearBlocks = computed(() => {
  return store.getBlocksByYear(currentYear.value.year())
})

// 全部便签时：年度所有时间块；选中便签时：仅该便签的块
const filteredBlocks = computed(() => {
  if (!selectedNoteId.value) return yearBlocks.value
  return yearBlocks.value.filter(b => b.noteId === selectedNoteId.value)
})

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// ---- 概览指标 ----

const totalHours = computed(() => {
  let total = 0
  filteredBlocks.value.forEach(b => {
    total += (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)) / 60
  })
  return total.toFixed(1)
})

const avgMonthlyHours = computed(() => {
  const t = parseFloat(totalHours.value)
  return (t / 12).toFixed(1)
})

const recordDays = computed(() => {
  return new Set(filteredBlocks.value.map(b => b.date)).size
})

const topNoteName = computed(() => {
  if (selectedNoteId.value) return store.getNoteName(selectedNoteId.value)
  const counts = {}
  filteredBlocks.value.forEach(b => {
    const key = b.noteId || 'other'
    counts[key] = (counts[key] || 0) + 1
  })
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top ? store.getNoteName(top[0]) : '-'
})

// ---- ECharts 配置 ----

/** 月度趋势柱状图（单便签模式：单色柱；全部便签模式：分层堆叠柱） */
const barOption = computed(() => {
  // 单便签模式：保持原有单色柱状�?
  if (selectedNoteId.value) {
    const monthlyData = Array(12).fill(0)
    filteredBlocks.value.forEach(b => {
      const m = dayjs(b.date).month()
      monthlyData[m] += (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)) / 60
    })
    const note = notes.value.find(n => n.id === selectedNoteId.value)
    const barColor = note?.color || '#409eff'

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
        axisLabel: { fontSize: 11 }
      },
      yAxis: { type: 'value', name: '小时', minInterval: 1 },
      series: [{
        data: monthlyData.map(v => parseFloat(v.toFixed(1))),
        type: 'bar',
        barMaxWidth: 28,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: barColor },
            { offset: 1, color: lightenColor(barColor, 40) }
          ])
        }
      }]
    }
  }

  // ===== 全部便签模式：分层堆叠柱状图 =====
  // 按便签聚合每月时长
  const noteMonthlyMap = {} // key -> [12个月的时长]
  yearBlocks.value.forEach(b => {
    const m = dayjs(b.date).month()
    const hrs = (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)) / 60
    const key = b.noteId || 'other'
    if (!noteMonthlyMap[key]) noteMonthlyMap[key] = Array(12).fill(0)
    noteMonthlyMap[key][m] += hrs
  })
  
  // 按年度总时长降序排序
  const sortedNotes = Object.entries(noteMonthlyMap)
    .map(([key, monthly]) => ({
      key,
      name: store.getNoteName(key),
      color: store.getNoteColor(key),
      total: monthly.reduce((s, v) => s + v, 0),
      monthly: monthly.map(v => parseFloat(v.toFixed(1)))
    }))
    .sort((a, b) => b.total - a.total)
  
  // 反转：ECharts 堆叠柱中 series[0] 在底部，反转后小的在底、大的在顶
  const reversed = [...sortedNotes].reverse()

  const series = reversed.map((item, idx) => {
    const isTop = idx === reversed.length - 1
    return {
      name: item.name,
      type: 'bar',
      stack: 'total',
      barMaxWidth: 32,
      data: item.monthly,
      itemStyle: {
        color: item.color,
        borderRadius: isTop ? [4, 4, 0, 0] : 0
      },
      label: {
        show: isTop,
        position: 'top',
        formatter(params) {
          return (params.value || 0) > 0 ? params.seriesName : ''
        },
        fontSize: 10,
        color: getCssVar('--chart-label-color'),
        distance: 2
      }
    }
  })

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter(params) {
        if (!Array.isArray(params)) params = [params]
        let total = 0
        const lines = params.map(p => {
          total += p.value || 0
          return `${p.marker} ${p.seriesName}: <b>${p.value}h</b>`
        })
        lines.unshift(`<div style="margin-bottom:4px;font-weight:bold">${params[0].axisValue} · ${total.toFixed(1)}h</div>`)
        return lines.join('<br/>')
      }
    },
    grid: { left: '3%', right: '8%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      axisLabel: { fontSize: 11 }
    },
    yAxis: { type: 'value', name: '小时', minInterval: 1 },
    series
  }
})

/** 便签分布饼图（始终显示全部便签，不受筛选影响） */
const pieOption = computed(() => {
  const data = {}
  yearBlocks.value.forEach(b => {
    const hrs = (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)) / 60
    const key = b.noteId || 'other'
    data[key] = (data[key] || 0) + hrs
  })

  // 按值降序排列，取前8个，其余合并为"其他"
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1])
  const topItems = sorted.slice(0, 8)
  const restSum = sorted.slice(8).reduce((s, [, v]) => s + v, 0)

  const pieData = topItems.map(([key, value]) => ({
    name: store.getNoteName(key),
    value: parseFloat(value.toFixed(1)),
    itemStyle: { color: store.getNoteColor(key) }
  }))
  if (restSum > 0) {
    pieData.push({ name: '其他', value: parseFloat(restSum.toFixed(1)), itemStyle: { color: '#909399' } })
  }

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c}h ({d}%)' },
    legend: { show: false }, // 右侧已有排行榜，隐藏图例
    series: [{
      type: 'pie',
      radius: ['30%', '55%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: getCssVar('--chart-border'), borderWidth: 2 },
      label: {
        show: true,
        fontSize: 10,
        formatter: '{b}\n{d}%',
        overflow: 'truncate',
        width: 60
      },
      labelLine: {
        length: 10,
        length2: 8
      },
      data: pieData
    }]
  }
})

/** 便签时间排行榜（始终显示全部便签，不受筛选影响） */
const noteRanking = computed(() => {
  const data = {}
  yearBlocks.value.forEach(b => {
    const hrs = (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)) / 60
    const key = b.noteId || 'other'
    data[key] = (data[key] || 0) + hrs
  })

  // 按时长降序，取前10
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1])
  const maxVal = sorted[0]?.[1] || 1

  return sorted.slice(0, 10).map(([key, value]) => ({
    id: key,
    name: store.getNoteName(key),
    hours: parseFloat(value.toFixed(1)),
    color: store.getNoteColor(key),
    percent: Math.round((value / maxVal) * 100)
  }))
})

// ---- 年度热力日历数据 ----

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

/**
 * 构建12个月的每日热力网格
 * 返回数组：[{ days: [{ dateStr, isToday, isOtherYear, heatColor, tooltip }] }, ...]
 * 每月的网格固定包含42 格子（行�?列），与月历对齐
 */
const monthGrids = computed(() => {
  const year = currentYear.value.year()
  const today = dayjs().format('YYYY-MM-DD')
  const result = []

  // 收集全年每日时长
  const dailyMap = new Map() // dateStr -> hours
  filteredBlocks.value.forEach(b => {
    const hrs = (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)) / 60
    dailyMap.set(b.date, (dailyMap.get(b.date) || 0) + hrs)
  })

  // 找出最大单日时长用于计算强度
  const maxDailyHours = Math.max(...Array.from(dailyMap.values()), 0.01)

  for (let m = 0; m < 12; m++) {
    const firstDay = dayjs(new Date(year, m, 1))
    const daysInMonth = firstDay.daysInMonth()

    let startDow = firstDay.day() // 0=周日
    startDow = startDow === 0 ? 6 : startDow - 1

    const days = []
    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7 // 对齐到整周

    // 上月填充
    for (let i = 0; i < startDow; i++) {
      days.push({ dateStr: null, isToday: false, isOtherYear: true, heatColor: 'transparent', tooltip: '' })
    }

    // 当月每天
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const hrs = dailyMap.get(dateStr) || 0
      const level = hrs <= 0 ? 0 : Math.min(4, Math.ceil((hrs / maxDailyHours) * 4))

      days.push({
        dateStr,
        isToday: dateStr === today,
        isOtherYear: false,
        heatColor: getHeatColor(level),
        tooltip: hrs > 0 ? `${dateStr} · ${hrs.toFixed(1)}h` : `${dateStr} · 无记录`
      })
    }

    // 下月填充补齐整周
    while (days.length < totalCells) {
      days.push({ dateStr: null, isToday: false, isOtherYear: true, heatColor: 'transparent', tooltip: '' })
    }

    result.push({ days })
  }

  return result
})

/**
 * 热力图颜色（无便签筛选时用统一绿色系，有筛选时用便签色）
 * level: 0-4
 */
function getHeatColor(level) {
  if (level === 0) return 'var(--heat-empty-bg)'

  if (selectedNoteId.value) {
    // 单便签模式：使用便签颜色深浅
    const note = notes.value.find(n => n.id === selectedNoteId.value)
    const base = note?.color || '#409eff'
    const hex = base.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const alphaMap = [0, 0.18, 0.40, 0.65, 0.90]
    return `rgba(${r}, ${g}, ${b}, ${alphaMap[level]})`
  }

  // 全部便签模式：GitHub 绿色系
  const greenMap = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']
  return greenMap[level] || greenMap[0]
}

/** hex 颜色变亮指定百分比（用于渐变浅色端） */
function lightenColor(hexColor, percent) {
  const hex = hexColor.replace('#', '')
  let r = parseInt(hex.substring(0, 2), 16)
  let g = parseInt(hex.substring(2, 4), 16)
  let b = parseInt(hex.substring(4, 6), 16)

  r = Math.min(255, Math.round(r + (255 - r) * percent / 100))
  g = Math.min(255, Math.round(g + (255 - g) * percent / 100))
  b = Math.min(255, Math.round(b + (255 - b) * percent / 100))

  return `rgb(${r}, ${g}, ${b})`
}

/** 图例颜色（使用当前模式的配色） */
function getLegendColor(level) {
  return getHeatColor(level)
}

// ---- 导航方法 ----

function prevYear() {
  currentYear.value = currentYear.value.subtract(1, 'year')
}

function nextYear() {
  currentYear.value = currentYear.value.add(1, 'year')
}

function goToday() {
  currentYear.value = dayjs()
}

// ---- 图表初始化 ----

function initCharts() {
  nextTick(() => {
    if (barChartRef.value) {
      if (barChart) barChart.dispose()
      barChart = echarts.init(barChartRef.value)
      barChart.setOption(barOption.value)
    }
    if (pieChartRef.value) {
      if (pieChart) pieChart.dispose()
      pieChart = echarts.init(pieChartRef.value)
      pieChart.setOption(pieOption.value)
    }
  })
}

watch([filteredBlocks, currentYear, selectedNoteId], () => {
  initCharts()
}, { deep: true })

onMounted(() => {
  initCharts()
  const onResize = () => {
    barChart?.resize()
    pieChart?.resize()
  }
  window.addEventListener('resize', onResize)
  onUnmounted(() => window.removeEventListener('resize', onResize))
})
</script>

<style lang="scss" scoped>
.year-view-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  overflow: auto;
}

// ---- 工具栏 ----
.year-toolbar {
  display: flex;
  align-items: center;
}

.year-nav {
  display: flex;
  align-items: center;
  gap: 10px;

  .current-year {
    font-size: 18px;
    font-weight: 600;
    min-width: 80px;
    text-align: center;
  }
}

// ---- 概览卡片 ----
.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  text-align: center;

  .stat-value {
    font-size: 26px;
    font-weight: 600;
    color: var(--primary-color);
    margin-bottom: 6px;
  }

  .stat-label {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

// ---- 便签分布（饼图 + 排行榜） ----
.distribution-card {
  :deep(.el-card__body) {
    overflow: visible;
  }

  .distribution-body {
    display: flex;
    gap: 20px;
    align-items: stretch;
    overflow: visible;
  }

  .pie-chart-area {
    flex: 0 0 280px;
    height: 280px;
    overflow: visible;
  }

  .ranking-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    overflow-y: auto;
    max-height: 280px;
  }

  .ranking-item {
    display: flex;
    align-items: center;
    gap: 8px;

    .rank-num {
      width: 20px;
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      flex-shrink: 0;

      &.top3 {
        color: var(--primary-color);
      }
    }

    .rank-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .rank-name {
      font-size: 13px;
      min-width: 60px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rank-hours {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary);
      min-width: 40px;
      text-align: right;
      flex-shrink: 0;
    }

    .rank-bar {
      flex: 1;
      height: 6px;
      background: var(--bg-tertiary);
      border-radius: 3px;
      overflow: hidden;
      min-width: 30px;

      .rank-bar-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.3s ease;
      }
    }
  }

  .ranking-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    font-size: 13px;
  }
}

// ---- 月度趋势 ----
.bar-chart-card {
  .chart {
    height: 260px;
  }
}

.chart-card {
  .chart {
    height: 280px;
  }
}

// ---- 年度热力日历 ----
.heatmap-card {
  :deep(.el-card__body) {
    padding: 16px;
  }

  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
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

  .heat-legend {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-secondary);

    .legend-box {
      width: 13px;
      height: 13px;
      border-radius: 2px;
      display: inline-block;
    }
  }
}

// 热力图容器（响应式换行）
.year-heatmap {
  // 无需 overflow-x，由内部 grid 自动换行
}

// 12个月份块：响应式网格，每行自动排N个
.yhm-grid {
  display: grid;
  // 每个格子最小宽度130px，可用空间均分，自动换行
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 16px 10px;
  user-select: none;
}

// 单个月份块（自包含：月份 + 格子）
.yhm-month-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  // 宽度�?grid 自动分配
}

// 月份名称
.yhm-month-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 2px 0;
  line-height: 1.2;
}

// 星期标题行（每月份块内各有一行）
.yhm-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;

  .yhm-wd {
    text-align: center;
    font-size: 9px;
    font-weight: 600;
    color: var(--text-secondary);
    line-height: 1;
    padding: 1px 0;
  }
}

// 格子网格（7列× N行，按实际周数自动撑开）
.yhm-days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

// 热力格子
.yhm-day {
  aspect-ratio: 1;
  border-radius: 2px;
  cursor: default;
  transition: transform 0.1s, box-shadow 0.1s;
  min-width: 0;
  min-height: 0;

  &:hover {
    transform: scale(1.3);
    z-index: 5;
    box-shadow: var(--shadow-sm);
    position: relative;
  }

  &.empty,
  &.other-year {
    visibility: hidden;
  }

  &.today {
    outline: 1.5px solid var(--primary-color);
    outline-offset: -1px;
    z-index: 4;
  }
}
</style>
