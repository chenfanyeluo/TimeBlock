<template>
  <div class="view-container day-view-wrapper" :class="{ 'pool-collapsed': poolCollapsed }">
    <!-- 左侧便签栏（可折叠） -->
    <TaskPool
      v-show="!poolHidden"
      ref="taskPoolRef"
      :class="{ 'is-collapsed': poolCollapsed }"
      :highlighted="isPoolHighlighted"
      :active-note-id="activeNoteId"
      :pending-block="pendingBlock"
      :is-mobile="isMobileDevice"
      @dragstart="onPoolDragStart"
      @recycle-block="onRecycleBlock"
      @note-click="handleNoteClick"
      @mobile-drag-start="onMobileDragStart"
      @mobile-drag-move="onMobileDragMove"
      @mobile-drag-end="onMobileDragEnd"
    />

    <!-- 右侧日视图主区域 -->
    <div class="day-view-main">
      <!-- 顶部工具栏 -->
      <div class="view-header" :class="{ 'is-mobile': isMobileDevice }">
        <!-- 移动端紧凑布局 -->
        <template v-if="isMobileDevice">
          <!-- 第一行：标题 + 日期选择器 + 便签切换 -->
          <div class="mobile-header-row1">
            <h2>记录</h2>
            <el-date-picker
              v-model="currentDate"
              type="date"
              placeholder="选择日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              :clearable="false"
              size="small"
              class="mobile-date-picker"
            />
            <el-button
              v-if="showPoolToggle"
              :type="poolHidden ? 'primary' : 'default'"
              size="small"
              @click="poolHidden = !poolHidden"
              class="mobile-pool-toggle"
            >
              {{ poolHidden ? '便签' : '隐藏' }}
            </el-button>
          </div>
          <!-- 第二行：今天按钮（左） + 日期导航（中） + 粒度选择器（右） -->
          <div class="mobile-header-row2">
            <el-button type="primary" size="small" @click="goToday" class="mobile-today-btn">今天</el-button>
            <div class="mobile-date-nav">
              <el-button @click="prevDay" :icon="ArrowLeft" circle size="small" />
              <span class="mobile-current-date">{{ mobileDisplayDate }}</span>
              <el-button @click="nextDay" :icon="ArrowRight" circle size="small" />
            </div>
            <el-select
              v-model="granularityValue"
              size="small"
              class="mobile-granularity-select"
              @change="onGranularityChange"
            >
              <el-option label="15分" :value="15" />
              <el-option label="30分" :value="30" />
              <el-option label="1时" :value="60" />
            </el-select>
            <!-- 移动端搜索按钮 -->
            <el-button size="small" :icon="Search" circle @click="openSearch" class="mobile-search-btn" />
          </div>
        </template>
        
        <!-- 桌面端完整布局 -->
        <template v-else>
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
            <!-- 时间粒度选择器 -->
            <span class="granularity-label">粒度：</span>
            <el-select
              v-model="granularityValue"
              size="small"
              style="width: 100px"
              @change="onGranularityChange"
            >
              <el-option label="15分钟" :value="15" />
              <el-option label="30分钟" :value="30" />
              <el-option label="1小时" :value="60" />
            </el-select>
            <!-- 搜索按钮 -->
            <el-button size="small" :icon="Search" circle @click="openSearch" title="搜索时间块" />
          </div>
        </template>
      </div>

      <!-- 日视图内容区（时间轴 + 网格） -->
      <div class="day-view-content">
        <!-- 空状态提示（固定在可视区域中间） -->
        <div v-if="dayBlocks.length === 0 && !isDragOver && !isCreating && !pendingBlock" class="empty-hint" @click.stop @mousedown.stop>
          <div class="empty-hint-icon">
            <el-icon :size="48"><Clock /></el-icon>
          </div>
          <p class="empty-hint-title">未添加事件</p>
          <p class="empty-hint-desc" v-if="!isMobileDevice">拖拽绘制时间段后选择便签，或激活便签后直接绘制</p>
          <p class="empty-hint-desc" v-else>在时间网格区域<strong>按住并上下滑动</strong>绘制时间段</p>
        </div>

        <!-- 移动端滑动提示（仅在移动端且首次使用时显示） -->
        <div
          v-if="isMobileDevice && showMobileSwipeHint && !isCreating && !pendingBlock"
          class="mobile-swipe-hint"
          @click="dismissMobileHint"
        >
          <div class="hint-content">
            <div class="hint-icon">
              <svg viewBox="0 0 24 24" width="32" height="32">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <p class="hint-title">如何在移动端绘制时间块？</p>
            <div class="hint-steps">
              <div class="hint-step">
                <span class="step-num">1</span>
                <span class="step-text">在<strong>左侧时间网格</strong>区域按住屏幕</span>
              </div>
              <div class="hint-step">
                <span class="step-num">2</span>
                <span class="step-text"><strong>上下滑动</strong>选择时间范围（不要左右滑动）</span>
              </div>
              <div class="hint-step">
                <span class="step-num">3</span>
                <span class="step-text">松开后点击<strong>右侧便签</strong>完成创建</span>
              </div>
            </div>
            <p class="hint-tip">提示：先点击便签激活，再绘制可直接创建</p>
            <button class="hint-dismiss-btn">知道了，开始使用</button>
          </div>
        </div>

        <!-- 同步滚动容器：时间轴和网格一起滚动 -->
        <div class="scroll-body" ref="scrollBodyRef">
          <!-- 时间轴标签 -->
          <div class="timeline" ref="timelineRef">
          <div
            v-for="mark in timeScaleMarks"
            :key="'label-' + mark.hour + '-' + mark.minute"
            class="time-mark"
            :class="{ 'hour-mark': mark.isHourMark }"
            :style="{ height: mark.height + 'px' }"
          >
            {{ mark.label }}
          </div>

          <!-- 当前时间指示（在timeline内显示） -->
          <div v-if="currentTimeLine.show" class="current-time-line" :style="currentTimeLineStyle">
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

          <!-- 拖拽创建预览 -->
          <div v-if="isCreating" class="create-preview" :style="createPreviewStyle">
            <span class="create-preview-text">{{ createPreviewText }}</span>
          </div>

          <!-- 暂时填入预览块（等待选择便签） -->
          <div v-if="pendingBlock" class="pending-preview" :style="pendingPreviewStyle">
            <span class="pending-preview-text">请选择便签 →</span>
            <span class="pending-preview-time">{{ pendingBlock.startTime }} - {{ pendingBlock.endTime }}</span>
          </div>

          <!-- 拖放提示（从便签栏拖入时） -->
          <div v-if="isDragOver" class="drop-indicator" :style="dropIndicatorStyle">
            <span class="drop-main-text">放置到此处创建时间块</span>
            <span class="drop-hint-text">按住 Shift 拖入可直接添加任务</span>
          </div>

          <!-- 移动端拖拽指示器（跟随手指的便签图标） -->
          <div v-if="mobileDragState.active" class="mobile-drag-indicator" :style="mobileDragIndicatorStyle">
            <div class="drag-note-color" :style="{ background: mobileDragState.note?.color }"></div>
            <span class="drag-note-name">{{ mobileDragState.note?.name }}</span>
            <div v-if="mobileDragState.overGrid" class="drag-target-time">
              {{ mobileDragState.targetTime }}
            </div>
          </div>

          <!-- 移动端时间块拖拽指示器（拖到便签栏回收） -->
          <div v-if="mobileBlockDragState.active" class="mobile-block-drag-indicator" :style="mobileBlockDragIndicatorStyle">
            <div class="drag-block-color" :style="{ background: mobileBlockDragState.categoryColor }"></div>
            <span class="drag-block-name">{{ mobileBlockDragState.categoryName }}</span>
            <div v-if="mobileBlockDragState.overPool" class="drag-recycle-hint">
              松开回收
            </div>
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
            :has-reminder="reminderBlockIds.has(layout.block.id)"
            @update="(updates) => updateBlock(layout.block.id, updates)"
            @delete="deleteBlock(layout.block.id)"
            @select="onBlockSelect"
            @recycle="onRecycleFromBlock"
            @drag-over-pool="isPoolHighlighted = $event"
            @contextmenu.prevent="onBlockContextMenu($event, layout.block)"
            @mobile-block-drag-start="onMobileBlockDragStart"
            @mobile-block-drag-move="onMobileBlockDragMove"
            @mobile-block-drag-end="onMobileBlockDragEnd"
            @mobile-context-menu="onMobileContextMenu"
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
              <el-icon><CopyDocument /></el-icon> 复制时间块
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item color-submenu-wrap" @mouseenter="showColorPicker = true" @mouseleave="showColorPicker = false">
              <span class="color-label"><el-icon><Brush /></el-icon>更改便签</span>
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
            <div class="context-menu-item" @click="onContextAction('reminder')">
              <el-icon><Bell /></el-icon> 设置提醒
            </div>
            <div class="context-menu-item danger" @click="onContextAction('delete')">
              <el-icon><Delete /></el-icon> 删除
            </div>
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
            :step="timeSelectStep"
            end="23:45"
            placeholder="选择开始时间"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-time-select
            v-model="newBlock.endTime"
            start="00:15"
            :step="timeSelectStep"
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

    <!-- 提醒设置对话框 -->
    <el-dialog v-model="reminderDialogVisible" title="设置提醒" width="400px">
      <el-form label-width="100px">
        <el-form-item label="时间块">
          <span>{{ reminderTargetBlock?.noteName || reminderTargetBlock?.taskName }}</span>
        </el-form-item>
        <el-form-item label="开始时间">
          <span>{{ reminderTargetBlock?.date }} {{ reminderTargetBlock?.startTime }}</span>
        </el-form-item>
        <el-form-item label="提前提醒">
          <el-select v-model="reminderAdvanceMinutes" placeholder="选择提前时间" style="width: 100%">
            <el-option label="5 分钟" :value="5" />
            <el-option label="10 分钟" :value="10" />
            <el-option label="15 分钟" :value="15" />
            <el-option label="30 分钟" :value="30" />
            <el-option label="1 小时" :value="60" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="reminderNoteAutoRemind" label="便签提醒">
          <el-alert type="info" :closable="false" style="margin-bottom: 8px">
            该便签已开启自动提醒（提前 {{ reminderNoteDefaultMinutes }} 分钟）
          </el-alert>
        </el-form-item>
        <el-form-item v-if="reminderExisting" label="当前状态">
          <el-tag type="warning">已设置提醒（提前 {{ reminderExisting?.advance_minutes }} 分钟）</el-tag>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="reminderExisting" type="warning" @click="cancelReminder">取消提醒</el-button>
        <el-button @click="reminderDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="saveReminder" :loading="savingReminder">保存</el-button>
      </template>
    </el-dialog>

    <!-- 搜索对话框 -->
    <el-dialog v-model="showSearchDialog" title="搜索时间块" width="500px">
      <el-input
        v-model="searchKeyword"
        placeholder="输入关键字搜索标题或备注"
        :prefix-icon="Search"
        clearable
        @input="handleSearchInput"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
        style="margin-bottom: 16px"
      >
        <template #append>
          <el-button :icon="Search" @click="handleSearch" :loading="searching" />
        </template>
      </el-input>

      <!-- 搜索结果列表 -->
      <div v-if="searchResults.length > 0" class="search-results">
        <div class="search-source-info">搜索来源：{{ searchSource }}</div>
        <div
          v-for="item in searchResults"
          :key="item.id + '-' + item.source"
          class="search-result-item"
          :class="{ 'cloud-item': item.source === '云端' }"
          @click="jumpToResult(item)"
        >
          <div class="result-header">
            <span class="result-title">{{ item.title }}</span>
            <el-tag v-if="item.note" size="small" :color="item.note.color" style="color: #fff">
              {{ item.note.name }}
            </el-tag>
            <el-tag v-if="item.source" size="small" :type="item.source === '本地' ? 'success' : 'warning'">
              {{ item.source }}
            </el-tag>
          </div>
          <div class="result-meta">
            <span class="result-date">{{ dayjs(item.startTime).format('YYYY-MM-DD HH:mm') }}</span>
            <span class="result-desc" v-if="item.description">{{ item.description }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="searchKeyword && !searching" class="search-empty">
        <p>未找到匹配的时间块</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  ArrowLeft, ArrowRight, Delete, Plus, Clock,
  DArrowLeft, DArrowRight, Edit, CopyDocument, Brush, Calendar, Search, Bell
} from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { ElMessage } from '@utils/message'
import dayjs from 'dayjs'
import TimeBlockItem from '@components/TimeBlockItem.vue'
import TaskPool from '@components/TaskPool.vue'
import { useTimeBlockStore } from '@stores/timeBlock'
import { platformInfo, database } from '@shared/platform'
import { searchTimeBlocks } from '@api/timeBlock'
import authApi from '@api/auth'
import { createTimeBlockReminder, cancelTimeBlockReminder, checkNoteAutoRemind, getTimeBlockReminder, getPendingReminders } from '../services/reminder'

const store = useTimeBlockStore()

// ---- 提醒状态 ----
const reminderBlockIds = ref(new Set()) // 存储有提醒的时间块ID

// 加载当日提醒状态(包括单独设置的和便签自动提醒的)
async function loadReminderStatus() {
  if (!platformInfo.isElectron && !platformInfo.isCapacitor) return
  if (!database.isReady()) return

  try {
    // 1. 查询单独设置提醒的时间块
    const reminders = await database.query(
      `SELECT target_id FROM reminders WHERE user_id = 1 AND target_type = 'time_block' AND status = 'pending';`,
      []
    )
    const manualReminderBlockIds = reminders.map(r => r.target_id)

    // 2. 查询开启自动提醒的便签
    const autoRemindNotes = await database.query(
      `SELECT id FROM notes WHERE user_id = 1 AND auto_remind = 1 AND deleted_at IS NULL;`,
      []
    )
    const autoRemindNoteIds = autoRemindNotes.map(n => n.id)

    // 3. 查询属于这些便签的今日时间块(即使没有单独设置提醒)
    let autoReminderBlockIds = []
    if (autoRemindNoteIds.length > 0) {
      const today = currentDate.value
      const autoRemindBlocks = await database.query(
        `SELECT id FROM time_blocks
         WHERE user_id = 1
         AND note_id IN (${autoRemindNoteIds.map(() => '?').join(',')})
         AND date(start_time) = ?
         AND deleted_at IS NULL;`,
        [...autoRemindNoteIds, today]
      )
      autoReminderBlockIds = autoRemindBlocks.map(b => b.id)
    }

    // 4. 合并两种提醒来源
    const allReminderBlockIds = new Set([...manualReminderBlockIds, ...autoReminderBlockIds])
    reminderBlockIds.value = allReminderBlockIds

    console.log('[DayView] 加载提醒状态:', allReminderBlockIds.size, '个')
    console.log('[DayView] - 手动设置:', manualReminderBlockIds.length, '个')
    console.log('[DayView] - 便签自动:', autoReminderBlockIds.length, '个')
  } catch (err) {
    console.warn('[DayView] 加载提醒状态失败:', err)
  }
}

// ---- 搜索功能 ----
const showSearchDialog = ref(false)
const searchKeyword = ref('')
const searchResults = ref([])
const searching = ref(false)
const searchSource = ref('') // 搜索来源标识

// 搜索防抖定时器
let searchDebounceTimer = null
const SEARCH_DEBOUNCE_MS = 300

// 打开搜索对话框
function openSearch() {
  showSearchDialog.value = true
  searchKeyword.value = ''
  searchResults.value = []
  searchSource.value = ''
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
}

// 实时搜索输入（防抖）
function handleSearchInput() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = setTimeout(() => {
    handleSearch()
  }, SEARCH_DEBOUNCE_MS)
}

// 执行搜索（本地 SQLite + 云端 API）
async function handleSearch() {
  if (!searchKeyword.value.trim()) {
    searchResults.value = []
    return
  }

  searching.value = true
  searchResults.value = []
  searchSource.value = ''

  const keyword = searchKeyword.value.trim().toLowerCase()

  try {
    // 1. 搜索本地 SQLite（Electron/Capacitor 环境）
    if (platformInfo.isElectron || platformInfo.isCapacitor) {
      if (database.isReady()) {
        const localResults = await database.query(
          `SELECT tb.id, tb.title, tb.description, tb.start_time, tb.end_time,
                  n.name AS note_name, n.color AS note_color
           FROM time_blocks tb
           LEFT JOIN notes n ON tb.note_id = n.id AND n.deleted_at IS NULL
           WHERE tb.user_id = 1 AND tb.deleted_at IS NULL
             AND (tb.title LIKE ? OR tb.description LIKE ? OR n.name LIKE ?)
           ORDER BY tb.start_time DESC
           LIMIT 50;`,
          [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`]
        )

        if (localResults.length > 0) {
          searchResults.value = localResults.map(tb => ({
            id: tb.id,
            title: tb.title,
            description: tb.description,
            startTime: tb.start_time,
            endTime: tb.end_time,
            note: tb.note_name ? { name: tb.note_name, color: tb.note_color || '#909399' } : null,
            source: '本地数据库'
          }))
          searchSource.value = '本地数据库'
          console.log('[DayView] 本地 SQLite 搜索结果:', localResults.length)
        }
      }
    }

    // 2. 搜索本地内存数据（Web 环境备选方案，无需登录）
    if (searchResults.value.length === 0) {
      const memoryResults = store.blocks.filter(block => {
        const titleMatch = block.title?.toLowerCase().includes(keyword)
        const descMatch = (block.remark || block.description || '')?.toLowerCase().includes(keyword)
        const noteMatch = (block.noteName || '')?.toLowerCase().includes(keyword)
        return titleMatch || descMatch || noteMatch
      })

      if (memoryResults.length > 0) {
        searchResults.value = memoryResults.map(tb => {
          // 24:00 结束 → 转为次日 00:00（与 frontendBlockToDb 一致）
          let endTimeValue
          if (tb.endTime === '24:00') {
            const nextDate = dayjs(tb.date).add(1, 'day').format('YYYY-MM-DD')
            endTimeValue = `${nextDate}T00:00:00`
          } else {
            endTimeValue = `${tb.date}T${tb.endTime}:00`
          }
          return {
            id: tb.id,
            title: tb.title,
            description: tb.remark || tb.description || '',
            startTime: `${tb.date}T${tb.startTime}:00`,
            endTime: endTimeValue,
            note: { name: tb.noteName || '未分类', color: tb.noteColor || '#909399' },
            source: '当前页面'
          }
        })
        searchSource.value = '当前页面'
        console.log('[DayView] 内存搜索结果:', memoryResults.length)
      }
    }

    // 3. 如果已登录，同时搜索云端
    if (authApi.checkLogin()) {
      try {
        const cloudResults = await searchTimeBlocks({ keyword: searchKeyword.value.trim() })

        // 合并云端结果（避免重复）
        for (const cloudItem of cloudResults) {
          const existsLocal = searchResults.value.some(
            local => local.title === cloudItem.title &&
                     local.startTime === cloudItem.startTime
          )

          if (!existsLocal) {
            searchResults.value.push({
              ...cloudItem,
              source: '云端'
            })
          }
        }

        if (cloudResults.length > 0 && searchSource.value === '') {
          searchSource.value = '云端'
        }
        console.log('[DayView] 云端搜索结果:', cloudResults.length)

      } catch (cloudErr) {
        console.warn('[DayView] 云端搜索失败:', cloudErr.message)
      }
    }

    // 最终提示
    if (searchResults.value.length === 0) {
      ElMessage.info('未找到匹配的时间块')
    } else {
      ElMessage.success(`找到 ${searchResults.value.length} 个匹配结果（${searchSource.value}）`)
    }

  } catch (err) {
    console.error('[DayView] 搜索失败:', err)
    ElMessage.error(err.message || '搜索失败')
  } finally {
    searching.value = false
  }
}

// 点击搜索结果跳转到对应日期
function jumpToResult(item) {
  const date = dayjs(item.startTime).format('YYYY-MM-DD')
  store.currentDate = dayjs(date)
  showSearchDialog.value = false
  ElMessage.success(`已跳转到 ${date}`)
}

// ---- 时间粒度设置 ----
const granularityValue = computed({
  get: () => store.timeGranularity,
  set: (val) => store.setGranularity(val)
})

async function onGranularityChange(val) {
  await store.setGranularity(val)
  ElMessage.success(`时间粒度已设置为 ${val === 60 ? '1小时' : val + '分钟'}`)
}

// 时间选择器步长（格式化为 HH:mm）
const timeSelectStep = computed(() => {
  const granularity = store.timeGranularity
  const hours = Math.floor(granularity / 60)
  const minutes = granularity % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
})

// ---- 基础配置 ----
const startHour = 0       // 可视起始小时（保持完整24h供滚动）
const endHour = 24         // 可视结束小时
const hourHeight = 60      // 每小时像素高度

// ---- 响应式状态 ----
const poolCollapsed = ref(false)   // 储备栏是否折叠（宽屏模式）
const poolHidden = ref(false)      // 储备栏是否隐藏（窄屏模式）

// 根据屏幕宽度判断是否显示切换按钮（由 resize 监听器更新）
const windowWidth = ref(window.innerWidth)
const showPoolToggle = computed(() => windowWidth.value < 768)

// ---- 新增：暂时填入状态和激活便签状态 ----
const pendingBlock = ref(null)     // 暂时填入的时间块数据 { startTime, endTime, date }
const activeNoteId = ref(null)     // 当前激活的便签 ID

// 是否为移动端（用于判断交互方式）
const isMobileDevice = computed(() => platformInfo.isMobile || windowWidth.value < 768)

// 移动端滑动提示状态（首次使用时显示，用户点击后隐藏）
const MOBILE_HINT_KEY = 'timeblock_mobile_swipe_hint_dismissed'
const showMobileSwipeHint = ref(false)

// 检查是否需要显示移动端提示
function checkMobileHint() {
  if (isMobileDevice.value) {
    const dismissed = localStorage.getItem(MOBILE_HINT_KEY)
    showMobileSwipeHint.value = !dismissed
  }
}

// 用户点击关闭提示
function dismissMobileHint() {
  showMobileSwipeHint.value = false
  localStorage.setItem(MOBILE_HINT_KEY, 'true')
}

// ---- 日期相关（统一使用字符串格式，兼容 el-date-picker 的 value-format）---
const currentDate = ref(dayjs().format('YYYY-MM-DD'))
const dayGridRef = ref(null)
const timelineRef = ref(null)
const scrollBodyRef = ref(null)

// 监听日期变化,刷新提醒状态
watch(currentDate, () => {
  loadReminderStatus()
})

// 对话框状态
const dialogVisible = ref(false)
const dialogTitle = ref('新建时间块')
const dialogMode = ref('create') // 'create' | 'edit'
const editingBlockId = ref(null)
const moveDateDialogVisible = ref(false)
const moveTargetDate = ref('')
const moveTargetBlockId = ref(null)

// ---- 提醒设置功能 ----
const reminderDialogVisible = ref(false)
const reminderTargetBlock = ref(null)
const reminderAdvanceMinutes = ref(5)
const reminderExisting = ref(null)
const reminderNoteAutoRemind = ref(false)
const reminderNoteDefaultMinutes = ref(5)
const savingReminder = ref(false)

// 打开提醒设置对话框
async function openReminderDialog(block) {
  reminderTargetBlock.value = block
  reminderAdvanceMinutes.value = 5
  reminderExisting.value = null
  reminderNoteAutoRemind.value = false
  reminderNoteDefaultMinutes.value = 5

  // 检查是否已设置提醒
  if (platformInfo.isElectron || platformInfo.isCapacitor) {
    if (database.isReady()) {
      const existing = await getTimeBlockReminder(block.id)
      reminderExisting.value = existing
      if (existing) {
        reminderAdvanceMinutes.value = existing.advance_minutes
      }

      // 检查便签是否开启自动提醒
      if (block.noteId) {
        const noteConfig = await checkNoteAutoRemind(block.noteId)
        if (noteConfig && noteConfig.auto_remind === 1) {
          reminderNoteAutoRemind.value = true
          reminderNoteDefaultMinutes.value = noteConfig.default_advance_minutes
        }
      }
    }
  }

  reminderDialogVisible.value = true
}

// 保存提醒设置
async function saveReminder() {
  if (!reminderTargetBlock.value) return

  savingReminder.value = true
  try {
    // 先取消已有提醒
    await cancelTimeBlockReminder(reminderTargetBlock.value.id)

    // 创建新提醒
    const result = await createTimeBlockReminder(
      reminderTargetBlock.value,
      reminderAdvanceMinutes.value,
      false, // 手动设置
      reminderTargetBlock.value.noteId
    )

    if (result) {
      ElMessage.success(`提醒已设置（提前 ${reminderAdvanceMinutes.value} 分钟）`)
      reminderExisting.value = { advance_minutes: reminderAdvanceMinutes.value }

      // ✅ 同步UI状态：添加到提醒集合
      reminderBlockIds.value.add(reminderTargetBlock.value.id)
      console.log('[DayView] 提醒已添加到UI状态:', reminderTargetBlock.value.id)
    } else {
      ElMessage.warning('提醒时间已过去，无法设置')
    }
  } catch (err) {
    console.error('[DayView] 设置提醒失败:', err)
    ElMessage.error('设置提醒失败')
  } finally {
    savingReminder.value = false
  }
}

// 取消提醒
async function cancelReminder() {
  if (!reminderTargetBlock.value) return

  try {
    await ElMessageBox.confirm('确定取消该时间块的提醒？', '取消提醒', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await cancelTimeBlockReminder(reminderTargetBlock.value.id)
    ElMessage.success('提醒已取消')
    reminderExisting.value = null

    // ✅ 同步UI状态：从提醒集合中移除
    reminderBlockIds.value.delete(reminderTargetBlock.value.id)
    console.log('[DayView] 提醒已从UI状态移除:', reminderTargetBlock.value.id)

    reminderDialogVisible.value = false
  } catch (err) {
    if (err !== 'cancel') {
      console.error('[DayView] 取消提醒失败:', err)
      ElMessage.error('取消提醒失败')
    }
  }
}

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

// 时间轴刻度（根据粒度生成）
const timeScaleMarks = computed(() => {
  const granularity = store.timeGranularity
  const marks = []
  const marksPerHour = 60 / granularity
  const markHeight = hourHeight / marksPerHour

  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += granularity) {
      marks.push({
        hour: h,
        minute: m,
        // 整点显示 "HH:00"，非整点只显示 ":MM"
        label: m === 0
          ? `${String(h).padStart(2, '0')}:00`
          : `:${String(m).padStart(2, '0')}`,
        height: markHeight,
        isHourMark: m === 0 // 是否为整点刻度（用于样式区分）
      })
    }
  }
  return marks
})

const displayDate = computed(() => {
  return dayjs(currentDate.value).format('YYYY年MM月DD日')
})

// 移动端简短日期显示（节省空间）
const mobileDisplayDate = computed(() => {
  return dayjs(currentDate.value).format('MM/DD')
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
  // 点击时间块时取消激活状态和暂时填入状态
  cancelPendingAndActive()
  selectedBlockId.value = selectedBlockId.value === blockId ? null : blockId
}

function onGridClick(e) {
  // 拖拽创建结束后浏览器仍会触发 click，需要抑制
  if (_suppressNextClick) {
    _suppressNextClick = false
    return
  }
  // 如果正在创建中（理论上走不到这里），不处理
  if (isCreating.value) return

  // 点击空白区域取消暂时填入和激活状态
  cancelPendingAndActive()

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

  // 移动端：不处理 contextmenu 事件（由 touch 事件处理）
  if (isMobileDevice.value) {
    return
  }

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

/**
 * 移动端：单击时间块切换上下文菜单（显示/隐藏）
 */
function onMobileContextMenu(data) {
  const { block, clientX, clientY } = data

  // 如果菜单已显示且是同一个时间块，则关闭菜单
  if (contextMenu.value.visible && contextMenu.value.block?.id === block.id) {
    hideContextMenu()
    selectedBlockId.value = null
    return
  }

  // 否则显示菜单
  selectedBlockId.value = block.id
  const gridRect = dayGridRef.value.getBoundingClientRect()
  let x = clientX - gridRect.left
  let y = clientY - gridRect.top
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

/**
 * 全局点击处理：关闭右键菜单 + 取消激活状态（排除便签栏和创建流程）
 */
function handleGlobalClick(e) {
  // 关闭右键菜单
  hideContextMenu()

  // 判断是否需要取消激活状态
  // 排除：点击便签栏、正在创建中或准备创建、点击时间块（已在 onBlockSelect 处理）
  const clickedPool = e.target.closest('.task-pool')
  const clickedBlock = e.target.closest('.time-block')
  const clickedGrid = e.target.closest('.day-grid')
  const isCreatingNow = isCreating.value
  const isPreparingCreate = _createMoved // 已经开始拖拽准备创建

  // 点击时间网格区域不取消激活状态（可能是开始绘制）
  // 只有在明确点击其他区域时才取消
  if (!clickedPool && !clickedBlock && !clickedGrid && !isCreatingNow && !isPreparingCreate) {
    // 点击其他区域（如侧边栏、工具栏等），取消激活状态和暂时填入状态
    cancelPendingAndActive()
  }
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
    case 'reminder':
      openReminderDialog(block)
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
  // 特殊处理：1440分钟 = 24:00（允许结束时间为24:00）
  if (minutes >= 1440) return '24:00'
  const h = Math.floor(Math.max(0, minutes) / 60)
  const m = Math.max(0, minutes) % 60
  return `${String(Math.min(23, h)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function snapToGrid(minutes, maxMinutes = 1440) {
  const granularity = store.timeGranularity
  // 先限制在有效范围内，再对齐网格
  const clamped = Math.max(0, Math.min(maxMinutes, minutes))
  return Math.round(clamped / granularity) * granularity
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

  // 判断是否有激活便签
  if (activeNoteId.value) {
    // 有激活便签：直接创建时间块
    const activeNote = notes.value.find(n => n.id === activeNoteId.value)
    if (activeNote) {
      store.addBlock({
        id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        noteId: activeNote.id,
        noteName: activeNote.name,
        noteColor: activeNote.color,
        date: currentDate.value,
        startTime: minutesToTime(clampedStart),
        endTime: minutesToTime(clampedEnd),
        remark: ''
      })
      ElMessage.success(`已创建 "${activeNote.name}" (${minutesToTime(clampedStart)}-${minutesToTime(clampedEnd)})`)
      // 创建后取消激活状态
      activeNoteId.value = null
    }
  } else {
    // 无激活便签：进入暂时填入状态
    pendingBlock.value = {
      startTime: minutesToTime(clampedStart),
      endTime: minutesToTime(clampedEnd),
      date: currentDate.value
    }
    ElMessage.info('请点击便签完成创建，或点击其他区域取消')
  }
}

async function confirmAddBlock() {
  const dateStr = currentDate.value

  if (dialogMode.value === 'edit' && editingBlockId.value) {
    store.updateBlock(editingBlockId.value, { ...newBlock.value })
    ElMessage.success('已更新时间块')
    // 更新时间块后刷新提醒状态(便签可能开启自动提醒)
    await loadReminderStatus()
  } else {
    store.addBlock({
      ...newBlock.value,
      date: dateStr
    })
    ElMessage.success('已创建时间块')
    // 创建时间块后刷新提醒状态(便签可能开启自动提醒)
    await loadReminderStatus()
  }
  dialogVisible.value = false
}

// ---- 拖拽创建（鼠标按下拖拽画出新块）----
const isCreating = ref(false)
const createStartY = ref(0)         // 创建起始 Y（相对于滚动容器）
const createCurrentY = ref(0)       // 当前鼠标 Y
let _createStartClientY = 0
let _suppressNextClick = false      // 阻止拖拽创建后的冒泡 click 事件（模块级变量）
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
  finishCreate()
}

/**
 * 移动端：在时间网格区域触摸开始绘制时间块
 */
function onGridTouchStart(e) {
  // 仅在移动端处理；忽略多指、时间块、上下文菜单上的触摸
  if (!isMobileDevice.value || e.touches.length !== 1) return
  if (e.target.closest('.time-block')) return
  if (e.target.closest('.context-menu')) return

  // 阻止默认滚动/鼠标模拟事件，确保在时间块区域滑动时绘制而非滚动
  e.preventDefault()

  const touch = e.touches[0]
  _createStartClientY = touch.clientY
  const rect = dayGridRef.value.getBoundingClientRect()
  createStartY.value = touch.clientY - rect.top
  createCurrentY.value = createStartY.value
  _createMoved = false

  document.addEventListener('touchmove', onCreateTouchMove, { passive: false })
  document.addEventListener('touchend', onCreateTouchEnd, { once: true })
  document.addEventListener('touchcancel', onCreateTouchEnd, { once: true })
}

function onCreateTouchMove(e) {
  if (e.touches.length === 0) return
  const touch = e.touches[0]

  // 首次移动时才激活创建模式（区分点击和滑动）
  if (!isCreating.value && !_createMoved) {
    _createMoved = true
    _suppressNextClick = true
    isCreating.value = true
  }
  if (!isCreating.value) return

  // 阻止页面滚动，确保滑动用于绘制
  e.preventDefault()
  const rect = dayGridRef.value.getBoundingClientRect()
  createCurrentY.value = touch.clientY - rect.top
}

function onCreateTouchEnd(e) {
  document.removeEventListener('touchmove', onCreateTouchMove)
  document.removeEventListener('touchcancel', onCreateTouchEnd)

  // 未发生移动的触摸视为点击空白区域：取消暂存/激活状态并关闭菜单
  if (!_createMoved) {
    cancelPendingAndActive()
    selectedBlockId.value = null
    hideContextMenu()
    return
  }

  finishCreate()
}

/**
 * 完成拖拽/滑动创建
 */
function finishCreate() {
  // 未发生过移动（纯点击），不做任何处理
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
    // 重置抑制标志，允许后续点击
    _suppressNextClick = false
    return
  }

  // 重要：确保抑制接下来的 click 事件（防止 cancelPendingAndActive 被触发）
  _suppressNextClick = true

  // 步骤1：计算原始分钟值（不对齐网格，保留用户意图）
  const rawStartMinutes = (minY / hourHeight) * 60
  const rawEndMinutes = (maxY / hourHeight) * 60
  const rawDuration = rawEndMinutes - rawStartMinutes

  // 步骤2：先截断到有效边界（0-1440），保留用户意图时长
  let boundedStart = Math.max(0, rawStartMinutes)
  let boundedEnd = Math.min(1440, rawEndMinutes)

  // 步骤3：如果截断后时长太小（小于粒度），整体移动到边界处
  // 这是唯一允许改变用户意图的情况
  if (boundedEnd - boundedStart < store.timeGranularity) {
    // 判断靠近哪个边界
    if (rawStartMinutes < store.timeGranularity) {
      // 靠近上边界：固定在顶部
      boundedStart = 0
      boundedEnd = store.timeGranularity
    } else {
      // 靠近下边界：固定在底部
      boundedStart = 1440 - store.timeGranularity
      boundedEnd = 1440
    }
  }

  // 步骤4：最后才对齐网格（在截断后的有效范围内对齐）
  let clampedStart = snapToGrid(boundedStart)
  let clampedEnd = snapToGrid(boundedEnd)

  // 步骤5：确保最终时长至少一个粒度（网格对齐可能使时长变短）
  // 但只扩大结束时间，不移动开始位置，且结束时间要对齐到网格
  if (clampedEnd - clampedStart < store.timeGranularity) {
    clampedEnd = snapToGrid(clampedStart + store.timeGranularity)
    // 如果扩大后超出边界，固定到边界
    if (clampedEnd > 1440) {
      clampedEnd = 1440
    }
  }

  // 重置创建状态
  isCreating.value = false

  // 使用 requestAnimationFrame 延迟设置 pendingBlock，确保 click 事件已被处理
  requestAnimationFrame(async () => {
    // 判断是否有激活便签
    if (activeNoteId.value) {
      // 有激活便签：直接创建时间块
      const activeNote = notes.value.find(n => n.id === activeNoteId.value)
      if (activeNote) {
        store.addBlock({
          id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          noteId: activeNote.id,
          noteName: activeNote.name,
          noteColor: activeNote.color,
          date: currentDate.value,
          startTime: minutesToTime(clampedStart),
          endTime: minutesToTime(clampedEnd),
          remark: ''
        })
        ElMessage.success(`已创建 "${activeNote.name}" (${minutesToTime(clampedStart)}-${minutesToTime(clampedEnd)})`)
        // 创建后取消激活状态
        activeNoteId.value = null
        // 创建时间块后刷新提醒状态(便签可能开启自动提醒)
        await loadReminderStatus()
      }
    } else {
      // 无激活便签：进入暂时填入状态，等待用户选择便签
      pendingBlock.value = {
        startTime: minutesToTime(clampedStart),
        endTime: minutesToTime(clampedEnd),
        date: currentDate.value
      }
      ElMessage.info('请点击便签完成创建，或点击其他区域取消')
    }

    // 延迟重置 _suppressNextClick，确保所有事件已处理完毕
    setTimeout(() => {
      _suppressNextClick = false
    }, 50)
  })
}

// ---- 移动端便签拖拽状态 ----
const mobileDragState = ref({
  active: false,
  note: null,
  clientX: 0,
  clientY: 0,
  overGrid: false,
  targetTime: ''
})

const mobileDragIndicatorStyle = computed(() => ({
  position: 'fixed',
  left: `${mobileDragState.value.clientX - 40}px`,
  top: `${mobileDragState.value.clientY - 30}px`,
  zIndex: 9999
}))

/**
 * 移动端：便签开始拖拽
 */
function onMobileDragStart(data) {
  mobileDragState.value = {
    active: true,
    note: data.note,
    clientX: data.startX,
    clientY: data.startY,
    overGrid: false,
    targetTime: ''
  }
}

/**
 * 移动端：便签拖拽移动
 */
function onMobileDragMove(data) {
  if (!mobileDragState.value.active) return

  mobileDragState.value.clientX = data.clientX
  mobileDragState.value.clientY = data.clientY

  // 检测是否在 day-grid 区域上方
  const gridRect = dayGridRef.value?.getBoundingClientRect()
  if (gridRect) {
    const overGrid = data.clientX >= gridRect.left && data.clientX <= gridRect.right &&
                     data.clientY >= gridRect.top && data.clientY <= gridRect.bottom
    mobileDragState.value.overGrid = overGrid

    if (overGrid) {
      // 计算目标时间
      const y = data.clientY - gridRect.top
      const totalMinutes = (y / hourHeight) * 60
      const snappedMinutes = snapToGrid(totalMinutes)
      mobileDragState.value.targetTime = minutesToTime(Math.max(0, Math.min(1380, snappedMinutes)))
    }
  }
}

/**
 * 移动端：便签拖拽结束，在 day-grid 区域创建时间块
 */
function onMobileDragEnd(data) {
  if (!mobileDragState.value.active) return

  const { note, clientX, clientY } = data

  // 检测是否在 day-grid 区域上方
  const gridRect = dayGridRef.value?.getBoundingClientRect()
  let created = false

  if (gridRect) {
    const overGrid = clientX >= gridRect.left && clientX <= gridRect.right &&
                     clientY >= gridRect.top && clientY <= gridRect.bottom

    if (overGrid && note) {
      // 在时间网格区域创建时间块
      const y = clientY - gridRect.top
      const totalMinutes = (y / hourHeight) * 60
      const startMinutes = snapToGrid(totalMinutes)
      const clampedStart = Math.max(0, Math.min(1380, startMinutes))
      const duration = note.duration || 30
      const endMinutes = Math.min(clampedStart + duration, 1440)

      store.addBlock({
        id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        noteId: note.id,
        noteName: note.name,
        noteColor: note.color,
        date: currentDate.value,
        startTime: minutesToTime(clampedStart),
        endTime: minutesToTime(endMinutes),
        remark: ''
      })
      ElMessage.success(`已创建 "${note.name}" (${minutesToTime(clampedStart)}-${minutesToTime(endMinutes)})`)
      created = true
    }
  }

  // 重置拖拽状态
  mobileDragState.value = {
    active: false,
    note: null,
    clientX: 0,
    clientY: 0,
    overGrid: false,
    targetTime: ''
  }
}

// ---- 移动端时间块拖拽状态（拖到便签栏回收）----
const mobileBlockDragState = ref({
  active: false,
  block: null,
  clientX: 0,
  clientY: 0,
  overPool: false,
  categoryColor: '',
  categoryName: ''
})

const mobileBlockDragIndicatorStyle = computed(() => ({
  position: 'fixed',
  left: `${mobileBlockDragState.value.clientX - 40}px`,
  top: `${mobileBlockDragState.value.clientY - 30}px`,
  zIndex: 9999
}))

/**
 * 移动端：时间块开始拖拽
 */
function onMobileBlockDragStart(data) {
  mobileBlockDragState.value = {
    active: true,
    block: data.block,
    clientX: data.startX,
    clientY: data.startY,
    overPool: false,
    categoryColor: data.categoryColor,
    categoryName: data.categoryName
  }
  // 高亮便签栏
  isPoolHighlighted.value = true
}

/**
 * 移动端：时间块拖拽移动
 */
function onMobileBlockDragMove(data) {
  if (!mobileBlockDragState.value.active) return

  mobileBlockDragState.value.clientX = data.clientX
  mobileBlockDragState.value.clientY = data.clientY

  // 检测是否在便签栏区域上方
  const poolEl = taskPoolRef.value?.$el || document.querySelector('.task-pool')
  if (poolEl) {
    const poolRect = poolEl.getBoundingClientRect()
    const overPool = data.clientX >= poolRect.left && data.clientX <= poolRect.right &&
                     data.clientY >= poolRect.top && data.clientY <= poolRect.bottom
    mobileBlockDragState.value.overPool = overPool
    isPoolHighlighted.value = overPool
  }
}

/**
 * 移动端：时间块拖拽结束，在便签栏区域回收
 */
function onMobileBlockDragEnd(data) {
  if (!mobileBlockDragState.value.active) return

  const { block, clientX, clientY, categoryColor, categoryName } = data

  // 关闭上下文菜单（修复拖拽结束后菜单依旧存在的问题）
  hideContextMenu()

  // 检测是否在便签栏区域上方
  const poolEl = taskPoolRef.value?.$el || document.querySelector('.task-pool')
  let recycled = false

  if (poolEl) {
    const poolRect = poolEl.getBoundingClientRect()
    const overPool = clientX >= poolRect.left && clientX <= poolRect.right &&
                     clientY >= poolRect.top && clientY <= poolRect.bottom

    if (overPool && block) {
      // 回收时间块到便签栏
      taskPoolRef.value?.recycleTask(categoryName || block.noteName || block.taskName, categoryColor || block.noteColor)
      // 删除时间块
      deleteBlock(block.id)
      if (selectedBlockId.value === block.id) {
        selectedBlockId.value = null
      }
      ElMessage.success(`"${categoryName || block.noteName || block.taskName}"已回收到便签栏`)
      recycled = true
    }
  }

  // 重置拖拽状态
  mobileBlockDragState.value = {
    active: false,
    block: null,
    clientX: 0,
    clientY: 0,
    overPool: false,
    categoryColor: '',
    categoryName: ''
  }
  isPoolHighlighted.value = false
}

const createPreviewStyle = computed(() => {
  const minY = Math.min(createStartY.value, createCurrentY.value)
  const maxY = Math.max(createStartY.value, createCurrentY.value)

  // 与 finishCreate 保持一致的逻辑：先截断，再对齐网格
  const rawStartMinutes = (minY / hourHeight) * 60
  const rawEndMinutes = (maxY / hourHeight) * 60

  let boundedStart = Math.max(0, rawStartMinutes)
  let boundedEnd = Math.min(1440, rawEndMinutes)

  // 如果截断后时长太小，整体移动到边界
  if (boundedEnd - boundedStart < store.timeGranularity) {
    if (rawStartMinutes < store.timeGranularity) {
      boundedStart = 0
      boundedEnd = store.timeGranularity
    } else {
      boundedStart = 1440 - store.timeGranularity
      boundedEnd = 1440
    }
  }

  // 对齐网格
  let previewStart = snapToGrid(boundedStart)
  let previewEnd = snapToGrid(boundedEnd)

  // 确保最小时长
  if (previewEnd - previewStart < store.timeGranularity) {
    previewEnd = snapToGrid(previewStart + store.timeGranularity)
    if (previewEnd > 1440) previewEnd = 1440
  }

  // 转换回像素位置
  const previewMinY = (previewStart / 60) * hourHeight
  const previewMaxY = (previewEnd / 60) * hourHeight

  return {
    top: previewMinY + 'px',
    left: '8px',
    right: '8px',
    height: (previewMaxY - previewMinY) + 'px'
  }
})

const createPreviewText = computed(() => {
  const minY = Math.min(createStartY.value, createCurrentY.value)
  const maxY = Math.max(createStartY.value, createCurrentY.value)

  // 与 finishCreate 保持一致的逻辑
  const rawStartMinutes = (minY / hourHeight) * 60
  const rawEndMinutes = (maxY / hourHeight) * 60

  let boundedStart = Math.max(0, rawStartMinutes)
  let boundedEnd = Math.min(1440, rawEndMinutes)

  if (boundedEnd - boundedStart < store.timeGranularity) {
    if (rawStartMinutes < store.timeGranularity) {
      boundedStart = 0
      boundedEnd = store.timeGranularity
    } else {
      boundedStart = 1440 - store.timeGranularity
      boundedEnd = 1440
    }
  }

  let previewStart = snapToGrid(boundedStart)
  let previewEnd = snapToGrid(boundedEnd)

  if (previewEnd - previewStart < store.timeGranularity) {
    previewEnd = snapToGrid(previewStart + store.timeGranularity)
    if (previewEnd > 1440) previewEnd = 1440
  }

  return `${minutesToTime(previewStart)} ~ ${minutesToTime(previewEnd)}`
})

// 暂时填入预览块样式
const pendingPreviewStyle = computed(() => {
  if (!pendingBlock.value) return {}
  const start = timeToMinutes(pendingBlock.value.startTime)
  const end = timeToMinutes(pendingBlock.value.endTime)
  const top = (start / 60) * hourHeight
  const height = ((end - start) / 60) * hourHeight
  return {
    top: `${top}px`,
    left: '4px',
    right: '4px',
    height: `${height}px`
  }
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
  const granularity = store.timeGranularity
  dropMinute.value = Math.max(0, Math.min(60 - granularity, Math.round(dropMins % 60 / granularity) * granularity))
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

// ---- 便签点击交互（激活便签 / 确认创建）----

/**
 * 处理便签点击事件
 * @param {Object} note - 便签对象
 * @param {MouseEvent} event - 鼠标事件（用于检测复合键）
 */
async function handleNoteClick(note, event) {
  // 移动端：直接激活便签（无需复合键）
  // PC端：需要 Ctrl/Alt/Shift 复合键才能激活
  const shouldActivate = isMobileDevice.value ||
    (event && (event.ctrlKey || event.altKey || event.shiftKey))

  // 如果有暂时填入状态，点击便签确认创建
  if (pendingBlock.value) {
    store.addBlock({
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      noteId: note.id,
      noteName: note.name,
      noteColor: note.color,
      date: pendingBlock.value.date,
      startTime: pendingBlock.value.startTime,
      endTime: pendingBlock.value.endTime,
      remark: ''
    })
    ElMessage.success(`已创建 "${note.name}" (${pendingBlock.value.startTime}-${pendingBlock.value.endTime})`)
    pendingBlock.value = null
    // 创建后取消激活状态（根据用户需求）
    activeNoteId.value = null
    // 创建时间块后刷新提醒状态(便签可能开启自动提醒)
    await loadReminderStatus()
    return
  }

  // 无暂时填入状态，根据条件激活便签
  if (shouldActivate) {
    activeNoteId.value = activeNoteId.value === note.id ? null : note.id
    if (activeNoteId.value) {
      ElMessage.info(`已激活便签 "${note.name}"，绘制区域将直接创建该类型时间块`)
    } else {
      ElMessage.info('已取消激活便签')
    }
  }
}

/**
 * 取消暂时填入状态和激活便签状态
 */
function cancelPendingAndActive() {
  if (pendingBlock.value) {
    pendingBlock.value = null
    ElMessage.info('已取消创建')
  }
  if (activeNoteId.value) {
    activeNoteId.value = null
  }
}

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

  // Escape：取消选中 + 关闭菜单 + 取消激活状态
  if (e.key === 'Escape') {
    if (contextMenu.value.visible) {
      hideContextMenu()
    } else {
      cancelPendingAndActive()
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
  const STEP = store.timeGranularity // 使用动态时间粒度

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
      newEnd = Math.max(start + STEP, end - STEP)
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
  // 移动端默认显示便签栏（用户可通过按钮手动切换）
  // 重新检查移动端提示状态
  checkMobileHint()
}

// ---- 生命周期 ----
onMounted(() => {
  // 检查移动端提示状态
  checkMobileHint()

  // 加载提醒状态
  loadReminderStatus()

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

  // 点击空白处关闭右键菜单 + 处理取消激活状态
  document.addEventListener('click', handleGlobalClick)

  // 窗口尺寸监听
  window.addEventListener('resize', handleResize)
  handleResize() // 初始响应

  // 移动端：在时间网格区域监听 touchstart（使用非被动监听器以阻止默认滚动）
  dayGridRef.value?.addEventListener('touchstart', onGridTouchStart, { passive: false })
})

onBeforeUnmount(() => {
  if (currentTimeTimer) clearInterval(currentTimeTimer)
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('click', handleGlobalClick)
  window.removeEventListener('resize', handleResize)
  dayGridRef.value?.removeEventListener('touchstart', onGridTouchStart)
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

// =============================================
// 移动端竖屏布局优化（≤768px）
// 注意：便签栏的移动端样式已在 TaskPool.vue 内部定义
// 这里只定义 DayView 自身的布局调整
// =============================================
@media screen and (max-width: 767px) {
  .day-view-wrapper {
    // 移动端保持横向布局
    flex-direction: row;
  }
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
  flex-wrap: nowrap; // PC端不换行

  // 移动端：切换为多行布局，并预留顶部安全区域
  &.is-mobile {
    flex-direction: column;
    flex-wrap: nowrap;
    gap: 8px;
    padding: 8px 12px 6px;
    padding-top: calc(8px + env(safe-area-inset-top)); // 前置摄像头/刘海区域留空
  }

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
    flex-wrap: nowrap;
  }
}

// 移动端顶部第一行（标题 + 日期选择器 + 便签切换）
.mobile-header-row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    flex-shrink: 0;
  }

  .mobile-date-picker {
    flex: 1;
    max-width: 140px;
  }

  .mobile-pool-toggle {
    flex-shrink: 0;
    min-width: 60px;
    font-size: 13px;
  }
}

// 移动端顶部第二行（今天按钮 + 日期导航 + 粒度选择器）
.mobile-header-row2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;

  .mobile-today-btn {
    flex-shrink: 0;
  }

  .mobile-date-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex: 1;
  }

  .mobile-current-date {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    min-width: 50px;
    text-align: center;
    white-space: nowrap;
  }

  .mobile-granularity-select {
    flex-shrink: 0;
    width: 70px;
    
    :deep(.el-input__wrapper) {
      font-size: 12px;
    }
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

.granularity-label {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

// ---- 内容区域 ----
.day-view-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  // 桌面端保持卡片样式
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
  position: relative;  // 添加相对定位，让内部绝对定位元素（红线）能够正确定位
  width: var(--timeline-width, 56px);
  flex-shrink: 0;
  border-right: 1px solid var(--border-light);
  background: var(--bg-tertiary);
  display: flex;
  flex-direction: column;
  // 与 day-grid 保持相同的高度，确保滚动对齐
  height: calc(var(--grid-total-hours, 24) * 60px);
}

.time-mark {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 6px;
  font-size: 10px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  position: relative;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;  // 改为 top: 0，让刻度线在刻度块的顶部显示，正确对应时间点
    width: calc(100% - 6px);
    height: 1px;
    background: var(--border-lighter);
  }

  // 整点刻度样式（更突出）
  &.hour-mark {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-regular);

    &::after {
      height: 2px;  // 整点刻度线条更粗（2px）
      background: var(--border-light);
    }
  }
}

// ---- 时间网格 ----
.day-grid {
  flex: 1;
  position: relative;
  height: calc(var(--grid-total-hours, 24) * 60px);
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

// ---- 当前时间红线（在timeline内显示）----
.current-time-line {
  position: absolute;
  left: 0;
  right: 0;  // 在timeline内撑满宽度
  z-index: 1;  // timeline内的元素，提高层级确保显示
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

  // 圆点显示在timeline右侧边缘（border-right位置）
  &::after {
    content: '';
    position: absolute;
    left: -2px;  // 在timeline左边界处（border-left位置）
    top: -5px;
    width: 8px;
    height: 8px;
    background: var(--danger-color);
    border-radius: 50%;
    border: 2px solid var(--bg-secondary);
    box-shadow: 0 0 4px rgba(245, 108, 108, 0.4);
  }
}

.current-time-label {
  position: absolute;
  left: 1px;  // 在timeline内部左侧显示
  top: -10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--danger-color);
  background: var(--bg-tertiary);  // 使用timeline的背景色
  padding: 0 4px;
  border-radius: 3px;
  line-height: 18px;
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
  z-index: 11;  // 高于红线圆点
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

// ---- 暂时填入预览块 ----
.pending-preview {
  position: absolute;
  border: 3px solid var(--warning-color);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(230, 162, 60, 0.15), rgba(230, 162, 60, 0.25));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  z-index: 6;
  pointer-events: none;
  animation: pulse-pending 1.5s ease-in-out infinite;
  box-shadow: 0 0 12px rgba(230, 162, 60, 0.4);
}

@keyframes pulse-pending {
  0%, 100% {
    opacity: 0.7;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.02);
  }
}

.pending-preview-text {
  font-size: 13px;
  color: var(--warning-color);
  font-weight: 600;
  background: var(--bg-secondary);
  padding: 2px 10px;
  border-radius: 4px;
  white-space: nowrap;
}

.pending-preview-time {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 1px 8px;
  border-radius: 4px;
}

// ---- 移动端拖拽指示器 ----
.mobile-drag-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border: 2px solid var(--primary-color);
  pointer-events: none;

  .drag-note-color {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .drag-note-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
  }

  .drag-target-time {
    font-size: 12px;
    color: var(--primary-color);
    background: var(--primary-light);
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 4px;
  }
}

// ---- 移动端时间块拖拽指示器 ----
.mobile-block-drag-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border: 2px solid var(--success-color);
  pointer-events: none;

  .drag-block-color {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .drag-block-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
  }

  .drag-recycle-hint {
    font-size: 12px;
    color: var(--success-color);
    background: var(--success-light);
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 4px;
  }
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
  top: 50vh;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--text-secondary);
  z-index: 10;
  pointer-events: none;

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

    strong {
      color: var(--primary-color);
      font-weight: 600;
    }
  }
}

// ---- 移动端滑动提示 ----
.mobile-swipe-hint {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  cursor: pointer;
  animation: fadeIn 0.3s ease-out;

  .hint-content {
    background: var(--bg-secondary);
    border-radius: 12px;
    padding: 20px 24px;
    max-width: 320px;
    width: 100%;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    text-align: center;
    animation: slideUp 0.3s ease-out;
  }

  .hint-icon {
    color: var(--primary-color);
    margin-bottom: 12px;
  }

  .hint-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 16px;
  }

  .hint-steps {
    margin-bottom: 12px;
  }

  .hint-step {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 10px;
    text-align: left;

    .step-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      background: var(--primary-color);
      color: white;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .step-text {
      font-size: 13px;
      color: var(--text-regular);
      line-height: 1.4;

      strong {
        color: var(--primary-color);
        font-weight: 600;
      }
    }
  }

  .hint-tip {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0 0 16px;
    padding: 8px 12px;
    background: var(--bg-tertiary);
    border-radius: 6px;
    line-height: 1.4;
  }

  .hint-dismiss-btn {
    display: inline-block;
    padding: 10px 20px;
    background: var(--primary-color);
    color: white;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;

    &:active {
      transform: scale(0.98);
      background: var(--primary-color-dark);
    }
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// =============================================
// 响应式布局
// =============================================

// Level 2: 中等屏幕 (768px ~ 1199px) TaskPool 收窄（桌面端中等宽度）
@media screen and (max-width: 1199px) and (min-width: 768px) {
  .day-view-wrapper:not(.pool-collapsed) {
    .task-pool {
      width: 180px;
    }
  }

  .date-nav .current-date {
    min-width: 130px;
  }
}

// Level 3: 移动端竖屏优化布局（≤767px）
@media screen and (max-width: 767px) {
  // 时间网格区域去掉外间距，顶到屏幕边缘
  .day-view-content {
    margin: 0; // 移除外圈边距
    margin-top: 0;
    border-radius: 0; // 移除圆角卡片样式
    box-shadow: none; // 移除阴影
    background: var(--bg-secondary); // 保持背景色
  }

  // 时间轴保持宽度,优化字体大小
  // 时间刻度区域上下滑动用于屏幕垂直滚动（宽度加宽方便触摸滑动）
  .timeline {
    width: 65px; // 加宽方便触摸滑动
    min-width: 65px;
    touch-action: pan-y;

    .time-mark {
      font-size: 10px;
      padding-right: 4px;

      &.hour-mark {
        font-size: 11px;
      }
    }
  }

  // 时间块区域滑动用于绘制时间块，禁用默认滚动
  .day-grid {
    touch-action: none;
  }

  // 空状态提示优化
  .empty-hint {
    .empty-hint-title {
      font-size: 13px;
    }
    .empty-hint-desc {
      font-size: 12px;
      max-width: 180px; // 压缩宽度
    }
  }

  // 移动端滑动提示优化
  .mobile-swipe-hint {
    .hint-content {
      max-width: 280px;
      padding: 16px 18px;
    }

    .hint-title {
      font-size: 14px;
    }

    .hint-step {
      .step-text {
        font-size: 12px;
      }
    }
  }
}

// Level 4: 超小屏幕（≤480px，如小窗口分屏）
@media screen and (max-width: 480px) {
  // 移动端顶部进一步压缩
  .mobile-header-row1 {
    gap: 6px;
    
    h2 {
      font-size: 14px;
    }
    
    .mobile-date-picker {
      max-width: 110px;
    }
    
    .mobile-pool-toggle {
      min-width: 50px;
      font-size: 12px;
    }
  }
  
  .mobile-header-row2 {
    gap: 6px;

    .mobile-date-nav {
      gap: 4px;
    }
    
    .mobile-current-date {
      font-size: 12px;
      min-width: 44px;
    }
    
    .mobile-granularity-select {
      width: 65px;
      
      :deep(.el-input__wrapper) {
        font-size: 11px;
      }
    }
  }

  // 时间轴进一步压缩（便签栏样式由 TaskPool.vue 内部管理）
  .timeline {
    width: 44px;
    min-width: 44px;

    .time-mark {
      font-size: 9px;

      &.hour-mark {
        font-size: 10px;
      }
    }
  }
}

// ---- 搜索功能样式 ----
.search-source-info {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.search-results {
  max-height: 400px;
  overflow-y: auto;
  margin-top: 8px;

  .search-result-item {
    padding: 12px;
    border-radius: 8px;
    background: var(--bg-tertiary);
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: var(--bg-hover-soft);
      transform: translateX(4px);
    }

    &:last-child {
      margin-bottom: 0;
    }

    // 云端结果样式区分
    &.cloud-item {
      border: 1px dashed var(--warning-color);
    }

    .result-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;

      .result-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }
    }

    .result-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .result-date {
        font-size: 12px;
        color: var(--text-secondary);
      }

      .result-desc {
        font-size: 11px;
        color: var(--text-regular);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

.search-empty {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
}

.mobile-search-btn {
  margin-left: 8px;
}
</style>
