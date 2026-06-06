<template>
  <div
    class="time-block"
    :style="blockStyle"
    :class="{ 'dragging': isDragging, 'resizing': isResizing }"
    @mousedown="handleMouseDown"
  >
    <div class="block-header">
      <span class="time-range">{{ block.startTime }} - {{ block.endTime }}</span>
      <span class="category-badge" :style="{ background: categoryColor }">
        {{ categoryName }}
      </span>
    </div>
    <div class="block-content">{{ block.taskName }}</div>
    <div class="resize-handle" @mousedown.stop="startResize"></div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useTimeBlockStore } from '@stores/timeBlock'

const props = defineProps({
  block: { type: Object, required: true },
  hourHeight: { type: Number, default: 60 }
})

const emit = defineEmits(['update', 'delete'])

const store = useTimeBlockStore()

const isDragging = ref(false)
const isResizing = ref(false)
const dragStartY = ref(0)
const resizeStartY = ref(0)
const originalStart = ref('')
const originalEnd = ref('')

const categoryColor = computed(() => store.getCategoryColor(props.block.category))
const categoryName = computed(() => store.getCategoryName(props.block.category))

const blockStyle = computed(() => {
  const start = timeToMinutes(props.block.startTime)
  const end = timeToMinutes(props.block.endTime)
  const top = (start / 60) * props.hourHeight
  const height = ((end - start) / 60) * props.hourHeight

  return {
    top: `${top}px`,
    height: `${height}px`,
    backgroundColor: `${categoryColor.value}15`,
    borderLeft: `3px solid ${categoryColor.value}`
  }
})

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

function handleMouseDown(e) {
  if (e.target.classList.contains('resize-handle')) return
  isDragging.value = true
  dragStartY.value = e.clientY
  originalStart.value = props.block.startTime
  originalEnd.value = props.block.endTime

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e) {
  if (!isDragging.value) return
  const deltaY = e.clientY - dragStartY.value
  const deltaMinutes = Math.round((deltaY / props.hourHeight) * 60)
  const startMin = timeToMinutes(originalStart.value) + deltaMinutes
  const endMin = timeToMinutes(originalEnd.value) + deltaMinutes

  const snappedStart = snapToGrid(startMin)
  const snappedEnd = snapToGrid(endMin)

  emit('update', {
    startTime: minutesToTime(Math.max(0, Math.min(1380, snappedStart))),
    endTime: minutesToTime(Math.max(15, Math.min(1440, snappedEnd)))
  })
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function startResize(e) {
  isResizing.value = true
  resizeStartY.value = e.clientY
  originalEnd.value = props.block.endTime

  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e) {
  if (!isResizing.value) return
  const deltaY = e.clientY - resizeStartY.value
  const deltaMinutes = Math.round((deltaY / props.hourHeight) * 60)
  const endMin = timeToMinutes(originalEnd.value) + deltaMinutes
  const snappedEnd = snapToGrid(endMin)

  emit('update', {
    endTime: minutesToTime(Math.max(timeToMinutes(props.block.startTime) + 15, Math.min(1440, snappedEnd)))
  })
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}
</script>

<style lang="scss" scoped>
.time-block {
  position: absolute;
  left: 10px;
  right: 10px;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: grab;
  user-select: none;
  overflow: hidden;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  &.dragging {
    cursor: grabbing;
    opacity: 0.8;
    z-index: 100;
  }

  &.resizing {
    z-index: 100;
  }
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;

  .time-range {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .category-badge {
    font-size: 10px;
    color: #fff;
    padding: 2px 8px;
    border-radius: 10px;
  }
}

.block-content {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.resize-handle {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
  background: transparent;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
  }
}
</style>
