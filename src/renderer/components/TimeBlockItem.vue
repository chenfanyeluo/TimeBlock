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

    <!-- 拖拽时的实时时间提示（跟随鼠标） -->
    <div v-if="isDragging" class="drag-time-tooltip">
      {{ dragTimeDisplay }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useTimeBlockStore } from '@stores/timeBlock'

const props = defineProps({
  block: { type: Object, required: true },
  hourHeight: { type: Number, default: 60 },
  isMulti: { type: Boolean, default: false },
  multiIndex: { type: Number, default: 0 },
  multiTotal: { type: Number, default: 1 },
  selected: { type: Boolean, default: false }
})

const emit = defineEmits(['update', 'delete', 'select', 'recycle', 'drag-over-pool'])

const store = useTimeBlockStore()
const blockRef = ref(null)
const noteInputRef = ref(null)

const isDragging = ref(false)
const isResizing = ref(false)
const isEditingNote = ref(false)
const noteText = ref('')

// 拖拽状态（纯视觉，不触发 Vue 更新）
const dragOffsetY = ref(0)       // transform 偏移量
const resizeDeltaY = ref(0)     // resize 高度变化量

// 原始数据快照
const snapshotStartMin = ref(0)
const snapshotEndMin = ref(0)

// 使用 block 自带的颜色
const categoryColor = computed(() => props.block.categoryColor || store.getCategoryColor(props.block.category))
const categoryName = computed(() => {
  if (props.block.categoryName) return props.block.categoryName
  return store.getCategoryName(props.block.category)
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
  return minutesToTime(Math.max(0, Math.min(1380, snapshotStartMin.value + Math.round(dragOffsetY.value / props.hourHeight * 60))))
})

const displayEndTime = computed(() => {
  if (!isDragging.value && !isResizing.value) return props.block.endTime
  if (isResizing.value) {
    return minutesToTime(Math.max(snapshotStartMin.value + 15, Math.min(1440, snapshotEndMin.value + Math.round(resizeDeltaY.value / props.hourHeight * 60))))
  }
  return minutesToTime(Math.max(15, Math.min(1440, snapshotEndMin.value + Math.round(dragOffsetY.value / props.hourHeight * 60))))
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
    absBase.transform = `translateY(${dragOffsetY.value}px)`
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
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function snapToGrid(minutes) {
  return Math.round(minutes / 15) * 15
}

// ---- 统一拖拽（移动位置 / 拖到储备栏回收）----

// 用闭包变量记录起始 Y，避免每次重新绑定
let _dragStartClientY = 0
const isOverPool = ref(false)  // 拖动时是否在储备栏区域上方

// 点击选中（与拖拽分离：拖拽是 mousedown+move，点击是 click）
function handleClick() {
  emit('select', props.block.id)
}

// 双击打开备注编辑
function handleDblClick() {
  noteText.value = props.block.note || ''
  isEditingNote.value = true
  // nextTick 后聚焦输入框
  setTimeout(() => {
    noteInputRef.value?.focus()
  }, 50)
}

// 保存备注（失焦或回车触发）
function saveNote() {
  if (!isEditingNote.value) return
  isEditingNote.value = false
  emit('update', { note: noteText.value.trim() || null })
}

function handleMouseDown(e) {
  if (e.target.classList.contains('resize-handle') ||
      e.target.closest('.el-button')) return

  _dragStartClientY = e.clientY
  snapshotStartMin.value = timeToMinutes(props.block.startTime)
  snapshotEndMin.value = timeToMinutes(props.block.endTime)
  dragOffsetY.value = 0

  isDragging.value = true

  document.addEventListener('mousemove', onDragMove, { passive: true })
  document.addEventListener('mouseup', onDragEnd, { once: true })
}

function onDragMove(e) {
  if (!isDragging.value) return
  dragOffsetY.value = e.clientY - _dragStartClientY
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
  const newStart = snapToGrid(snapshotStartMin.value + deltaMinutes)
  const newEnd = snapToGrid(snapshotEndMin.value + deltaMinutes)

  // 重置拖拽状态
  isDragging.value = false
  dragOffsetY.value = 0
  isOverPool.value = false

  // 只在位置确实改变时才 emit
  if (newStart !== timeToMinutes(props.block.startTime)) {
    emit('update', {
      startTime: minutesToTime(Math.max(0, Math.min(1380, newStart))),
      endTime: minutesToTime(Math.max(15, Math.min(1440, newEnd)))
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
  // 限制不能拖到开始时间之上（最小保留15分钟）
  const minDelta = ((snapshotStartMin.value + 15) - snapshotEndMin.value) / 60 * props.hourHeight
  resizeDeltaY.value = Math.max(delta, minDelta)
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
    outline: 2px solid #409eff;
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
    border-left-color: #67c23a;

    .drag-time-tooltip {
      background: #67c23a;
    }

    .drag-time-tooltip::after {
      border-top-color: #67c23a;
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
    color: #909399;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
    max-width: 120px;
  }

  .category-badge {
    font-size: 8px;
    color: #fff;
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
    color: #fff;
    padding: 1px 7px;
    border-radius: 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }
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
  color: #909399;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-editor {
  margin-top: 4px;

  :deep(.el-input__wrapper) {
    padding: 0 6px;
    box-shadow: 0 0 0 1px #c0c4cc inset;
    border-radius: 4px;
    font-size: 11px;

    &.is-focus {
      box-shadow: 0 0 0 1px #409eff inset;
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
  background: #303133;
  color: #fff;
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
    border-top: 5px solid #303133;
  }
}
</style>
