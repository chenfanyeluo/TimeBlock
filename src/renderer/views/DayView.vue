<template>
  <div class="view-container day-view-wrapper">
    <!-- 左侧任务储备栏 -->
    <TaskPool ref="taskPoolRef" :highlighted="isPoolHighlighted" @dragstart="onPoolDragStart" @recycle-block="onRecycleBlock" />

    <!-- 右侧日视图区域 -->
    <div class="day-view-main">
      <div class="view-header">
        <h2>日视图</h2>
        <div class="date-nav">
          <el-button @click="prevDay" :icon="ArrowLeft" circle size="small" />
          <span class="current-date">{{ displayDate }}</span>
          <el-button @click="nextDay" :icon="ArrowRight" circle size="small" />
          <el-button type="primary" size="small" @click="goToday">今天</el-button>
        </div>
      </div>

      <div class="day-view-content">
        <!-- 时间轴标签 -->
        <div class="timeline">
          <div v-for="hour in 24" :key="hour - 1" class="hour-label">
            {{ String(hour - 1).padStart(2, '0') }}:00
          </div>
        </div>

        <!-- 时间网格（拖放目标） -->
        <div
          class="day-grid"
          ref="dayGridRef"
          :class="{ 'drag-over': isDragOver }"
          @dblclick="handleGridDoubleClick"
          @dragover.prevent="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
          @click="onGridClick"
        >
          <!-- 小时行背景 -->
          <div
            v-for="hour in 24"
            :key="'row-' + (hour - 1)"
            class="hour-row"
            :data-hour="hour - 1"
          ></div>

          <!-- 拖拽提示 -->
          <div v-if="isDragOver" class="drop-indicator" :style="dropIndicatorStyle">
            放置到此处创建时间块
          </div>

          <!-- 时间块（统一绝对定位，多任务通过 left/width 并排） -->
          <TimeBlockItem
            v-for="layout in blockLayouts"
            :key="layout.block.id"
            :block="layout.block"
            :hour-height="hourHeight"
            :is-multi="layout.totalCols > 1"
            :multi-index="layout.colIndex"
            :multi-total="layout.totalCols"
            :selected="selectedBlockId === layout.block.id"
            @update="(updates) => updateBlock(layout.block.id, updates)"
            @delete="deleteBlock(layout.block.id)"
            @select="onBlockSelect"
            @recycle="onRecycleFromBlock"
            @drag-over-pool="isPoolHighlighted = $event"
          />

          <!-- 统一操作栏（选中任务块时显示） -->
          <div v-if="selectedBlock" class="block-toolbar" @click.stop>
            <el-button type="danger" size="small" :icon="Delete" circle @click="handleToolbarDelete" />
          </div>

          <!-- 空状态提示 -->
          <div v-if="dayBlocks.length === 0 && !isDragOver" class="empty-hint">
            <p>双击时间轴或从左侧拖拽任务来安排时间</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建时间块对话框 -->
    <el-dialog v-model="dialogVisible" title="新建时间块" width="400px">
      <el-form :model="newBlock" label-width="80px">
        <el-form-item label="任务名称">
          <el-input v-model="newBlock.taskName" placeholder="请输入任务名称" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="newBlock.category" placeholder="选择分类">
            <el-option
              v-for="cat in categories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-time-select
            v-model="newBlock.startTime"
            start="00:00"
            step="00:15"
            end="23:45"
            placeholder="选择开始时间"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-time-select
            v-model="newBlock.endTime"
            start="00:15"
            step="00:15"
            end="24:00"
            placeholder="选择结束时间"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAddBlock">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ArrowLeft, ArrowRight, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import TimeBlockItem from '@components/TimeBlockItem.vue'
import TaskPool from '@components/TaskPool.vue'
import { useTimeBlockStore } from '@stores/timeBlock'

const store = useTimeBlockStore()
const currentDate = ref(dayjs())
const hourHeight = 60
const dayGridRef = ref(null)
const dialogVisible = ref(false)
const isDragOver = ref(false)
const dropHour = ref(0)
const dropMinute = ref(0)

const newBlock = ref({
  taskName: '',
  category: 'work',
  startTime: '09:00',
  endTime: '10:00',
  categoryColor: '#409EFF'
})

const displayDate = computed(() => currentDate.value.format('YYYY年MM月DD日 dddd'))

// 获取当天所有时间块
const dayBlocks = computed(() => {
  return store.getBlocksByDate(currentDate.value.format('YYYY-MM-DD'))
})

const categories = computed(() => store.categories)
const taskPoolRef = ref(null)
const isPoolHighlighted = ref(false)

// 选中状态（统一操作栏）
const selectedBlockId = ref(null)
const selectedBlock = computed(() => {
  if (!selectedBlockId.value) return null
  return dayBlocks.value.find(b => b.id === selectedBlockId.value) || null
})

function onBlockSelect(blockId) {
  // 点击已选中的块则取消选中，否则选中该块
  selectedBlockId.value = selectedBlockId.value === blockId ? null : blockId
}

function onGridClick() {
  // 点击网格空白处取消选中
  selectedBlockId.value = null
}

function handleToolbarDelete() {
  if (selectedBlockId.value) {
    deleteBlock(selectedBlockId.value)
    selectedBlockId.value = null
  }
}

// 从日视图拖放到储备栏：删除块并取消选中（由 TimeBlockItem 触发）
function onRecycleFromBlock(data) {
  deleteBlock(data.blockId)
  if (selectedBlockId.value === data.blockId) {
    selectedBlockId.value = null
  }
  // 通过 ref 调用储备栏的回收方法（传递完整分类信息）
  taskPoolRef.value?.recycleTask(data.taskName, data.categoryColor, data.categoryName || '', data.categoryId || '')
}

// 兼容：从储备栏 HTML5 拖放触发的回收（保留备用）
function onRecycleBlock(blockId) {
  deleteBlock(blockId)
  if (selectedBlockId.value === blockId) {
    selectedBlockId.value = null
  }
}

// 计算每个块的布局信息（统一绝对定位，重叠块通过列偏移并排）
const blockLayouts = computed(() => {
  const blocks = dayBlocks.value
  if (!blocks || blocks.length === 0) return []

  const sorted = [...blocks].sort((a, b) =>
    timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  )

  const layouts = []
  const processed = new Set()

  for (let i = 0; i < sorted.length; i++) {
    const block = sorted[i]
    if (processed.has(block.id)) continue

    // 找到所有与当前块时间重叠的块
    const group = [block]
    processed.add(block.id)
    const startA = timeToMinutes(block.startTime)
    const endA = timeToMinutes(block.endTime)

    for (let j = i + 1; j < sorted.length; j++) {
      const other = sorted[j]
      if (processed.has(other.id)) continue
      const startB = timeToMinutes(other.startTime)
      const endB = timeToMinutes(other.endTime)

      // 时间重叠检测
      if (startA < endB && endA > startB) {
        group.push(other)
        processed.add(other.id)
      }
    }

    // 组内每个块分配列索引
    const totalCols = group.length
    for (let k = 0; k < group.length; k++) {
      layouts.push({
        block: group[k],
        colIndex: k,
        totalCols
      })
    }
  }

  return layouts
})

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

// 拖拽指示器样式
const dropIndicatorStyle = computed(() => ({
  top: (dropHour.value * hourHeight + (dropMinute.value / 60) * hourHeight) + 'px',
  left: '8px',
  right: '8px'
}))

// ---- 导航操作 ----

function prevDay() {
  currentDate.value = currentDate.value.subtract(1, 'day')
}
function nextDay() {
  currentDate.value = currentDate.value.add(1, 'day')
}
function goToday() {
  currentDate.value = dayjs()
}

// ---- 双击新建 ----

function handleGridDoubleClick(e) {
  const rect = dayGridRef.value.getBoundingClientRect()
  const y = e.clientY - rect.top
  const hour = Math.floor(y / hourHeight)
  const minute = Math.floor((y % hourHeight) / (hourHeight / 4)) * 15

  const startTime = `${String(Math.min(23, hour)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  const endHour = hour + 1
  const endTime = `${String(Math.min(23, endHour)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

  newBlock.value = {
    taskName: '',
    category: 'work',
    startTime,
    endTime,
    categoryColor: '#409EFF'
  }
  dialogVisible.value = true
}

function confirmAddBlock() {
  store.addBlock({
    ...newBlock.value,
    date: currentDate.value.format('YYYY-MM-DD')
  })
  dialogVisible.value = false
}

// ---- 拖放操作 ----
// 每小时固定 hourHeight 像素，1像素 = 1分钟（因为 hourHeight=60）

function onPoolDragStart(task) {
  // 标记来自储备栏的拖拽
}

function getDropMinutes(e) {
  const rect = dayGridRef.value.getBoundingClientRect()
  // 鼠标相对于网格可见区域的偏移 + 滚动量 = 相对于内容顶部的绝对位置
  const y = e.clientY - rect.top + dayGridRef.value.scrollTop
  // 直接用固定比例：每小时 hourHeight 像素 = 60分钟
  return y / hourHeight * 60
}

function onDragOver(e) {
  e.preventDefault()
  isDragOver.value = true

  const dropMinutes = getDropMinutes(e)
  dropHour.value = Math.max(0, Math.min(23, Math.floor(dropMinutes / 60)))
  dropMinute.value = Math.max(0, Math.min(45, Math.round(dropMinutes % 60 / 15) * 15))
}

function onDragLeave(e) {
  if (dayGridRef.value && !dayGridRef.value.contains(e.relatedTarget)) {
    isDragOver.value = false
  }
}

function onDrop(e) {
  e.preventDefault()
  isDragOver.value = false

  try {
    const data = JSON.parse(e.dataTransfer.getData('application/json'))

    // 用固定映射计算放置位置
    const dropMinutes = getDropMinutes(e)
    const startMinutes = Math.round(dropMinutes / 15) * 15
    const clampedStart = Math.max(0, Math.min(1380, startMinutes))
    const duration = data.duration || 30
    const endMinutes = Math.min(clampedStart + duration, 1440)

    const formatTime = (mins) => {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }

    store.addBlock({
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskName: data.taskName || '新任务',
      date: currentDate.value.format('YYYY-MM-DD'),
      startTime: formatTime(clampedStart),
      endTime: formatTime(endMinutes),
      categoryColor: data.categoryColor || '#409EFF',
      categoryName: data.categoryName || '',
      category: data.categoryId || ''
    })

    ElMessage.success(`已添加"${data.taskName}" (${formatTime(clampedStart)}-${formatTime(endMinutes)})`)
  } catch (err) {
    console.error('Drop error:', err)
  }
}

// ---- 块操作 ----

function updateBlock(id, updates) {
  store.updateBlock(id, updates)
}

function deleteBlock(id) {
  store.deleteBlock(id)
}
</script>

<style lang="scss" scoped>
.day-view-wrapper {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.day-view-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-secondary);
}

.day-view-content {
  flex: 1;
  display: flex;
  overflow: auto;
  border-radius: 8px;
  margin: 12px;
  background: white;
  box-shadow: inset 0 0 0 1px var(--border-light);
}

.timeline {
  width: var(--timeline-width, 56px);
  flex-shrink: 0;
  border-right: 1px solid var(--border-light);
  background: #fafafa;
}

.hour-label {
  height: 60px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 6px;
  font-size: 11px;
  color: var(--text-secondary);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    width: calc(100% - 6px);
    height: 1px;
    background: var(--border-light);
  }
}

.day-grid {
  flex: 1;
  position: relative;
  min-height: 1440px; /* 24小时 * 60px */
  transition: background-color 0.2s;

  &.drag-over {
    background: linear-gradient(
      to bottom,
      rgba(64, 158, 255, 0.03),
      rgba(64, 158, 255, 0.08)
    );
  }
}

.hour-row {
  height: 60px;
  border-bottom: 1px solid var(--border-light);

  &:hover {
    background: rgba(0, 0, 0, 0.02);
  }
}

.drop-indicator {
  position: absolute;
  height: 40px;
  border: 2px dashed #409eff;
  border-radius: 6px;
  background: rgba(64, 158, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #409eff;
  font-weight: 500;
  z-index: 5;
  pointer-events: none;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

// 统一操作栏（悬浮在选中块上方）
.block-toolbar {
  position: absolute;
  top: -40px;
  right: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  z-index: 999;
  animation: toolbarIn 0.15s ease-out;
}

@keyframes toolbarIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.empty-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
  opacity: 0.6;

  p {
    margin: 0;
  }
}

.date-nav {
  display: flex;
  align-items: center;
  gap: 10px;

  .current-date {
    font-size: 16px;
    font-weight: 500;
    min-width: 180px;
    text-align: center;
  }
}

.view-header {
  display: flex;
  align-items: center;
  padding: 12px 20px 8px;
  gap: 16px;

  h2 {
    margin: 0;
    font-size: 18px;
    color: var(--text-primary);
  }
}
</style>
