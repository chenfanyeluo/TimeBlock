import { createRouter, createWebHashHistory } from 'vue-router'
import DayView from '@views/DayView.vue'
import WeekView from '@views/WeekView.vue'
import MonthView from '@views/MonthView.vue'
import SettingsView from '@views/SettingsView.vue'

const routes = [
  {
    path: '/',
    redirect: '/day'
  },
  {
    path: '/day',
    name: 'DayView',
    component: DayView,
    meta: { title: '日视图', icon: 'Calendar' }
  },
  {
    path: '/week',
    name: 'WeekView',
    component: WeekView,
    meta: { title: '周视图', icon: 'CalendarWeek' }
  },
  {
    path: '/month',
    name: 'MonthView',
    component: MonthView,
    meta: { title: '月视图', icon: 'CalendarMonth' }
  },
  {
    path: '/settings',
    name: 'SettingsView',
    component: SettingsView,
    meta: { title: '设置', icon: 'Setting' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
