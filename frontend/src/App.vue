<template>
  <div id="app-root">
    <!-- 测试模式全局横幅：模拟不同角色视角，并提供角色切换与退出（逃逸通道） -->
    <div v-if="store.testMode" class="test-mode-banner">
      <span class="test-mode-flag">🧪 测试模式</span>
      <span class="test-mode-role">当前视角：{{ roleLabel }}</span>
      <div class="test-mode-roles">
        <button
          class="test-role-btn"
          :class="{ active: store.testRole === 'master' }"
          @click="store.switchTestRole('master')"
        >主管理员</button>
        <button
          class="test-role-btn"
          :class="{ active: store.testRole === 'sub' }"
          @click="store.switchTestRole('sub')"
        >子管理员</button>
        <button
          class="test-role-btn"
          :class="{ active: store.testRole === 'user' }"
          @click="store.switchTestRole('user')"
        >前端用户</button>
      </div>
      <button class="test-exit-btn" @click="exit">退出测试模式</button>
    </div>
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/store/appStore'
import { getToken } from '@/api/request'
import { pageViewApi } from '@/api/pageView'

const store = useAppStore()
const router = useRouter()

const roleLabel = computed(() => {
  if (store.testRole === 'master') return '主管理员'
  if (store.testRole === 'sub') return '子管理员'
  return '前端用户'
})

async function exit() {
  await store.exitTestMode()
  router.push('/')
}

onMounted(async () => {
  // 记录页面访问
  pageViewApi.recordView().catch(() => {})

  // 检查登录状态
  if (getToken()) {
    await store.checkAuthState()
  }

  // 加载应用数据
  await store.loadAppData()

  // 路由权限统一在 router/index.ts 中处理，避免普通用户 token 被误判为后台权限
})
</script>

<style>
.test-mode-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px 16px;
  background: linear-gradient(90deg, #f59e0b, #d97706);
  color: #fff;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.test-mode-flag { font-weight: 700; }
.test-mode-role { opacity: 0.95; }
.test-mode-roles { display: flex; gap: 6px; }
.test-role-btn {
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}
.test-role-btn.active {
  background: #fff;
  color: #b45309;
  font-weight: 600;
}
.test-exit-btn {
  margin-left: auto;
  padding: 4px 12px;
  border: 1px solid #fff;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
}
/* 横幅占位：避免遮挡页面顶部内容 */
#app-root > .test-mode-banner + * {
  margin-top: 40px;
}
</style>
