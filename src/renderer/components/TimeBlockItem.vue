<template>
  <div
    ref="blockRef"
    class="time-block"
    :class="{
      'dragging': isDragging,
      'resizing': isResizing,
      'is-multi': isMulti,
      'selected': selected,
      'will-recycle': isDragging && isOverPool,
      'compact': isCompact
    }"
    :style="finalStyle"
    @mousedown="handleMouseDown"
    @click.stop="handleClick"
    @dblclick.stop="handleDblClick"
    @touchstart="onBlockTouchStart"
    @touchmove="onBlockTouchMove"
    @touchend="onBlockTouchEnd"
  >
    <!-- 紧凑模式（小块）：单行显示所有内容 -->
    <template v-if="isCompact">
      <div class="compact-row">
        <span class="compact-time">{{ displayStartTime }} - {{ displayEndTime }}</span>
        <span class="compact-name">{{ block.taskName }}</span>
        <span v-if="block.note" class="compact-note-inline">tip:{{ block.note }}</span>
        <span v-if="!block.note" class="category-badge" :style="{ background: categoryColor }">
          {{ categoryName }}
        </span>
      </div>
    </template>

    <!-- 正常模式（大块）：完整布局 -->
    <template v-else>
      <div class="block-header">
        <span class="time-range">{{ displayStartTime }} - {{ displayEndTime }}</span>
        <span class="category-badge" :style="{ background: categoryColor }">
          {{ categoryName }}
        </span>
        <!-- 提醒状态图标 -->
        <span v-if="hasReminder" class="reminder-badge" title="已设置提醒">
          <el-icon><Bell /></el-icon>
        </span>
      </div>
      <div class="block-content">{{ block.taskName }}</div>

      <!-- 备注显示 -->
      <div v-if="block.note && !isEditingNote" class="block-note">tip：{{ block.note }}</div>

      <!-- 双击编辑备注（内联输入框） -->
      <div v-if="isEditingNote" class="note-editor" @click.stop @mousedown.stop>
        <el-input
          ref="noteInputRef"
          v-model="noteText"
          size="small"
          placeholder="输入备注..."
          @blur="saveNote"
          @keyup.enter="saveNote"
        />
      </div>
    </template>

    <!-- 调整大小手柄 -->
    <div class="resize-handle" @mousedown.stop="startResize"></div>

    <!-- 拖拽时的实时时间提示（跟随鼠标/手指） -->
    <div v-if="isDragging" class="drag-time-tooltip">
      {{ dragTimeDisplay }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Bell } from '@element-plus/icons-vue'
import { useTimeBlockStore } from '@stores/timeBlock'

const props = defineProps({
  block: { type: Object, required: true },
  hourHeight: { type: Number, default: 60 },
  isMulti: { type: Boolean, default: false },
  multiIndex: { type: Number, default: 0 },
  multiTotal: { type: Number, default: 1 },
  selected: { type: Boolean, default: false },
  hasReminder: { type: Boolean, default: false }
})

const emit = defineEmits(['update', 'delete', 'select', 'recycle', 'drag-over-pool', 'mobile-block-drag-start', 'mobile-block-drag-move', 'mobile-block-drag-end', 'mobile-context-menu'])

const store = useTimeBlockStore()
const blockRef = ref(null)
const noteInputRef = ref(null)

const isDragging = ref(false)
const isResizing = ref(false)
const isEditingNote = ref(false)
const noteText = ref('')

// 拖拽状态（纯视觉，不触发 Vue 更新）
const dragOffsetY = ref(0)       // transform 偏移量
const dragOffsetX = ref(0)       // 水平偏移量（PC端跟随鼠标）
const resizeDeltaY = ref(0)     // resize 高度变化量

// 原始数据快照
const snapshotStartMin = ref(0)
const snapshotEndMin = ref(0)

// PC端拖拽起始位置
let _dragStartClientY = 0
let _dragStartClientX = 0

// ---- 移动端触摸拖拽状态 ----
let _mobileBlockDragTimer = null
let _isMobileBlockDragging = false
let _mobileDragStartY = 0         // 拖拽起始触摸 Y（用于计算 dragOffsetY）
const MOBILE_BLOCK_DRAG_DELAY = 400 // 长按触发拖拽的延迟（毫秒）
const isMobileDevice = ref(false) // 判断是否移动端

// ---- 移动端双击检测 ----
let _lastTouchTime = 0            // 上次触摸时间（用于双击检测）
let _lastTouchX = 0               // 上次触摸 X 坐标
let _lastTouchY = 0               // 上次触摸 Y 坐标
const DOUBLE_TAP_INTERVAL = 300   // 双击间隔（毫秒）
const DOUBLE_TAP_DISTANCE = 30    // 双击位置允许偏差（像素）
let _isDoubleTap = false          // 是否是双击
let _singleTapTimer = null        // 单击延迟触发计时器

// 检测是否为移动端
function checkMobile() {
  isMobileDevice.value = window.innerWidth < 768 || 'ontouchstart' in window
}
checkMobile()
window.addEventListener('resize', checkMobile)

// 使用 block 自带的颜色/名称（统一 noteXxx 字段）
const categoryColor = computed(() =>
  props.block.noteColor ||
  store.getNoteColor(props.block.noteId)
)
const categoryName = computed(() => {
  if (props.block.noteName) return props.block.noteName
  return store.getNoteName(props.block.noteId)
})

// 块高度 < 35px 时使用紧凑模式（保证小任务也能看清名称）
const isComputedHeight = computed(() => {
  const start = timeToMinutes(props.block.startTime)
  const end = timeToMinutes(props.block.endTime)
  return ((end - start) / 60) * props.hourHeight
})
// 基于原始数据高度判断紧凑模式（不受 minHeight 干扰）
const isCompact = computed(() => isComputedHeight.value < 35)

// 显示的时间（拖拽/resize 过程中显示预览值）
const displayStartTime = computed(() => {
  if (!isDragging.value && !isResizing.value) return props.block.startTime

  if (isResizing.value) {
    // resize 过程中开始时间不变
    return props.block.startTime
  }

  // 拖动过程中：与 onDragEnd 保持一致的逻辑
  const originalDuration = snapshotEndMin.value - snapshotStartMin.value
  const deltaMinutes = Math.round(dragOffsetY.value / props.hourHeight * 60)
  const granularity = store.timeGranularity || 15

  const rawNewStart = snapshotStartMin.value + deltaMinutes
  const rawNewEnd = rawNewStart + originalDuration

  let boundedStart = Math.max(0, rawNewStart)
  let boundedEnd = Math.min(1440, rawNewEnd)

  if (boundedEnd - boundedStart < granularity) {
    if (rawNewStart < granularity) {
      boundedStart = 0
      boundedEnd = originalDuration
    } else {
      boundedEnd = 1440
      boundedStart = 1440 - originalDuration
    }
  }

  let previewStart = snapToGrid(boundedStart)
  let previewEnd = snapToGrid(boundedEnd)

  if (previewEnd - previewStart < granularity) {
    previewEnd = snapToGrid(previewStart + granularity)
    if (previewEnd > 1440) previewEnd = 1440
  }

  return minutesToTime(previewStart)
})

const displayEndTime = computed(() => {
  if (!isDragging.value && !isResizing.value) return props.block.endTime

  if (isResizing.value) {
    // resize 过程中：只改变结束时间，截断到24:00
    const deltaMinutes = Math.round(resizeDeltaY.value / props.hourHeight * 60)
    const previewEnd = snapshotEndMin.value + deltaMinutes
    const minEnd = snapshotStartMin.value + (store.timeGranularity || 15)
    return minutesToTime(Math.max(minEnd, Math.min(1440, previewEnd)))
  }

  // 拖动过程中：与 displayStartTime 保持一致的逻辑
  const originalDuration = snapshotEndMin.value - snapshotStartMin.value
  const deltaMinutes = Math.round(dragOffsetY.value / props.hourHeight * 60)
  const granularity = store.timeGranularity || 15

  const rawNewStart = snapshotStartMin.value + deltaMinutes
  const rawNewEnd = rawNewStart + originalDuration

  let boundedStart = Math.max(0, rawNewStart)
  let boundedEnd = Math.min(1440, rawNewEnd)

  if (boundedEnd - boundedStart < granularity) {
    if (rawNewStart < granularity) {
      boundedStart = 0
      boundedEnd = originalDuration
    } else {
      boundedEnd = 1440
      boundedStart = 1440 - originalDuration
    }
  }

  let previewStart = snapToGrid(boundedStart)
  let previewEnd = snapToGrid(boundedEnd)

  if (previewEnd - previewStart < granularity) {
    previewEnd = snapToGrid(previewStart + granularity)
    if (previewEnd > 1440) previewEnd = 1440
  }

  return minutesToTime(previewEnd)
})

// 拖拽时 tooltip 显示的时间
const dragTimeDisplay = computed(() => `${displayStartTime.value} ~ ${displayEndTime.value}`)

// 最终样式：统一绝对定位，多任务通过 left/width 并排
const finalStyle = computed(() => {
  const baseStyle = {
    backgroundColor: `${categoryColor.value}18`,
    borderLeft: `3px solid ${categoryColor.value}`
  }

  // 统一使用绝对定位（基于自身 startTime/top）
  const start = timeToMinutes(props.block.startTime)
  const end = timeToMinutes(props.block.endTime)
  const top = (start / 60) * props.hourHeight
  let height = ((end - start) / 60) * props.hourHeight

  // resize 时动态调整高度
  if (isResizing.value) {
    height += resizeDeltaY.value
  }

  const absBase = {
    ...baseStyle,
    top: `${top}px`,
    // 不设最小高度，让自然高度决定紧凑模式；resize 时最低 18px（约18分钟）
    height: `${isResizing.value ? Math.max(height, 18) : Math.max(height, 16)}px`,
    position: 'absolute',
  }

  // 拖拽/resize 时叠加 transform
  if (isDragging.value || isResizing.value) {
    absBase.transform = `translate(${dragOffsetX.value}px, ${dragOffsetY.value}px)`
    absBase.zIndex = 1000
    absBase.willChange = 'transform'
  }

  if (props.isMulti && props.multiTotal > 1) {
    // 多任务并排：计算每列的 left 和 width
    const padding = 8   // 左右各 4px 边距
    const gap = 4       // 列间距
    const innerW = `calc(100% - ${padding}px)`
    const colW = `calc((${innerW} - ${(props.multiTotal - 1) * gap}px) / ${props.multiTotal})`

    return {
      ...absBase,
      left: `calc(${padding / 2}px + ${props.multiIndex} * (${colW} + ${gap}px))`,
      width: colW,
    }
  }

  // 单任务：撑满宽度
  return {
    ...absBase,
    left: '4px',
    right: '4px',
  }
})

// ---- 工具函数 ----

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes) {
  // 特殊处理：1440分钟 = 24:00（允许结束时间为24:00）
  if (minutes >= 1440) return '24:00'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(Math.min(23, h)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function snapToGrid(minutes, maxMinutes = 1440) {
  // 先限制在有效范围内，再对齐网格（最大1440分钟=24:00）
  const granularity = store.timeGranularity || 15
  const clamped = Math.max(0, Math.min(maxMinutes, minutes))
  return Math.round(clamped / granularity) * granularity
}

// ---- 统一拖拽（移动位置 / 拖到储备栏回收）----

const isOverPool = ref(false)  // 拖动时是否在储备栏区域上方

// 点击选中（与拖拽分离：拖拽是 mousedown+move，点击是 click）
// 移动端：touchend 已处理单击弹出上下文菜单，这里不处理（避免重复）
function handleClick(e) {
  // 如果需要阻止这次 click（长按或单击已处理），直接返回
  if (_suppressNextClick) {
    _suppressNextClick = false
    return
  }

  if (isMobileDevice.value) {
    // 移动端：touchend 已处理，这里不做任何操作
    return
  } else {
    // PC端：选中时间块
    emit('select', props.block.id)
  }
}

// 双击打开备注编辑
function handleDblClick() {
  noteText.value = props.block.note || ''
  isEditingNote.value = true
  // nextTick 后聚焦输入框
  setTimeout(() => {
    noteInputRef.value?.focus()
  }, 50)

  // 添加全局点击/触摸监听器，点击外部元素时关闭编辑
  document.addEventListener('click', handleExternalClick, { capture: true })
  document.addEventListener('touchstart', handleExternalTouch, { capture: true, passive: false })
}

// 点击外部元素时关闭备注编辑（PC端）
function handleExternalClick(e) {
  if (!isEditingNote.value) return

  // 检查点击是否在编辑区域内部
  const noteEditor = noteInputRef.value?.$el || noteInputRef.value
  if (noteEditor && (e.target === noteEditor || noteEditor.contains(e.target))) {
    return // 点击在编辑区域内，不关闭
  }

  // 点击在编辑区域外，保存并关闭
  saveNote()
}

// 触摸外部元素时关闭备注编辑（移动端）
function handleExternalTouch(e) {
  if (!isEditingNote.value) return

  // 检查触摸是否在编辑区域内部
  const noteEditor = noteInputRef.value?.$el || noteInputRef.value
  if (noteEditor) {
    for (const touch of e.touches) {
      const target = document.elementFromPoint(touch.clientX, touch.clientY)
      if (target && (target === noteEditor || noteEditor.contains(target))) {
        return // 触摸在编辑区域内，不关闭
      }
    }
  }

  // 触摸在编辑区域外，保存并关闭
  e.preventDefault() // 阻止后续事件
  saveNote()
}

// 保存备注（失焦或回车触发）
function saveNote() {
  if (!isEditingNote.value) return
  isEditingNote.value = false
  // 移除全局点击/触摸监听器
  document.removeEventListener('click', handleExternalClick, { capture: true })
  document.removeEventListener('touchstart', handleExternalTouch, { capture: true })
  emit('update', { note: noteText.value.trim() || null })
}

function handleMouseDown(e) {
  if (e.target.classList.contains('resize-handle') ||
      e.target.closest('.el-button')) return

  _dragStartClientY = e.clientY
  _dragStartClientX = e.clientX
  snapshotStartMin.value = timeToMinutes(props.block.startTime)
  snapshotEndMin.value = timeToMinutes(props.block.endTime)
  dragOffsetY.value = 0
  dragOffsetX.value = 0

  isDragging.value = true

  document.addEventListener('mousemove', onDragMove, { passive: true })
  document.addEventListener('mouseup', onDragEnd, { once: true })
}

function onDragMove(e) {
  if (!isDragging.value) return
  dragOffsetY.value = e.clientY - _dragStartClientY
  dragOffsetX.value = e.clientX - _dragStartClientX
  // 用 elementFromPoint 检测鼠标是否在储备栏 DOM 区域上方
  const over = isMouseOverPool(e.clientX, e.clientY)
  isOverPool.value = over
  emit('drag-over-pool', over)
}

// 检测鼠标是否在 .task-pool 元素上方
function isMouseOverPool(x, y) {
  const el = document.elementFromPoint(x, y)
  return el && (el.classList.contains('task-pool') || el.closest('.task-pool'))
}

function onDragEnd(e) {
  if (!isDragging.value) return

  // 检测是否拖到储备栏区域进行回收
  const overPool = isMouseOverPool(e.clientX, e.clientY)

  // 离开拖拽状态前通知父组件取消高亮
  emit('drag-over-pool', false)

  if (overPool) {
    // 回收：通知父组件删除块并回收到储备栏
    isDragging.value = false
    dragOffsetY.value = 0
    dragOffsetX.value = 0
    isOverPool.value = false

    emit('recycle', {
      blockId: props.block.id,
      taskName: props.block.taskName,
      categoryColor: categoryColor.value,
    })
    document.removeEventListener('mousemove', onDragMove)
    return
  }


  // 正常移动：松开鼠标时一次性提交最终结果
  const deltaMinutes = Math.round((dragOffsetY.value / props.hourHeight) * 60)
  const originalDuration = snapshotEndMin.value - snapshotStartMin.value // 保持原始时长
  const granularity = store.timeGranularity || 15

  // 步骤1：计算原始意图位置（不对齐网格）
  const rawNewStart = snapshotStartMin.value + deltaMinutes
  const rawNewEnd = rawNewStart + originalDuration

  // 步骤2：先截断到有效边界
  let boundedStart = Math.max(0, rawNewStart)
  let boundedEnd = Math.min(1440, rawNewEnd)

  // 步骤3：如果截断后时长太小，整体移动到边界（保持时长）
  if (boundedEnd - boundedStart < granularity) {
    if (rawNewStart < granularity) {
      // 靠近上边界：固定在顶部，保持时长
      boundedStart = 0
      boundedEnd = originalDuration
    } else {
      // 靠近下边界：固定在底部，保持时长
      boundedEnd = 1440
      boundedStart = 1440 - originalDuration
    }
  }

  // 步骤4：对齐网格
  let newStart = snapToGrid(boundedStart)
  let newEnd = snapToGrid(boundedEnd)

  // 步骤5：确保最小时长（只扩大结束时间）
  if (newEnd - newStart < granularity) {
    newEnd = snapToGrid(newStart + granularity)
    if (newEnd > 1440) newEnd = 1440
  }

  // 重置拖拽状态
  isDragging.value = false
  dragOffsetY.value = 0
  dragOffsetX.value = 0
  isOverPool.value = false

  // 只在位置确实改变时才 emit
  if (newStart !== timeToMinutes(props.block.startTime)) {
    emit('update', {
      startTime: minutesToTime(newStart),
      endTime: minutesToTime(newEnd)
    })
  }

  document.removeEventListener('mousemove', onDragMove)
}

// ---- 调整大小（同上策略）----

let _resizeStartClientY = 0

function startResize(e) {
  _resizeStartClientY = e.clientY
  snapshotStartMin.value = timeToMinutes(props.block.startTime)
  snapshotEndMin.value = timeToMinutes(props.block.endTime)
  resizeDeltaY.value = 0

  isResizing.value = true

  document.addEventListener('mousemove', onResizeMove, { passive: true })
  document.addEventListener('mouseup', onResizeEnd, { once: true })
}

function onResizeMove(e) {
  if (!isResizing.value) return
  let delta = e.clientY - _resizeStartClientY

  // 限制最小值：不能拖到开始时间之上（最小保留15分钟）
  const minDelta = ((snapshotStartMin.value + 15) - snapshotEndMin.value) / 60 * props.hourHeight

  // 计算最大值：结束时间恰好为1440分钟（24:00）时的delta
  const maxEndMinutes = 1440
  const maxDeltaMinutes = maxEndMinutes - snapshotEndMin.value
  const maxDelta = maxDeltaMinutes / 60 * props.hourHeight

  // 应用限制：
  // - 最小值限制：保持最小时长15分钟
  // - 最大值限制：如果超过最大值，固定在最大值（让时间块底部固定在24:00）
  resizeDeltaY.value = Math.max(minDelta, Math.min(delta, maxDelta))
}

function onResizeEnd() {
  if (!isResizing.value) return

  const deltaMinutes = Math.round((resizeDeltaY.value / props.hourHeight) * 60)
  const newEnd = snapToGrid(snapshotEndMin.value + deltaMinutes)

  isResizing.value = false
  resizeDeltaY.value = 0

  const minEnd = snapshotStartMin.value + 15
  // 允许 newEnd == minEnd（恰好是最小值时也要保存）
  if (newEnd !== snapshotEndMin.value && newEnd >= minEnd) {
    emit('update', {
      endTime: minutesToTime(Math.min(1440, newEnd))
    })
  }

  document.removeEventListener('mousemove', onResizeMove)
}

// ---- 移动端触摸拖拽（拖到便签栏回收）----
let _mobileTouchMoved = false // 记录触摸过程中是否发生了移动
let _suppressNextClick = false // 是否需要阻止后续的 click 事件

/**
 * 移动端：触摸开始，启动长按计时器
 */
function onBlockTouchStart(e) {
  if (!isMobileDevice.value || e.touches.length !== 1) return
  // 忽略 resize 手柄上的触摸
  if (e.target.classList.contains('resize-handle')) return

  // 阻止默认行为（防止浏览器长按弹出菜单）
  e.preventDefault()

  const touch = e.touches[0]
  const now = Date.now()

  // ---- 双击检测 ----
  const timeDiff = now - _lastTouchTime
  const distanceX = Math.abs(touch.clientX - _lastTouchX)
  const distanceY = Math.abs(touch.clientY - _lastTouchY)

  if (timeDiff < DOUBLE_TAP_INTERVAL && distanceX < DOUBLE_TAP_DISTANCE && distanceY < DOUBLE_TAP_DISTANCE) {
    // 双击：触发备注编辑
    _isDoubleTap = true
    _suppressNextClick = true // 阻止后续单击上下文菜单
    _lastTouchTime = 0 // 重置，避免三击被误判

    // 清除长按计时器和单击计时器
    if (_mobileBlockDragTimer) {
      clearTimeout(_mobileBlockDragTimer)
      _mobileBlockDragTimer = null
    }
    if (_singleTapTimer) {
      clearTimeout(_singleTapTimer)
      _singleTapTimer = null
    }

    // 触发双击编辑
    handleDblClick()
    return
  }

  // ---- 单击处理 ----
  _isDoubleTap = false
  _lastTouchTime = now
  _lastTouchX = touch.clientX
  _lastTouchY = touch.clientY

  _mobileTouchMoved = false
  _suppressNextClick = false

  // 启动长按计时器（长按触发拖拽）
  _mobileBlockDragTimer = setTimeout(() => {
    // 只有未发生移动时才触发拖拽
    if (!_mobileTouchMoved) {
      _isMobileBlockDragging = true
      _suppressNextClick = true // 长按触发拖拽时，阻止后续 click 事件

      // 记录拖拽起始触摸位置（用于计算时间轴偏移）
      _mobileDragStartY = touch.clientY

      // 设置时间轴拖拽状态（复用 PC 端逻辑）
      snapshotStartMin.value = timeToMinutes(props.block.startTime)
      snapshotEndMin.value = timeToMinutes(props.block.endTime)
      dragOffsetY.value = 0
      isDragging.value = true

      // 通知父组件开始拖拽
      emit('mobile-block-drag-start', {
        block: props.block,
        startX: touch.clientX,
        startY: touch.clientY,
        categoryColor: categoryColor.value,
        categoryName: categoryName.value
      })
    }
  }, MOBILE_BLOCK_DRAG_DELAY)
}

/**
 * 移动端：触摸移动，如果在拖拽状态则通知父组件更新位置
 */
function onBlockTouchMove(e) {
  if (e.touches.length !== 1) return

  // 标记发生了移动（取消单击/长按逻辑）
  _mobileTouchMoved = true

  // 清除长按计时器（移动时取消长按触发）
  if (_mobileBlockDragTimer) {
    clearTimeout(_mobileBlockDragTimer)
    _mobileBlockDragTimer = null
  }

  if (!_isMobileBlockDragging) return

  e.preventDefault() // 拖拽时阻止页面滚动
  const touch = e.touches[0]

  // 更新时间轴偏移（复用 PC 端 dragOffsetY 逻辑）
  dragOffsetY.value = touch.clientY - _mobileDragStartY

  // 检测是否在便签栏区域上方
  const over = isMouseOverPool(touch.clientX, touch.clientY)
  isOverPool.value = over
  emit('drag-over-pool', over)

  emit('mobile-block-drag-move', {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
}

/**
 * 移动端：触摸结束
 * - 长按触发拖拽：结束拖拽
 * - 短触摸（单击）：触发上下文菜单
 * - 移动触摸：不做处理（滑动取消）
 */
function onBlockTouchEnd(e) {
  // 清理长按计时器
  if (_mobileBlockDragTimer) {
    clearTimeout(_mobileBlockDragTimer)
    _mobileBlockDragTimer = null
  }

  // 阻止默认行为（防止浏览器触发额外的菜单或事件）
  e.preventDefault()

  if (_isMobileBlockDragging) {
    // 长按拖拽结束：处理时间轴重定位或便签栏回收
    _isMobileBlockDragging = false
    _mobileTouchMoved = false
    const touch = e.changedTouches[0]

    // 检测是否拖到便签栏区域进行回收
    const overPool = isMouseOverPool(touch.clientX, touch.clientY)

    // 离开拖拽状态前通知父组件取消高亮
    emit('drag-over-pool', false)

    if (overPool) {
      // 回收：通知父组件删除块并回收到便签栏
      isDragging.value = false
      dragOffsetY.value = 0
      isOverPool.value = false

      emit('recycle', {
        blockId: props.block.id,
        taskName: props.block.taskName,
        categoryColor: categoryColor.value,
      })
    } else {
      // 时间轴重定位：计算新时间（与 PC 端 onDragEnd 逻辑一致）
      const deltaMinutes = Math.round((dragOffsetY.value / props.hourHeight) * 60)
      const originalDuration = snapshotEndMin.value - snapshotStartMin.value
      const granularity = store.timeGranularity || 15

      const rawNewStart = snapshotStartMin.value + deltaMinutes
      const rawNewEnd = rawNewStart + originalDuration

      let boundedStart = Math.max(0, rawNewStart)
      let boundedEnd = Math.min(1440, rawNewEnd)

      if (boundedEnd - boundedStart < granularity) {
        if (rawNewStart < granularity) {
          boundedStart = 0
          boundedEnd = originalDuration
        } else {
          boundedEnd = 1440
          boundedStart = 1440 - originalDuration
        }
      }

      let newStart = snapToGrid(boundedStart)
      let newEnd = snapToGrid(boundedEnd)

      if (newEnd - newStart < granularity) {
        newEnd = snapToGrid(newStart + granularity)
        if (newEnd > 1440) newEnd = 1440
      }

      // 重置拖拽状态
      isDragging.value = false
      dragOffsetY.value = 0
      isOverPool.value = false

      // 只在位置确实改变时才 emit
      if (newStart !== timeToMinutes(props.block.startTime)) {
        emit('update', {
          startTime: minutesToTime(newStart),
          endTime: minutesToTime(newEnd)
        })
      }
    }

    // 通知父组件移动端拖拽结束
    emit('mobile-block-drag-end', {
      block: props.block,
      clientX: touch.clientX,
      clientY: touch.clientY,
      categoryColor: categoryColor.value,
      categoryName: categoryName.value
    })
  } else if (!_mobileTouchMoved && !_isDoubleTap) {
    // 短触摸（单击）：延迟触发上下文菜单，等待可能的第二次点击（双击检测）
    const touch = e.changedTouches[0]

    // 清除之前的单击计时器
    if (_singleTapTimer) {
      clearTimeout(_singleTapTimer)
    }

    // 延迟触发单击，等待双击检测时间窗口
    _singleTapTimer = setTimeout(() => {
      if (_isDoubleTap) return // 如果已经触发双击，不触发单击

      _suppressNextClick = true
      _mobileTouchMoved = false
      _isDoubleTap = false
      _singleTapTimer = null

      emit('mobile-context-menu', {
        block: props.block,
        clientX: touch.clientX,
        clientY: touch.clientY
      })
    }, DOUBLE_TAP_INTERVAL)
  } else {
    // 移动触摸（滑动）或双击后：重置状态
    _mobileTouchMoved = false
    _isDoubleTap = false
    if (_singleTapTimer) {
      clearTimeout(_singleTapTimer)
      _singleTapTimer = null
    }
  }
}
</script>

<style lang="scss" scoped>
.time-block {
  border-radius: 8px;
  padding: 6px 10px;
  cursor: grab;
  user-select: none;
  overflow: hidden;

  &:hover:not(.dragging):not(.resizing) {
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
  }

  &.selected {
    outline: 2px solid var(--primary-color);
    outline-offset: -1px;
    box-shadow: 0 4px 16px rgba(64, 158, 255, 0.25);
  }

  &.dragging {
    cursor: grabbing;
    opacity: 0.9;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  &.resizing {
    cursor: ns-resize;
  }

  &.will-recycle {
    opacity: 0.5;
    border-left-color: var(--success-color);

    .drag-time-tooltip {
      background: var(--success-color);
    }

    .drag-time-tooltip::after {
      border-top-color: var(--success-color);
    }
  }

  // 紧凑模式（小块）：单行布局
  &.compact {
    padding: 3px 8px;

    .block-header,
    .block-content,
    .block-note,
    .note-editor {
      display: none;
    }
  }
}

// 紧凑模式单行布局
.compact-row {
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1.2;

  .compact-time {
    font-size: 9px;
    color: var(--text-secondary);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .compact-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .compact-note-inline {
    font-size: 10px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
    max-width: 120px;
  }

  .category-badge {
    font-size: 8px;
    color: var(--text-on-primary);
    padding: 0 4px;
    border-radius: 6px;
    white-space: nowrap;
    flex-shrink: 0;
    line-height: 15px;
  }
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;

  .time-range {
    font-size: 11px;
    color: var(--text-secondary);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .category-badge {
    font-size: 10px;
    color: var(--text-on-primary);
    padding: 1px 7px;
    border-radius: 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .reminder-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background: var(--color-warning);
    border-radius: 50%;
    color: #fff;
    font-size: 12px;
    flex-shrink: 0;
    animation: pulse 2s infinite;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.block-content {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.block-note {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-editor {
  margin-top: 4px;

  :deep(.el-input__wrapper) {
    padding: 0 6px;
    box-shadow: 0 0 0 1px var(--border-color) inset;
    border-radius: 4px;
    font-size: 11px;

    &.is-focus {
      box-shadow: 0 0 0 1px var(--primary-color) inset;
    }
  }

  :deep(.el-input__inner) {
    height: 22px;
    line-height: 22px;
  }
}

.resize-handle {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 7px;
  cursor: ns-resize;
  background: transparent;
  border-radius: 0 0 8px 8px;

  &:hover {
    background: rgba(64, 158, 255, 0.15);
  }
}

// 拖拽时跟随鼠标的时间提示
.drag-time-tooltip {
  position: absolute;
  top: -28px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--tooltip-bg);
  color: var(--tooltip-color);
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1001;

  &::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid var(--tooltip-bg);
  }
}
</style>
