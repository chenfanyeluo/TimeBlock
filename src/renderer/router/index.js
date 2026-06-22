import { createRouter, createWebHashHistory } from 'vue-router'
import DayView from '@views/DayView.vue'
import StatsView from '@views/StatsView.vue'
import SettingsView from '@views/SettingsView.vue'

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
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
