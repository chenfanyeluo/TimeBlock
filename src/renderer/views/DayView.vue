<template>
  <div class="view-container">
    <div class="view-header">
      <h2>日视图</h2>
      <div class="date-nav">
        <el-button @click="prevDay" :icon="ArrowLeft" circle />
        <span class="current-date">{{ displayDate }}</span>
        <el-button @click="nextDay" :icon="ArrowRight" circle />
        <el-button type="primary" @click="goToday">今天</el-button>
      </div>
    </div>

    <div class="day-view-content">
      <div class="timeline">
        <div
          v-for="hour in 24"
          :key="hour - 1"
          class="hour-label"
        >
          {{ String(hour - 1).padStart(2, '0') }}:00
        </div>
      </div>
      <div class="day-grid" ref="dayGridRef" @dblclick="handleGridDoubleClick">
        <div
          v-for="hour in 24"
          :key="hour - 1"
          class="hour-row"
          :data-hour="hour - 1"
        ></div>

        <TimeBlockItem
          v-for="block in dayBlocks"
          :key="block.id"
          :block="block"
          :hour-height="hourHeight"
          @update="(updates) => updateBlock(block.id, updates)"
          @delete="deleteBlock(block.id)"
        />
      </div>
    </div>

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
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import TimeBlockItem from '@components/TimeBlockItem.vue'
import { useTimeBlockStore } from '@stores/timeBlock'

const store = useTimeBlockStore()
const currentDate = ref(dayjs())
const hourHeight = 60
const dayGridRef = ref(null)
const dialogVisible = ref(false)

const newBlock = ref({
  taskName: '',
  category: 'work',
  startTime: '09:00',
  endTime: '10:00'
})

const displayDate = computed(() => currentDate.value.format('YYYY年MM月DD日 dddd'))

const dayBlocks = computed(() => {
  return store.getBlocksByDate(currentDate.value.format('YYYY-MM-DD'))
})

const categories = computed(() => store.categories)

function prevDay() {
  currentDate.value = currentDate.value.subtract(1, 'day')
}

function nextDay() {
  currentDate.value = currentDate.value.add(1, 'day')
}

function goToday() {
  currentDate.value = dayjs()
}

function handleGridDoubleClick(e) {
  const rect = dayGridRef.value.getBoundingClientRect()
  const y = e.clientY - rect.top
  const hour = Math.floor(y / hourHeight)
  const minute = Math.floor((y % hourHeight) / (hourHeight / 4)) * 15

  const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  const endHour = hour + 1
  const endTime = `${String(Math.min(23, endHour)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

  newBlock.value = {
    taskName: '',
    category: 'work',
    startTime,
    endTime
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

function updateBlock(id, updates) {
  store.updateBlock(id, updates)
}

function deleteBlock(id) {
  store.deleteBlock(id)
}
</script>

<style lang="scss" scoped>
.day-view-content {
  display: flex;
  height: calc(100% - 60px);
  overflow: auto;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.timeline {
  width: var(--timeline-width);
  flex-shrink: 0;
  border-right: 1px solid var(--border-light);
}

.hour-label {
  height: 60px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    width: 6px;
    height: 1px;
    background: var(--border-color);
  }
}

.day-grid {
  flex: 1;
  position: relative;
  min-height: 1440px;
}

.hour-row {
  height: 60px;
  border-bottom: 1px solid var(--border-light);

  &:hover {
    background: var(--bg-hover);
  }
}

.date-nav {
  display: flex;
  align-items: center;
  gap: 12px;

  .current-date {
    font-size: 16px;
    font-weight: 500;
    min-width: 200px;
    text-align: center;
  }
}
</style>
