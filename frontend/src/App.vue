<template>
  <div id="app-root">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/store/appStore'
import { getToken } from '@/api/request'
import { pageViewApi } from '@/api/pageView'

const store = useAppStore()
const router = useRouter()

onMounted(async () => {
  // 记录页面访问
  pageViewApi.recordView().catch(() => {})

  // 检查登录状态
  if (getToken()) {
    await store.checkAuthState()
  }

  // 加载应用数据
  await store.loadAppData()

  // 路由守卫
  router.beforeEach((to, _from, next) => {
    if (to.meta.requiresAuth && !store.currentUser) {
      next('/')
    } else {
      next()
    }
  })
})
</script>
