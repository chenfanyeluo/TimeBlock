import { createRouter, createWebHashHistory } from 'vue-router'
import DayView from '@views/DayView.vue'
import StatsView from '@views/StatsView.vue'
import SettingsView from '@views/SettingsView.vue'
import SettingsDetailView from '@views/SettingsDetailView.vue'

const routes = [
  {
    path: '/',
    redirect: '/record'
  },
  {
    path: '/record',
    name: 'Record',
    component: DayView,
    meta: { title: '记录', icon: 'EditPen' }
  },
  {
    path: '/stats',
    name: 'Stats',
    component: StatsView,
    meta: { title: '统计', icon: 'DataAnalysis' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsView,
    meta: { title: '设置', icon: 'Setting' }
  },
  // 子设置页面（移动端使用页面跳转）
  {
    path: '/settings/:key',
    name: 'SettingsDetail',
    component: SettingsDetailView,
    meta: { title: '设置详情', icon: 'Setting', hidden: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
