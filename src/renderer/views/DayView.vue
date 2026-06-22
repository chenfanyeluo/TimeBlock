<template>
  <div class="view-container day-view-wrapper" :class="{ 'pool-collapsed': poolCollapsed }">
    <!-- 左侧便签栏（可折叠） -->
    <TaskPool
      v-show="!poolHidden"
      ref="taskPoolRef"
      :class="{ 'is-collapsed': poolCollapsed }"
      :highlighted="isPoolHighlighted"
      @dragstart="onPoolDragStart"
      @recycle-block="onRecycleBlock"
    />

    <!-- 右侧日视图主区域 -->
    <div class="day-view-main">
      <!-- 顶部工具栏 -->
      <div class="view-header">
        <div class="header-left">
          <h2>记录</h2>
          <!-- 迷你日历选择器 -->
          <el-date-picker
            v-model="currentDate"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            :clearable="false"
            size="default"
            style="width: 160px"
          />
        </div>
        <div class="header-right">
          <!-- 储备栏切换按钮（窄屏显示） -->
          <el-button
            v-if="showPoolToggle"
            :type="poolHidden ? 'primary' : 'default'"
            size="small"
            @click="poolHidden = !poolHidden"
          >
            {{ poolHidden ? '显示便签' : '隐藏便签' }}
          </el-button>
          <!-- 折叠按钮（宽屏时折叠为窄条） -->
          <el-button
            v-if="!showPoolToggle"
            size="small"
            :icon="poolCollapsed ? DArrowRight : DArrowLeft"
            circle
            @click="poolCollapsed = !poolCollapsed"
            :title="poolCollapsed ? '展开便签' : '折叠便签'"
          />
          <div class="date-nav">
            <el-button @click="prevDay" :icon="ArrowLeft" circle size="small" />
            <span class="current-date">{{ displayDate }}</span>
            <el-button @click="nextDay" :icon="ArrowRight" circle size="small" />
            <el-button type="primary" size="small" @click="goToday">今天</el-button>
          </div>
        </div>
      </div>

      <!-- 日视图内容区（时间轴 + 网格） -->
      <div class="day-view-content">
        <!-- 同步滚动容器：时间轴和网格一起滚动 -->
        <div class="scroll-body" ref="scrollBodyRef">
          <!-- 时间轴标签 -->
          <div class="timeline" ref="timelineRef">
          <div
            v-for="hour in visibleHours"
            :key="'label-' + hour"
            class="hour-label"
            :style="{ height: hourHeight + 'px' }"
          >
            {{ String(hour).padStart(2, '0') }}:00
          </div>
        </div>

        <!-- 时间网格（拖放目标 + 拖拽创建 + 时间块容器） -->
        <div
          class="day-grid"
          ref="dayGridRef"
          :class="{ 'drag-over': isDragOver, 'creating': isCreating }"
          @dblclick="handleGridDoubleClick"
          @dragover.prevent="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
          @click="onGridClick"
          @mousedown="onGridMouseDown"
        >
          <!-- 小时行背景 -->
          <div
            v-for="hour in visibleHours"
            :key="'row-' + hour"
            class="hour-row"
            :data-hour="hour"
            :style="{ height: hourHeight + 'px', top: getHourTop(hour) + 'px' }"
          ></div>

          <!-- 当前时间指示 -->
          <div v-if="currentTimeLine.show" class="current-time-line" :style="currentTimeLineStyle">
            <span class="current-time-label">{{ currentTimeLine.timeStr }}</span>
          </div>

          <!-- 拖拽创建预览 -->
          <div v-if="isCreating" class="create-preview" :style="createPreviewStyle">
            <span class="create-preview-text">{{ createPreviewText }}</span>
          </div>

          <!-- 拖放提示（从便签栏拖入时） -->
          <div v-if="isDragOver" class="drop-indicator" :style="dropIndicatorStyle">
            <span class="drop-main-text">放置到此处创建时间块</span>
            <span class="drop-hint-text">按住 Shift 拖入可直接添加任务</span>
          </div>

          <!-- 时间块（统一绝对定位，多任务通过 left/width 并排） -->
          <TimeBlockItem
            v-for="layout in blockLayouts"
            :key="layout.block.id"
            :block="layout.block"
            :hour-height="hourHeight"
            :grid-start-hour="startHour"
            :is-multi="layout.totalCols > 1"
            :multi-index="layout.colIndex"
            :multi-total="layout.totalCols"
            :selected="selectedBlockId === layout.block.id"
            @update="(updates) => updateBlock(layout.block.id, updates)"
            @delete="deleteBlock(layout.block.id)"
            @select="onBlockSelect"
            @recycle="onRecycleFromBlock"
            @drag-over-pool="isPoolHighlighted = $event"
            @contextmenu.prevent="onBlockContextMenu($event, layout.block)"
          />

          <!-- 右键上下文菜单 -->
          <div
            v-if="contextMenu.visible"
            class="context-menu"
            :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
            @click.stop
          >
            <div class="context-menu-item" @click="onContextAction('edit')">
              <el-icon><Edit /></el-icon> 编辑详情
            </div>
            <div class="context-menu-item" @click="onContextAction('copy')">
              <el-icon><CopyDocument /></el-icon> 复制时间�?
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item color-submenu-wrap" @mouseenter="showColorPicker = true" @mouseleave="showColorPicker = false">
              <span class="color-label"><el-icon><Brush /></el-icon>更改颜色</span>
              <span class="color-arrow">&#9654;</span>
              <!-- 颜色子菜单 -->
              <div v-if="showColorPicker" class="color-picker-submenu">
                <div
                  v-for="note in notes"
                  :key="note.id"
                  class="color-option"
                  :class="{ active: contextMenu.block && contextMenu.block.noteId === note.id }"
                  @click.stop="onContextAction('color', note)"
                >
                  <span class="color-dot" :style="{ background: note.color }"></span>
                  {{ note.name }}
                </div>
              </div>
            </div>
            <div class="context-menu-item" @click="onContextAction('moveDate')">
              <el-icon><Calendar /></el-icon> 移动到其他日期
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item danger" @click="onContextAction('delete')">
              <el-icon><Delete /></el-icon> 删除
            </div>
          </div>

          <!-- 空状态提示 -->
          <div v-if="dayBlocks.length === 0 && !isDragOver && !isCreating" class="empty-hint" @click.stop @mousedown.stop>
            <div class="empty-hint-icon">
              <el-icon :size="48"><Clock /></el-icon>
            </div>
            <p class="empty-hint-title">未添加事件</p>
            <p class="empty-hint-desc">在时间轴上拖拽绘制快速创建，或从左侧拖入便签</p>
            <el-button type="primary" size="small" @click="dialogVisible = true">
              <el-icon><Plus /></el-icon> 手动添加
            </el-button>
          </div>
        </div>
        </div><!-- /scroll-body -->
      </div>
    </div>

    <!-- 新建/编辑时间块对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="420px" @closed="resetDialogForm">
      <el-form :model="newBlock" label-width="80px">
        <el-form-item label="便签">
          <el-select v-model="newBlock.noteId" placeholder="选择便签" @change="onNoteChange">
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
        <el-form-item label="备注">
          <el-input v-model="newBlock.note" type="textarea" :rows="2" placeholder="可选备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAddBlock">确定</el-button>
      </template>
    </el-dialog>

    <!-- 移动日期对话框 -->
    <el-dialog v-model="moveDateDialogVisible" title="移动到其他日期" width="360px">
      <el-date-picker
        v-model="moveTargetDate"
        type="date"
        placeholder="选择目标日期"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        :clearable="false"
        style="width: 100%"
      />
      <template #footer>
        <el-button @click="moveDateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmMoveDate">确定移动</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  ArrowLeft, ArrowRight, Delete, Plus, Clock,
  DArrowLeft, DArrowRight, Edit, CopyDocument, Brush, Calendar
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import TimeBlockItem from '@components/TimeBlockItem.vue'
import TaskPool from '@components/TaskPool.vue'
import { useTimeBlockStore } from '@stores/timeBlock'

const store = useTimeBlockStore()

// ---- 基础配置 ----
const startHour = 0       // 可视起始小时（保持完整24h供滚动）
const endHour = 24         // 可视结束小时
const hourHeight = 60      // 每小时像素高度

// ---- 响应式状态 ----
const poolCollapsed = ref(false)   // 储备栏是否折叠（宽屏模式）
const poolHidden = ref(false)      // 储备栏是否隐藏（窄屏模式）

// 根据屏幕宽度判断是否显示切换按钮（由 resize 监听器更新）
const windowWidth = ref(window.innerWidth)
const showPoolToggle = computed(() => windowWidth.value < 900)

// ---- 日期相关（统一使用字符串格式，兼容 el-date-picker 的 value-format）---
const currentDate = ref(dayjs().format('YYYY-MM-DD'))
const dayGridRef = ref(null)
const timelineRef = ref(null)
const scrollBodyRef = ref(null)

// 对话框状态
const dialogVisible = ref(false)
const dialogTitle = ref('新建时间块')
const dialogMode = ref('create') // 'create' | 'edit'
const editingBlockId = ref(null)
const moveDateDialogVisible = ref(false)
const moveTargetDate = ref('')
const moveTargetBlockId = ref(null)

// 表单数据
const newBlock = ref({
  noteId: 'work',
  noteName: '工作',
  noteColor: '#409EFF',
  startTime: '09:00',
  endTime: '10:00',
  remark: ''
})

// ---- 计算属性 ----
const visibleHours = computed(() => {
  const hours = []
  for (let h = startHour; h < endHour; h++) {
    hours.push(h)
  }
  return hours
})

const displayDate = computed(() => {
  return dayjs(currentDate.value).format('YYYY年MM月DD日')
})

// 获取当天所有时间块
const dayBlocks = computed(() => {
  return store.getBlocksByDate(currentDate.value)
})

const notes = computed(() => store.notes)

// ---- 任务储备栏状态 ----
const taskPoolRef = ref(null)
const isPoolHighlighted = ref(false)

// ---- 选中状态 ----
const selectedBlockId = ref(null)
const selectedBlock = computed(() => {
  if (!selectedBlockId.value) return null
  return dayBlocks.value.find(b => b.id === selectedBlockId.value) || null
})

function onBlockSelect(blockId) {
  selectedBlockId.value = selectedBlockId.value === blockId ? null : blockId
}

function onGridClick(e) {
  // 拖拽创建结束后浏览器仍会触发 click，需要抑制
  let _suppressNextClick = false
  if (_suppressNextClick) {
    _suppressNextClick = false
    return
  }
  // 如果正在创建中（理论上走不到这里），不处理
  if (isCreating.value) return
  selectedBlockId.value = null
  hideContextMenu()
}

// ---- 右键上下文菜单状态 ----
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  block: null
})
const showColorPicker = ref(false)

function onBlockContextMenu(e, block) {
  e.preventDefault()
  e.stopPropagation()
  selectedBlockId.value = block.id
  const gridRect = dayGridRef.value.getBoundingClientRect()
  let x = e.clientX - gridRect.left
  let y = e.clientY - gridRect.top
  // 边界保护：防止超出四边框
  x = Math.max(4, Math.min(x, gridRect.width - 160))
  y = Math.max(4, Math.min(y, gridRect.height - 220))
  contextMenu.value = { visible: true, x, y, block }
  showColorPicker.value = false
}

function hideContextMenu() {
  contextMenu.value.visible = false
  showColorPicker.value = false
}

async function onContextAction(action, data) {
  const block = contextMenu.value.block
  if (!block) return
  hideContextMenu()

  switch (action) {
    case 'edit':
      openEditDialog(block)
      break
    case 'copy': {
      // 复制：同一天创建一个相同内容的新块
      const copyData = {
        noteId: block.noteId || '',
        noteName: block.noteName || block.taskName + ' (副本)',
        date: block.date,
        startTime: block.startTime,
        endTime: block.endTime,
        noteColor: block.noteColor,
        remark: block.remark || block.note || ''
      }
      store.addBlock(copyData)
      ElMessage.success('已复制时间块')
      break
    }
    case 'color':
      if (data) {
        store.updateBlock(block.id, {
          noteId: data.id,
          noteColor: data.color,
          noteName: data.name
        })
        ElMessage.success(`已更改为「${data.name}」`)
      }
      break
    case 'moveDate':
      moveTargetBlockId.value = block.id
      moveTargetDate.value = block.date
      moveDateDialogVisible.value = true
      break
    case 'delete':
      try {
        await ElMessageBox.confirm(`确认删除「${block.noteName || block.taskName}」？`, '删除确认', {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning'
        })
        deleteBlock(block.id)
        if (selectedBlockId.value === block.id) selectedBlockId.value = null
      } catch {
        // 取消删除
      }
      break
  }
}

function confirmMoveDate() {
  if (moveTargetBlockId.value && moveTargetDate.value) {
    store.updateBlock(moveTargetBlockId.value, { date: moveTargetDate.value })
    ElMessage.success('已移动到 ' + moveTargetDate.value)
    moveDateDialogVisible.value = false
  }
}

// ---- 编辑对话框状态 ----
function onNoteChange(noteId) {
  const note = notes.value.find(n => n.id === noteId)
  if (note) {
    newBlock.value.noteId = note.id
    newBlock.value.noteName = note.name
    newBlock.value.noteColor = note.color
  }
}

function openEditDialog(block) {
  dialogMode.value = 'edit'
  dialogTitle.value = '编辑时间块'
  editingBlockId.value = block.id
  newBlock.value = {
    noteId: block.noteId || 'work',
    noteName: block.noteName || block.taskName || '',
    noteColor: block.noteColor || '#409EFF',
    startTime: block.startTime,
    endTime: block.endTime,
    remark: block.remark || block.note || ''
  }
  dialogVisible.value = true
}

function resetDialogForm() {
  dialogMode.value = 'create'
  dialogTitle.value = '新建时间块'
  editingBlockId.value = null
  newBlock.value = {
    noteId: 'work',
    noteName: '工作',
    noteColor: '#409EFF',
    startTime: '09:00',
    endTime: '10:00',
    remark: ''
  }
}

// ---- 删除操作 ----
function handleToolbarDelete() {
  if (selectedBlockId.value) {
    deleteBlock(selectedBlockId.value)
    selectedBlockId.value = null
  }
}

// ---- 从日视图拖放到储备栏回收 ----
function onRecycleFromBlock(data) {
  deleteBlock(data.blockId)
  if (selectedBlockId.value === data.blockId) {
    selectedBlockId.value = null
  }
}

function onRecycleBlock(blockId) {
  deleteBlock(blockId)
  if (selectedBlockId.value === blockId) {
    selectedBlockId.value = null
  }
}

// ---- 块布局计算（绝对定位+ 重叠并排）
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

    const group = [block]
    processed.add(block.id)
    const startA = timeToMinutes(block.startTime)
    const endA = timeToMinutes(block.endTime)

    for (let j = i + 1; j < sorted.length; j++) {
      const other = sorted[j]
      if (processed.has(other.id)) continue
      const startB = timeToMinutes(other.startTime)
      const endB = timeToMinutes(other.endTime)

      if (startA < endB && endA > startB) {
        group.push(other)
        processed.add(other.id)
      }
    }

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

// ---- 工具函数 ----
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes) {
  const h = Math.floor(Math.max(0, minutes) / 60)
  const m = Math.max(0, minutes) % 60
  return `${String(Math.min(23, h)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function snapToGrid(minutes) {
  return Math.round(Math.max(0, minutes) / 15) * 15
}

function getHourTop(hour) {
  return (hour - startHour) * hourHeight
}

// ---- 当前时间红线 ----
const currentTimeLine = ref({ show: false, timeStr: '', topPx: 0 })
let currentTimeTimer = null

function updateCurrentTimeLine() {
  const now = dayjs()
  const str = now.format('YYYY-MM-DD')

  if (str !== currentDate.value) {
    currentTimeLine.value.show = false
    return
  }

  const totalMinutes = now.hour() * 60 + now.minute()
  const topPx = (totalMinutes / 60) * hourHeight
  currentTimeLine.value = {
    show: true,
    timeStr: now.format('HH:mm'),
    topPx
  }
}

const currentTimeLineStyle = computed(() => ({
  top: currentTimeLine.value.topPx + 'px'
}))

// 自动滚动到当前时间红线
function scrollToCurrentTime() {
  if (!currentTimeLine.value.show || !scrollBodyRef.value) return
  const container = scrollBodyRef.value
  const viewportHeight = container.clientHeight
  const targetScroll = currentTimeLine.value.topPx - viewportHeight / 3
  container.scrollTo({
    top: Math.max(0, targetScroll),
    behavior: 'smooth'
  })
}

// ---- 导航操作 ----
function prevDay() {
  currentDate.value = dayjs(currentDate.value).subtract(1, 'day').format('YYYY-MM-DD')
}
function nextDay() {
  currentDate.value = dayjs(currentDate.value).add(1, 'day').format('YYYY-MM-DD')
}
function goToday() {
  currentDate.value = dayjs().format('YYYY-MM-DD')
  setTimeout(() => scrollToCurrentTime(), 100)
}

// ---- 双击新建 ----
function handleGridDoubleClick(e) {
  const rect = dayGridRef.value.getBoundingClientRect()
  // getBoundingClientRect() 已包含滚动偏移，无需再加 scrollTop
  const y = e.clientY - rect.top
  const totalMinutes = (y / hourHeight) * 60
  const snappedStart = snapToGrid(totalMinutes)
  const clampedStart = Math.max(0, Math.min(1380, snappedStart))
  const clampedEnd = Math.min(clampedStart + 60, 1440)

  newBlock.value = {
    noteId: 'work',
    noteName: '工作',
    noteColor: '#409EFF',
    startTime: minutesToTime(clampedStart),
    endTime: minutesToTime(clampedEnd),
    remark: ''
  }
  dialogMode.value = 'create'
  dialogTitle.value = '新建时间块'
  dialogVisible.value = true
}

function confirmAddBlock() {
  const dateStr = currentDate.value

  if (dialogMode.value === 'edit' && editingBlockId.value) {
    store.updateBlock(editingBlockId.value, { ...newBlock.value })
    ElMessage.success('已更新时间块')
  } else {
    store.addBlock({
      ...newBlock.value,
      date: dateStr
    })
    ElMessage.success('已创建时间块')
  }
  dialogVisible.value = false
}

// ---- 拖拽创建（鼠标按下拖拽画出新块）----
const isCreating = ref(false)
const createStartY = ref(0)         // 创建起始 Y（相对于滚动容器）
const createCurrentY = ref(0)       // 当前鼠标 Y
let _createStartClientY = 0
let _suppressNextClick = false      // 阻止拖拽创建后的冒泡 click 事件
let _createMoved = false            // 是否发生过实际移动（用于区分点击/拖拽）

function onGridMouseDown(e) {
  // 忽略右键、已有交互元素上的点击
  if (e.button !== 0) return // 只响应左键
  if (e.target.closest('.time-block')) return
  if (e.target.closest('.context-menu')) return

  e.preventDefault() // 防止浏览器文本选中

  _createStartClientY = e.clientY
  const rect = dayGridRef.value.getBoundingClientRect()
  // getBoundingClientRect() 已包含滚动偏移，无需再加 scrollTop
  createStartY.value = e.clientY - rect.top
  createCurrentY.value = createStartY.value
  _createMoved = false // 延迟到首次 move 再设 isCreating=true，避免双击闪烁

  document.addEventListener('mousemove', onCreateMouseMove, { passive: true })
  document.addEventListener('mouseup', onCreateMouseUp, { once: true })
}

function onCreateMouseMove(e) {
  // 首次移动时才激活创建模式（区分单击和拖拽，同时避免双击时闪烁预览框）
  if (!isCreating.value && !_createMoved) {
    _createMoved = true
    _suppressNextClick = true // 标记需要抑制后 click 事件
    isCreating.value = true
  }
  if (!isCreating.value) return
  const rect = dayGridRef.value.getBoundingClientRect()
  // getBoundingClientRect() 已包含滚动偏移，无需再加 scrollTop
  createCurrentY.value = e.clientY - rect.top
}

function onCreateMouseUp(e) {
  // 清理 mousemove 监听器（无论是否进入创建模式都要清理）
  document.removeEventListener('mousemove', onCreateMouseMove)

  // 未发生过移动 （纯点击），不做任何处理）
  if (!_createMoved) {
    return
  }

  if (!isCreating.value) return

  const minY = Math.min(createStartY.value, createCurrentY.value)
  const maxY = Math.max(createStartY.value, createCurrentY.value)
  const heightPx = maxY - minY

  // 太短的不创建（视为普通点击）
  if (heightPx < 10) {
    isCreating.value = false
    return
  }
  
  // 转换为分钟
  const startMinutes = snapToGrid((minY / hourHeight) * 60)
  const endMinutes = snapToGrid((maxY / hourHeight) * 60)
  const clampedStart = Math.max(0, Math.min(1380, startMinutes))
  let clampedEnd = Math.max(clampedStart + 15, Math.min(1440, endMinutes))

  // 直接创建并打开编辑对话框
  newBlock.value = {
    noteId: 'work',
    noteName: '工作',
    noteColor: '#409EFF',
    startTime: minutesToTime(clampedStart),
    endTime: minutesToTime(clampedEnd),
    remark: ''
  }
  dialogMode.value = 'create'
  dialogTitle.value = '新建时间块'

  isCreating.value = false
  dialogVisible.value = true
}

const createPreviewStyle = computed(() => {
  const minY = Math.min(createStartY.value, createCurrentY.value)
  const maxY = Math.max(createStartY.value, createCurrentY.value)
  return {
    top: minY + 'px',
    left: '8px',
    right: '8px',
    height: (maxY - minY) + 'px'
  }
})

const createPreviewText = computed(() => {
  const minY = Math.min(createStartY.value, createCurrentY.value)
  const maxY = Math.max(createStartY.value, createCurrentY.value)
  const startMin = snapToGrid((minY / hourHeight) * 60)
  const endMin = snapToGrid((maxY / hourHeight) * 60)
  return `${minutesToTime(startMin)} ~ ${minutesToTime(endMin)}`
})

// ---- 从储备栏拖放 ----
const isDragOver = ref(false)
const dropHour = ref(0)
const dropMinute = ref(0)

function onPoolDragStart(task) {
  // 标记来自储备栏的拖拽
}

function getDropMinutes(e) {
  const rect = dayGridRef.value.getBoundingClientRect()
  // getBoundingClientRect() 已包含滚动偏移，无需再加 scrollTop
  const y = e.clientY - rect.top
  return (y / hourHeight) * 60
}

function onDragOver(e) {
  e.preventDefault()
  isDragOver.value = true

  const dropMins = getDropMinutes(e)
  dropHour.value = Math.max(0, Math.min(23, Math.floor(dropMins / 60)))
  dropMinute.value = Math.max(0, Math.min(45, Math.round(dropMins % 60 / 15) * 15))
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
    const dropMins = getDropMinutes(e)
    const startMinutes = snapToGrid(dropMins)
    const clampedStart = Math.max(0, Math.min(1380, startMinutes))
    const duration = data.duration || 30
    const endMinutes = Math.min(clampedStart + duration, 1440)

    const dateStr = typeof currentDate.value === 'string'
      ? currentDate.value
      : currentDate.value.format('YYYY-MM-DD')

    // 检测是否按住 Shift 键（按住时拖入后直接弹出备注输入框）
    const needRemark = e.shiftKey

    const blockData = {
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      noteId: data.noteId || '',
      noteName: data.noteName || data.taskName || '新任务',
      date: dateStr,
      startTime: minutesToTime(clampedStart),
      endTime: minutesToTime(endMinutes),
      noteColor: data.noteColor || '#409EFF',
      remark: ''
    }

    store.addBlock(blockData)

    if (needRemark) {
      // 按住 Shift 拖入：打开编辑对话框聚焦备注输入框
      editingBlockId.value = blockData.id
      newBlock.value = {
        noteId: blockData.noteId,
        noteName: blockData.noteName,
        noteColor: blockData.noteColor,
        startTime: blockData.startTime,
        endTime: blockData.endTime,
        remark: ''
      }
      dialogMode.value = 'edit'
      dialogTitle.value = '添加备注'
      dialogVisible.value = true
    } else {
      ElMessage.success(`已添加 "${blockData.noteName}" (${minutesToTime(clampedStart)}-${minutesToTime(endMinutes)})`)
    }
  } catch (err) {
    console.error('Drop error:', err)
  }
}

// 拖拽指示器样式
const dropIndicatorStyle = computed(() => ({
  top: (dropHour.value * hourHeight + (dropMinute.value / 60) * hourHeight) + 'px',
  left: '8px',
  right: '8px'
}))

// ---- 块操作 ----  
function updateBlock(id, updates) {
  store.updateBlock(id, updates)
}

function deleteBlock(id) {
  store.deleteBlock(id)
}

// ---- 键盘快捷操作 ----
function handleKeyDown(e) {
  // 忽略输入框内的按�?
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  // Delete / Backspace：删除选中的块
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId.value) {
    e.preventDefault()
    deleteBlock(selectedBlockId.value)
    selectedBlockId.value = null
    return
  }

  // Escape：取消选中 + 关闭菜单
  if (e.key === 'Escape') {
    if (contextMenu.value.visible) {
      hideContextMenu()
    } else {
      selectedBlockId.value = null
    }
    return
  }

  // Ctrl+Z：撤销
  if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    if (store.undo()) {
      ElMessage.info('已撤销')
    }
    return
  }

  // Ctrl+Shift+Z / Ctrl+Y：重做
  if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
    e.preventDefault()
    if (store.redo()) {
      ElMessage.info('已重做')
    }
    return
  }

  // 方向键微调选中块的时间
  if (selectedBlockId.value && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault()
    adjustBlockTime(e.key)
  }
}

function adjustBlockTime(key) {
  const block = dayBlocks.value.find(b => b.id === selectedBlockId.value)
  if (!block) return

  const start = timeToMinutes(block.startTime)
  const end = timeToMinutes(block.endTime)
  let newStart = start
  let newEnd = end
  const STEP = 15 // 分钟

  switch (key) {
    case 'ArrowUp':   // 整体上移
      newStart = Math.max(0, start - STEP)
      newEnd = newEnd - STEP
      break
    case 'ArrowDown': // 整体下移
      newStart = Math.min(1440 - (end - start), start + STEP)
      newEnd = Math.min(1440, end + STEP)
      break
    case 'ArrowLeft': // 缩短结束时间
      newEnd = Math.max(start + 15, end - STEP)
      break
    case 'ArrowRight': // 延长结束时间
      newEnd = Math.min(1440, end + STEP)
      break
  }

  store.updateBlock(selectedBlockId.value, {
    startTime: minutesToTime(newStart),
    endTime: minutesToTime(newEnd)
  })
}

// ---- 响应式窗口监听 ----
function handleResize() {
  windowWidth.value = window.innerWidth
  // 窄屏自动隐藏储备时间线
  if (windowWidth.value < 768) {
    poolHidden.value = true
  }
}

// ---- 生命周期 ----
onMounted(() => {
  // 启动当前时间定时更新
  updateCurrentTimeLine()
  currentTimeTimer = setInterval(updateCurrentTimeLine, 30000) // 30秒更新

  // 自动滚动到合适位置（延迟确保 DOM 完全渲染）
  setTimeout(() => {
    if (currentTimeLine.value.show) {
      scrollToCurrentTime()
    } else if (scrollBodyRef.value) {
      // 非今天：默认滚动到上午位置
      scrollBodyRef.value.scrollTo({
        top: getHourTop(8) - 60,
        behavior: 'smooth'
      })
    }
  }, 300)

  // 全局键盘监听
  document.addEventListener('keydown', handleKeyDown)

  // 点击空白处关闭右键菜单
  document.addEventListener('click', hideContextMenu)

  // 窗口尺寸监听
  window.addEventListener('resize', handleResize)
  handleResize() // 初始响应
})

onBeforeUnmount(() => {
  if (currentTimeTimer) clearInterval(currentTimeTimer)
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('click', hideContextMenu)
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.day-view-wrapper {
  display: flex;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.day-view-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-secondary);
  overflow: hidden;
}

// ---- 顶部工具栏 ----
.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 8px;
  gap: 12px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-wrap: wrap;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
}

.date-nav {
  display: flex;
  align-items: center;
  gap: 8px;

  .current-date {
    font-size: 14px;
    font-weight: 500;
    min-width: 160px;
    text-align: center;
    white-space: nowrap;
  }
}

// ---- 内容区域 ----
.day-view-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: 8px;
  margin-top: 4px;
  border-radius: 8px;
  background: var(--bg-secondary);
  box-shadow: inset 0 0 0 1px var(--border-light);
  position: relative;
}

// 同步滚动容器（时间轴 + 网格一起滚动）
.scroll-body {
  display: flex;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

// ---- 时间轴 ----
.timeline {
  width: var(--timeline-width, 56px);
  flex-shrink: 0;
  border-right: 1px solid var(--border-light);
  background: var(--bg-tertiary);
  display: flex;
  flex-direction: column;
}

.hour-label {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 6px;
  font-size: 11px;
  color: var(--text-secondary);
  position: relative;
  flex-shrink: 0;

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

// ---- 时间网格 ----
.day-grid {
  flex: 1;
  position: relative;
  min-height: calc(var(--grid-total-hours, 24) * 60px);
  transition: background-color 0.2s;

  &.drag-over {
    background: linear-gradient(
      to bottom,
      var(--drag-over-bg), var(--drag-over-bg-strong)
    );
  }

  &.creating {
    cursor: crosshair;
  }
}

.hour-row {
  position: absolute;
  left: 0;
  right: 0;
  border-bottom: 1px solid var(--border-lighter);

  &:hover {
    background: var(--bg-hover-soft);
  }
}

// ---- 当前时间红线 ----
.current-time-line {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 8;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 1px;
    background: var(--danger-color);
    box-shadow: 0 0 4px rgba(245, 108, 108, 0.5);
  }

  // 顶部圆点
  &::after {
    content: '';
    position: absolute;
    left: -2px;
    top: -4px;
    width: 9px;
    height: 9px;
    background: var(--danger-color);
    border-radius: 50%;
    border: 2px solid var(--bg-secondary);
    box-shadow: 0 0 4px rgba(245, 108, 108, 0.4);
  }
}

.current-time-label {
  position: absolute;
  left: 10px;
  top: -10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--danger-color);
  background: var(--bg-secondary);
  padding: 0 4px;
  border-radius: 3px;
  line-height: 18px;
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
  z-index: 9;
}

// ---- 拖拽创建预览 ----
.create-preview {
  position: absolute;
  border: 2px dashed var(--primary-color);
  border-radius: 6px;
  background: var(--drag-over-bg-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  pointer-events: none;
  transition: none;
}

.create-preview-text {
  font-size: 13px;
  color: var(--primary-color);
  font-weight: 500;
  background: var(--bg-secondary);
  padding: 2px 10px;
  border-radius: 4px;
  white-space: nowrap;
}

// ---- 拖放提示 ----
.drop-indicator {
  position: absolute;
  height: 52px;
  border: 2px dashed var(--primary-color);
  border-radius: 6px;
  background: var(--drag-over-bg-strong);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 5;
  pointer-events: none;
  animation: pulse 1s ease-in-out infinite;
  gap: 2px;

  .drop-main-text {
    font-size: 13px;
    color: var(--primary-color);
    font-weight: 500;
  }

  .drop-hint-text {
    font-size: 11px;
    color: var(--text-secondary);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

// ---- 右键上下文菜单 ----
.context-menu {
  position: absolute;
  z-index: 1000;
  min-width: 160px;
  background: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  padding: 5px 0;
  animation: contextMenuIn 0.12s ease-out;
  user-select: none;
}

@keyframes contextMenuIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s;
  position: relative;

  &:hover {
    background: var(--bg-hover);
  }

  .el-icon {
    font-size: 15px;
    color: var(--text-secondary);
  }

  &.danger {
    color: var(--danger-color);

    &:hover {
      background: var(--danger-light);
    }

    .el-icon {
      color: var(--danger-color);
    }
  }
}

.context-menu-divider {
  height: 1px;
  background: var(--border-light);
  margin: 4px 12px;
}

// ---- 颜色子菜单 ----
.color-submenu-wrap {
  position: relative;

  .color-label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .color-arrow {
    margin-left: auto;
    font-size: 9px;
    color: var(--text-secondary);
  }
}

.color-picker-submenu {
  position: absolute;
  left: 100%;
  top: -5px;
  min-width: 120px;
  background: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  padding: 5px 0;
  z-index: 1001;
}

.color-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--bg-hover);
  }

  &.active {
    color: var(--primary-color);
    font-weight: 600;
  }

  .color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

// 便签下拉选项样式
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
}

// ---- 空状态提示 ----
.empty-hint {
  position: absolute;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--text-secondary);

  .empty-hint-icon {
    color: var(--border-color);
    margin-bottom: 12px;
  }

  .empty-hint-title {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-regular);
    margin: 0 0 6px;
  }

  .empty-hint-desc {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0 0 16px;
    line-height: 1.5;
    max-width: 280px;
  }
}

// =============================================
// 响应式布局
// =============================================

// Level 2: 中等屏幕 (800px ~ 1199px) TaskPool 收起为按钮触发抽屉
@media screen and (max-width: 1199px) and (min-width: 800px) {
  .day-view-wrapper:not(.pool-collapsed) {
    .task-pool {
      width: 180px;
    }
  }

  .date-nav .current-date {
    min-width: 130px;
  }
}

// Level 3: 窄屏 (< 800px) 极致压缩
@media screen and (max-width: 799px) {
  .day-view-wrapper {
    flex-direction: column;
  }

  .task-pool {
    /* v-show="!poolHidden" 控制显隐 */
  }

  .view-header {
    padding: 8px 12px 6px;
    gap: 8px;

    .header-left h2 {
      font-size: 15px;
    }
  }

  .date-nav {
    gap: 4px;

    .current-date {
      font-size: 12px;
      min-width: auto;
    }
  }

  .day-view-content {
    margin: 4px;
  }

  .timeline {
    width: 44px;

    .hour-label {
      font-size: 10px;
      padding-right: 4px;
    }
  }

  .current-time-label {
    font-size: 9px;
    padding: 0 2px;
  }

  .empty-hint {
    .empty-hint-title {
      font-size: 13px;
    }
    .empty-hint-desc {
      font-size: 12px;
      max-width: 220px;
    }
  }
}

// Level 4: 超小屏幕（如小窗口分屏）
@media screen and (max-width: 480px) {
  .view-header {
    flex-direction: column;
    align-items: flex-start;

    .header-right {
      width: 100%;
      justify-content: space-between;
    }
  }

  .date-nav .current-date {
    font-size: 11px;
  }
}
</style>
