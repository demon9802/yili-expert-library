import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { getToken } from '@/api/request'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'frontend',
    component: () => import('@/views/FrontendView.vue'),
  },
  {
    path: '/admin-login',
    name: 'admin-login',
    component: () => import('@/views/AdminLoginView.vue'),
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/AdminView.vue'),
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  if (to.meta?.requiresAuth && !getToken()) {
    next('/admin-login')
    return
  }
  next()
})

export default router
