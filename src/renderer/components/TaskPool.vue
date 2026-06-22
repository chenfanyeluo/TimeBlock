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

      <div class="pool-tips">
        拖拽便签到右侧时间轴即可快速安排
      </div>

      <!-- 便签列表 -->
      <div class="pool-list">
        <div
          v-for="note in noteList"
          :key="note.id"
          class="pool-item"
          :style="{ borderColor: note.color }"
          draggable="true"
          @dragstart="onDragStart($event, note)"
        >
          <div class="item-color" :style="{ background: note.color }"></div>
          <span class="item-name">{{ note.name }}</span>
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
            <el-color-picker v-model="newNote.color" show-alpha />
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
import { ElMessage } from 'element-plus'
import { useTimeBlockStore } from '@stores/timeBlock'

const emit = defineEmits(['dragstart', 'recycle-block'])

const store = useTimeBlockStore()

// 折叠状态（由父组件通过 class 控制）
const props = defineProps({
  highlighted: { type: Boolean, default: false },
  isCollapsed: { type: Boolean, default: false }
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

  &.drop-active {
    background: var(--primary-light);
    border-right-color: var(--primary-color);

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

  .delete-btn {
    opacity: 0;
    transition: opacity 0.2s;
    flex-shrink: 0;
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
