import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/record'
  },
  {
    path: '/record',
    name: 'Record',
    component: () => import('@views/DayView.vue'),
    meta: { title: '记录', icon: 'EditPen' }
  },
  {
    path: '/stats',
    name: 'Stats',
    component: () => import('@views/StatsView.vue'),
    meta: { title: '统计', icon: 'DataAnalysis' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@views/SettingsView.vue'),
    meta: { title: '设置', icon: 'Setting' }
  },
  // 子设置页面（移动端使用页面跳转）
  {
    path: '/settings/:key',
    name: 'SettingsDetail',
    component: () => import('@views/SettingsDetailView.vue'),
    meta: { title: '设置详情', icon: 'Setting', hidden: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
