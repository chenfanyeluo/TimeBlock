<template>
  <div
    class="task-pool"
    :class="{ 'drop-active': isDropOver || highlighted, 'is-collapsed': isCollapsed }"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- 折叠模式：仅显示图标和便签数量 -->
    <div v-if="isCollapsed" class="pool-collapsed-view">
      <el-icon :size="20" color="var(--text-secondary)"><Tickets /></el-icon>
      <span class="collapsed-count">{{ noteList.length }}</span>
    </div>

    <!-- 展开模式：完整面 -->
    <template v-else>
      <div class="pool-header">
        <h3>便签</h3>
        <el-button type="primary" size="small" :icon="Plus" @click="showAddDialog = true">
          添加
        </el-button>
      </div>

      <div class="pool-tips" :class="{ 'pending-tip': props.pendingBlock }">
        {{ props.pendingBlock ? '点击便签完成创建 →' : '拖拽便签到右侧时间轴即可快速安排' }}
        <span v-if="!props.isMobile && !props.pendingBlock" class="tip-hint">
          （Ctrl/Alt/Shift + 点击可激活便签）
        </span>
      </div>

      <!-- 便签列表 -->
      <div class="pool-list">
        <div
          v-for="note in noteList"
          :key="note.id"
          class="pool-item"
          :class="{
            'is-active': props.activeNoteId === note.id,
            'pending-mode': props.pendingBlock
          }"
          :style="{ borderColor: note.color }"
          draggable="true"
          @dragstart="onDragStart($event, note)"
          @click.stop="handleNoteClick(note, $event)"
          @touchstart="onPoolItemTouchStart($event, note)"
          @touchmove="onPoolItemTouchMove($event)"
          @touchend="onPoolItemTouchEnd($event)"
        >
          <div class="item-color" :style="{ background: note.color }"></div>
          <span class="item-name">{{ note.name }}</span>
          <!-- 激活状态标识 -->
          <el-icon v-if="props.activeNoteId === note.id" class="active-icon" :size="14">
            <Tickets />
          </el-icon>
          <el-button
            type="danger"
            size="small"
            :icon="Delete"
            circle
            class="delete-btn"
            @click.stop="removeNote(note.id)"
          />
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="noteList.length === 0" class="pool-empty">
        <p>暂无便签</p>
        <p>点击上方"添加"按钮创建便签</p>
      </div>

      <!-- 添加/编辑便签对话框 -->
      <el-dialog v-model="showAddDialog" :title="dialogTitle" width="400px">
        <el-form :model="newNote" label-width="80px">
          <el-form-item label="便签名称">
            <el-input v-model="newNote.name" placeholder="例如：工作、学习、运动" />
          </el-form-item>
          <el-form-item label="颜色">
            <el-color-picker v-model="newNote.color" />
          </el-form-item>
          <el-form-item label="默认时长">
            <el-select v-model="newNote.duration" placeholder="选择时长">
              <el-option label="15分钟" :value="15" />
              <el-option label="30分钟" :value="30" />
              <el-option label="45分钟" :value="45" />
              <el-option label="1小时" :value="60" />
              <el-option label="1.5小时" :value="90" />
              <el-option label="2小时" :value="120" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showAddDialog = false">取消</el-button>
          <el-button type="primary" @click="confirmNote">确定</el-button>
        </template>
      </el-dialog>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Delete, Plus, Tickets } from '@element-plus/icons-vue'
import { ElMessage } from '@utils/message'
import { useTimeBlockStore } from '@stores/timeBlock'

const emit = defineEmits(['dragstart', 'recycle-block', 'note-click', 'mobile-drag-start', 'mobile-drag-move', 'mobile-drag-end'])

const store = useTimeBlockStore()

// 折叠状态（由父组件通过 class 控制）
const props = defineProps({
  highlighted: { type: Boolean, default: false },
  isCollapsed: { type: Boolean, default: false },
  activeNoteId: { type: String, default: null },
  pendingBlock: { type: Object, default: null },
  isMobile: { type: Boolean, default: false }
})

// 直接使用 store.notes 作为数据源
const noteList = computed(() => store.notes)
const showAddDialog = ref(false)
const isDropOver = ref(false)
const dialogTitle = ref('添加便签')
const editingId = ref(null)

const newNote = ref({
  name: '',
  color: '#409eff',
  duration: 30
})

// ---- 移动端触摸拖拽状态 ----
let _longPressTimer = null
let _isMobileDragging = false
let _mobileDragNote = null
let _mobileDragStartX = 0
let _mobileDragStartY = 0
const MOBILE_LONG_PRESS_DELAY = 400 // 长按触发拖拽的延迟（毫秒）

/**
 * 移动端：触摸开始，启动长按计时器
 */
function onPoolItemTouchStart(e, note) {
  if (!props.isMobile || e.touches.length !== 1) return

  const touch = e.touches[0]
  _mobileDragStartX = touch.clientX
  _mobileDragStartY = touch.clientY
  _mobileDragNote = note

  // 启动长按计时器
  _longPressTimer = setTimeout(() => {
    _isMobileDragging = true
    // 通知父组件开始拖拽
    emit('mobile-drag-start', {
      note,
      startX: _mobileDragStartX,
      startY: _mobileDragStartY
    })
  }, MOBILE_LONG_PRESS_DELAY)
}

/**
 * 移动端：触摸移动，如果在拖拽状态则通知父组件更新位置
 */
function onPoolItemTouchMove(e) {
  if (!_isMobileDragging || e.touches.length !== 1) return

  e.preventDefault() // 拖拽时阻止页面滚动
  const touch = e.touches[0]
  emit('mobile-drag-move', {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
}

/**
 * 移动端：触摸结束，结束拖拽并通知父组件
 */
function onPoolItemTouchEnd(e) {
  // 清理长按计时器
  if (_longPressTimer) {
    clearTimeout(_longPressTimer)
    _longPressTimer = null
  }

  if (_isMobileDragging) {
    _isMobileDragging = false
    const touch = e.changedTouches[0]
    emit('mobile-drag-end', {
      note: _mobileDragNote,
      clientX: touch.clientX,
      clientY: touch.clientY
    })
    _mobileDragNote = null
  }
}

// 拖拽开始
function onDragStart(event, note) {
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'note',
    noteId: note.id,
    noteName: note.name,
    noteColor: note.color,
    duration: 30
  }))
  emit('dragstart', note)
}

// 便签点击处理
function handleNoteClick(note, event) {
  emit('note-click', note, event)
}

// 添加/编辑确认
function confirmNote() {
  if (!newNote.value.name.trim()) {
    ElMessage.warning('请输入便签名')
    return
  }

  if (editingId.value) {
    // 编辑模式
    const idx = store.notes.findIndex(n => n.id === editingId.value)
    if (idx !== -1) {
      store.notes[idx] = {
        ...store.notes[idx],
        name: newNote.value.name.trim(),
        color: newNote.value.color
      }
      ElMessage.success(`便签"${newNote.value.name}"已更新`)
    }
  } else {
    // 新增模式
    const id = `note-${Date.now()}`
    store.notes.push({
      id,
      name: newNote.value.name.trim(),
      color: newNote.value.color
    })
    ElMessage.success(`便签"${newNote.value.name}"已添加`)
  }

  showAddDialog.value = false
  resetForm()
}

// 删除便签
function removeNote(id) {
  const idx = store.notes.findIndex(n => n.id === id)
  if (idx !== -1) {
    const name = store.notes[idx].name
    store.notes.splice(idx, 1)
    ElMessage.success(`已删除便签"${name}"`)
  }
}

function resetForm() {
  editingId.value = null
  dialogTitle.value = '添加便签'
  newNote.value = {
    name: '',
    color: '#409eff',
    duration: 30
  }
}

// ---- 接收日视图块的拖放回调 ----

function onDragOver(e) {
  e.dataTransfer.dropEffect = 'move'
  isDropOver.value = true
}

function onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    isDropOver.value = false
  }
}

function onDrop(e) {
  e.preventDefault()
  isDropOver.value = false

  try {
    const data = JSON.parse(e.dataTransfer.getData('application/json'))

    // 只处理来自日视图的块（type: 'block')
    if (data.type === 'block') {
      // 回收到便签栏（去重：同名便签最多保留一个）
      recycleNote(data.noteName || data.taskName, data.noteColor)

      // 通知父组件删除日视图中的块
      emit('recycle-block', data.blockId)
    }
  } catch (err) {
    console.error('Pool drop error:', err)
  }
}

// 回收块到便签栏（去重）供父组件通过 ref 调用
function recycleTask(noteName, color, categoryName, categoryId) {
  recycleNote(noteName, color)
}

function recycleNote(name, color) {
  const existing = store.notes.find(n => n.name === name)
  if (existing) {
    ElMessage.info(`"${name}"已在便签栏中`)
    return
  }

  store.notes.push({
    id: `recycled-${Date.now()}`,
    name: name,
    color: color || '#909399'
  })
  ElMessage.success(`"${name}"已回收到便签栏`)
}

// 暴露给父组件 ref 调用（保持兼容）
defineExpose({ recycleTask })
</script>

<style lang="scss" scoped>
.task-pool {
  width: 220px;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  height: 100%;
  flex-shrink: 0;
  transition: width 0.25s ease, min-width 0.25s ease;
  overflow: hidden;

  // 移动端竖屏模式（≤767px）：右侧窄条布局
  @media screen and (max-width: 767px) {
    order: 3; // 移到最右侧（配合父容器 flex 布局）
    width: 68px; // 统一移动端宽度
    min-width: 68px;
    border-right: none;
    border-left: 1px solid var(--border-light);

    // 紧凑显示模式
    .pool-header {
      padding: 8px 4px;
      flex-direction: column;
      gap: 6px;

      h3 {
        font-size: 12px;
        text-align: center;
        display: block;
        width: 100%;
      }

      .el-button {
        padding: 4px 8px;
        font-size: 11px;
        min-width: 50px;
        white-space: nowrap;
      }
    }

    .pool-tips {
      padding: 6px 8px;
      font-size: 11px;
      text-align: center;
      display: none; // 移动端隐藏提示文字,节省空间

      &.pending-tip {
        display: block;
        padding: 4px 6px;
        font-size: 11px;
      }
    }

    .pool-list {
      padding: 6px 0;
    }

    .pool-item {
      padding: 7px 4px;
      margin: 4px 5px;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      min-height: 50px;
      border-left: none;
      border: 2px solid transparent !important;
      border-radius: 8px;

      .item-color {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        margin-bottom: 0;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
      }

      .item-name {
        font-size: 11px;
        text-align: center;
        writing-mode: horizontal-tb; // 改为横向文字,更易阅读
        line-height: 1.2;
        max-height: 26px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: normal;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        width: 100%;
      }

      .delete-btn {
        display: none !important; // 移动端隐藏删除按钮
      }

      .active-icon {
        display: none; // 移动端隐藏激活图标
      }

      &:hover .delete-btn {
        display: none !important; // 强制隐藏
      }

      // 激活状态:边框高亮 + 背景色
      &.is-active {
        border-color: var(--primary-color) !important;
        background: linear-gradient(135deg, rgba(64, 158, 255, 0.12), rgba(64, 158, 255, 0.2));
        box-shadow: 0 2px 10px rgba(64, 158, 255, 0.25);

        .item-name {
          color: var(--primary-color);
          font-weight: 600;
        }
      }

      // pending 模式:橙色边框提示
      &.pending-mode {
        border-color: var(--warning-color) !important;
        background: linear-gradient(135deg, rgba(230, 162, 60, 0.1), rgba(230, 162, 60, 0.18));
        animation: pulse-pending-mobile 1.5s ease-in-out infinite;
      }
    }

    .pool-empty {
      padding: 16px 8px;
      font-size: 11px;

      p {
        font-size: 11px;
        text-align: center;
      }
    }

    // 折叠模式移动端:显示图标和数量
    .pool-collapsed-view {
      .collapsed-count {
        font-size: 11px;
        padding: 0 5px;
        min-width: 18px;
      }
    }
  }

  @keyframes pulse-pending-mobile {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(230, 162, 60, 0.4);
    }
    50% {
      box-shadow: 0 0 0 4px rgba(230, 162, 60, 0.1);
    }
  }

  // 超小屏幕进一步压缩（≤480px）- 保持与移动端一致的宽度，只调整内部元素
  @media screen and (max-width: 480px) {
    // 宽度保持不变，避免跳变
    width: 68px;
    min-width: 68px;

    .pool-header {
      padding: 6px 3px;
      gap: 4px;

      h3 {
        font-size: 11px;
      }

      .el-button {
        padding: 3px 6px;
        font-size: 10px;
        min-width: 44px;
      }
    }

    .pool-list {
      padding: 4px 0;
    }

    .pool-item {
      padding: 6px 3px;
      margin: 3px 4px;
      min-height: 44px;
      gap: 4px;
      border: 2px solid transparent !important;

      .item-color {
        width: 18px;
        height: 18px;
      }

      .item-name {
        font-size: 10px;
        max-height: 22px;
      }
    }
  }

  &.drop-active {
    background: var(--primary-light);
    border-right-color: var(--primary-color);

    @media screen and (max-width: 767px) {
      border-right-color: transparent;
      border-left-color: var(--primary-color);
    }

    .pool-tips::after {
      content: '松开移入便签';
      display: block;
      color: var(--primary-color);
      font-weight: 500;
    }
  }

  // 折叠模式
  &.is-collapsed {
    width: 48px;
    min-width: 48px;

    .pool-header,
    .pool-tips,
    .pool-list,
    .pool-empty {
      display: none;
    }
  }
}

// 折叠视图
.pool-collapsed-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 16px;
  gap: 4px;
  height: 100%;
  cursor: pointer;

  .collapsed-count {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--border-light);
    border-radius: 10px;
    padding: 0 6px;
    min-width: 18px;
    text-align: center;
    line-height: 18px;
  }
}

.pool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;

  h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary);
    white-space: nowrap;
  }
}

.pool-tips {
  padding: 8px 14px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--primary-light);
  border-bottom: 1px solid var(--border-light);
  line-height: 1.4;
  flex-shrink: 0;

  &.pending-tip {
    background: var(--warning-light);
    color: var(--warning-color);
    font-weight: 500;
  }

  .tip-hint {
    font-size: 11px;
    opacity: 0.7;
  }
}

.pool-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.pool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin: 6px 10px;
  border-radius: 8px;
  border-left: 3px solid;
  background: var(--bg-secondary);
  cursor: grab;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
  position: relative;

  &:hover {
    transform: translateX(2px);
    box-shadow: var(--shadow-lg);

    .delete-btn {
      opacity: 1;
    }
  }

  &:active {
    cursor: grabbing;
    transform: scale(0.98);
    opacity: 0.85;
  }

  // 激活状态
  &.is-active {
    border-width: 4px;
    background: linear-gradient(135deg, rgba(64, 158, 255, 0.08), rgba(64, 158, 255, 0.15));
    box-shadow: 0 2px 12px rgba(64, 158, 255, 0.3);

    .item-name {
      color: var(--primary-color);
      font-weight: 600;
    }

    .active-icon {
      color: var(--primary-color);
      animation: pulse-icon 1s ease-in-out infinite;
    }
  }

  // pending 模式（等待选择便签）
  &.pending-mode {
    cursor: pointer;
    border-left-color: var(--warning-color);

    &:hover {
      background: linear-gradient(135deg, rgba(230, 162, 60, 0.1), rgba(230, 162, 60, 0.2));
      border-left-width: 5px;
    }
  }

  .item-color {
    width: 10px;
    height: 28px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .item-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .active-icon {
    flex-shrink: 0;
  }

  .delete-btn {
    opacity: 0;
    transition: opacity 0.2s;
    flex-shrink: 0;
  }
}

@keyframes pulse-icon {
  0%, 100% {
    opacity: 0.8;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.pool-empty {
  padding: 40px 20px;
  text-align: center;

  p {
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.8;
    margin: 0;
  }
}
</style>
