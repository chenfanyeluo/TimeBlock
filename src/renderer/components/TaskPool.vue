<template>
  <div
    class="task-pool"
    :class="{ 'drop-active': isDropOver || highlighted }"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="pool-header">
      <h3>任务储备栏</h3>
      <el-button type="primary" size="small" :icon="Plus" @click="showAddDialog = true">
        添加
      </el-button>
    </div>

    <div class="pool-tips">
      拖拽任务到右侧时间轴即可快速安排
    </div>

    <!-- 任务模板列表 -->
    <div
      v-for="task in taskTemplates"
      :key="task.id"
      class="pool-item"
      :style="{ borderColor: task.color }"
      draggable="true"
      @dragstart="onDragStart($event, task)"
    >
      <div class="item-color" :style="{ background: task.color }"></div>
      <span class="item-name">{{ task.name }}</span>
      <span class="item-duration">{{ task.duration }}分钟</span>
      <el-button
        type="danger"
        size="small"
        :icon="Delete"
        circle
        class="delete-btn"
        @click.stop="removeTemplate(task.id)"
      />
    </div>

    <!-- 空状态 -->
    <div v-if="taskTemplates.length === 0" class="pool-empty">
      <p>暂无任务模板</p>
      <p>点击上方"添加"按钮创建</p>
    </div>

    <!-- 添加任务模板对话框 -->
    <el-dialog v-model="showAddDialog" title="添加任务模板" width="400px">
      <el-form :model="newTask" label-width="80px">
        <el-form-item label="任务名称">
          <el-input v-model="newTask.name" placeholder="例如：起床、背单词、晨跑" />
        </el-form-item>
        <el-form-item label="任务类型">
          <el-select v-model="newTask.categoryId" placeholder="选择类型" @change="onCategoryChange">
            <el-option
              v-for="cat in categoryOptions"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            >
              <span class="category-option">
                <span class="option-dot" :style="{ background: cat.color }"></span>
                {{ cat.name }}
              </span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="默认时长">
          <el-select v-model="newTask.duration" placeholder="选择时长">
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
        <el-button type="primary" @click="addTemplate">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useTimeBlockStore } from '@stores/timeBlock'

const emit = defineEmits(['dragstart', 'recycle-block'])

const store = useTimeBlockStore()

// 任务模板列表（持久化到 localStorage）
const taskTemplates = ref([])
const showAddDialog = ref(false)
const isDropOver = ref(false)

// 分类选项（从 store 获取，带颜色圆点）
const categoryOptions = computed(() => store.categories)

const props = defineProps({
  highlighted: { type: Boolean, default: false }
})

const newTask = ref({
  name: '',
  duration: 30,
  categoryId: 'work',
  categoryName: '工作',
  color: '#409eff'
})

// 从 localStorage 加载
function loadTemplates() {
  try {
    const saved = localStorage.getItem('timeblock-task-templates')
    if (saved) {
      taskTemplates.value = JSON.parse(saved)
    }
  } catch {
    // 使用默认模板
    taskTemplates.value = getDefaultTemplates()
  }
}

// 默认任务模板（带分类信息）
function getDefaultTemplates() {
  return [
    { id: 'default-1', name: '起床', duration: 15, categoryId: 'rest', categoryName: '日常', color: '#FF9800' },
    { id: 'default-2', name: '早餐', duration: 30, categoryId: 'rest', categoryName: '日常', color: '#4CAF50' },
    { id: 'default-3', name: '背单词', duration: 30, categoryId: 'study', categoryName: '学习', color: '#2196F3' },
    { id: 'default-4', name: '阅读', duration: 60, categoryId: 'study', categoryName: '学习', color: '#9C27B0' },
    { id: 'default-5', name: '运动', duration: 60, categoryId: 'exercise', categoryName: '运动', color: '#F44336' },
    { id: 'default-6', name: '午休', duration: 45, categoryId: 'rest', categoryName: '日常', color: '#795548' },
    { id: 'default-7', name: '项目开发', duration: 120, categoryId: 'work', categoryName: '工作', color: '#00BCD4' },
    { id: 'default-8', name: '学习', duration: 90, categoryId: 'study', categoryName: '学习', color: '#3F51B5' },
    { id: 'default-9', name: '会议', duration: 60, categoryId: 'work', categoryName: '工作', color: '#FF5722' },
    { id: 'default-10', name: '娱乐', duration: 60, categoryId: 'entertainment', categoryName: '娱乐', color: '#E91E63' }
  ]
}

// 选择分类时自动填充颜色
function onCategoryChange(categoryId) {
  const cat = categoryOptions.value.find(c => c.id === categoryId)
  if (cat) {
    newTask.value.categoryName = cat.name
    newTask.value.color = cat.color
  }
}

// 保存到 localStorage
function saveTemplates() {
  localStorage.setItem('timeblock-task-templates', JSON.stringify(taskTemplates.value))
}

// 拖拽开始
function onDragStart(event, task) {
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'template',
    taskName: task.name,
    duration: task.duration,
    categoryColor: task.color,
    categoryName: task.categoryName || '',
    categoryId: task.categoryId || '',
    isFromPool: true
  }))
  emit('dragstart', task)
}

// 添加新模板
function addTemplate() {
  if (!newTask.value.name.trim()) {
    ElMessage.warning('请输入任务名称')
    return
  }

  const template = {
    id: `custom-${Date.now()}`,
    name: newTask.value.name.trim(),
    duration: newTask.value.duration,
    categoryId: newTask.value.categoryId,
    categoryName: newTask.value.categoryName,
    color: newTask.value.color
  }

  taskTemplates.value.push(template)
  saveTemplates()
  showAddDialog.value = false

  // 重置表单
  newTask.value = {
    name: '',
    duration: 30,
    categoryId: 'work',
    categoryName: '工作',
    color: '#409eff'
  }

  ElMessage.success(`任务模板"${template.name}"已添加`)
}

// 删除模板
function removeTemplate(id) {
  const idx = taskTemplates.value.findIndex(t => t.id === id)
  if (idx !== -1) {
    const name = taskTemplates.value[idx].name
    taskTemplates.value.splice(idx, 1)
    saveTemplates()
    ElMessage.success(`已删除任务模板"${name}"`)
  }
}

// ---- 接收日视图块的拖放回收 ----

function onDragOver(e) {
  e.dataTransfer.dropEffect = 'move'
  isDropOver.value = true
}

function onDragLeave(e) {
  // 只有真正离开容器时才取消高亮
  if (!e.currentTarget.contains(e.relatedTarget)) {
    isDropOver.value = false
  }
}

function onDrop(e) {
  e.preventDefault()
  isDropOver.value = false

  try {
    const data = JSON.parse(e.dataTransfer.getData('application/json'))

    // 只处理来自日视图的块（type: 'block'）
    if (data.type === 'block') {
      // 回收任务到储备栏（去重：同名任务最多保留一个）
      recycleTask(data.taskName, data.categoryColor)

      // 通知父组件删除日视图中的块
      emit('recycle-block', data.blockId)
    }
  } catch (err) {
    console.error('Pool drop error:', err)
  }
}

// 回收任务到储备栏（去重）— 供父组件通过 ref 调用
function recycleTask(taskName, color, categoryName, categoryId) {
  // 检查是否已存在同名任务
  const existing = taskTemplates.value.find(t => t.name === taskName)
  if (existing) {
    ElMessage.info(`"${taskName}"已在储备栏中`)
    return
  }

  const template = {
    id: `recycled-${Date.now()}`,
    name: taskName,
    duration: 30,
    categoryId: categoryId || 'other',
    categoryName: categoryName || '其他',
    color: color || '#909399'
  }

  taskTemplates.value.push(template)
  saveTemplates()
  ElMessage.success(`"${taskName}"已回收到储备栏`)
}

// 暴露给父组件 ref 调用
defineExpose({ recycleTask })

onMounted(() => {
  loadTemplates()
})
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
  transition: background-color 0.2s;

  &.drop-active {
    background: #ecf5ff;
    border-right-color: #409eff;

    .pool-tips::after {
      content: '松开移入储备栏';
      display: block;
      color: #409eff;
      font-weight: 500;
    }
  }
}

.pool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);

  h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary);
  }
}

.pool-tips {
  padding: 8px 16px;
  font-size: 12px;
  color: var(--text-secondary);
  background: #f0f7ff;
  border-bottom: 1px solid var(--border-light);
  line-height: 1.4;
}

.pool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin: 8px 12px;
  border-radius: 8px;
  border-left: 3px solid;
  background: white;
  cursor: grab;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);

  &:hover {
    transform: translateX(2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

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

  .item-duration {
    font-size: 11px;
    color: var(--text-secondary);
    flex-shrink: 0;
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

// 分类下拉选项样式
.category-option {
  display: flex;
  align-items: center;
  gap: 8px;

  .option-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
}
</style>
