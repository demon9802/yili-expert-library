import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { getToken } from '@/api/request'
import { useAppStore } from '@/store/appStore'

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
    meta: { requiresAuth: true, requiresAdmin: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  if (!to.meta?.requiresAuth) {
    next()
    return
  }

  if (!getToken()) {
    next('/admin-login')
    return
  }

  const store = useAppStore()
  if (!store.currentUser) {
    await store.checkAuthState()
  }

  if (to.meta?.requiresAdmin && !store.isAdmin) {
    next('/')
    return
  }

  next()
})

export default router
