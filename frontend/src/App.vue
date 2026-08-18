<template>
  <div id="app-root">
    <!-- 默认不挂载任何路由内容，身份明确通过后才展示业务页面。 -->
    <div v-if="!accessChecked" class="dy-checking-overlay" aria-live="polite">
      <div class="dy-checking-spinner"></div>
      <p>正在验证访问权限...</p>
    </div>
    <div v-else-if="accessDenied" class="dy-denied-overlay">
      <div class="dy-denied-card">
        <div class="dy-denied-icon">🔒</div>
        <h2 class="dy-denied-title">访问受限</h2>
        <p class="dy-denied-desc">{{ deniedReason }}</p>
        <p class="dy-denied-sub">如有疑问，请联系总部数字科技中心</p>
        <button class="dy-denied-admin-btn" @click="goAdmin">管理员入口</button>
      </div>
    </div>
    <template v-else>
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/store/appStore'
import { getToken } from '@/api/request'
import { pageViewApi } from '@/api/pageView'
import { resolveDigitalYiliAccess } from '@/api/digitalYili'

const store = useAppStore()
const router = useRouter()

// 鉴权完成前保持全屏等待，不挂载 router-view，也不加载任何业务数据。
const accessChecked = ref(false)
const accessDenied = ref(false)
const deniedReason = ref('')
let accessCheckId = 0
let initPromise: Promise<void> | null = null

function isAdminRoute(path: string): boolean {
  return path === '/admin-login' || path.startsWith('/admin')
}

function goAdmin() {
  router.push('/admin-login')
}

async function initApp() {
  // 记录页面访问
  pageViewApi.recordView().catch(() => {})
  // 检查登录状态
  if (getToken()) {
    await store.checkAuthState()
  }
  // 加载应用数据
  await store.loadAppData()
}

function initAppOnce(): Promise<void> {
  if (!initPromise) initPromise = initApp()
  return initPromise
}

const roleLabel = computed(() => {
  if (store.testRole === 'master') return '主管理员'
  if (store.testRole === 'sub') return '子管理员'
  return '前端用户'
})

async function exit() {
  await store.exitTestMode()
  router.push('/')
}

async function checkRouteAccess(path: string) {
  const checkId = ++accessCheckId

  // 管理后台保留原有账号密码/JWT 鉴权，由路由守卫负责保护。
  if (isAdminRoute(path)) {
    accessDenied.value = false
    deniedReason.value = ''
    accessChecked.value = true
    await initAppOnce()
    return
  }

  // 前台在每次进入时先隐藏路由内容，明确通过数字伊利鉴权后再展示。
  accessChecked.value = false
  accessDenied.value = false
  deniedReason.value = ''
  const access = await resolveDigitalYiliAccess()
  if (checkId !== accessCheckId) return

  if (access.status === 'denied') {
    accessDenied.value = true
    deniedReason.value = access.reason
    accessChecked.value = true
    return
  }

  accessChecked.value = true
  await initAppOnce()
}

watch(
  () => [router.currentRoute.value.path, router.currentRoute.value.query.digitalYiliToken] as const,
  ([path]) => {
    void checkRouteAccess(path)
  },
  { flush: 'sync', immediate: true }
)
</script>

<style>
.dy-checking-overlay,
.dy-denied-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.92);
}
.dy-checking-overlay {
  flex-direction: column;
  gap: 16px;
  color: #e2e8f0;
  font-size: 14px;
}
.dy-checking-overlay p {
  margin: 0;
}
.dy-checking-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: dy-spin 0.8s linear infinite;
}
@keyframes dy-spin {
  to { transform: rotate(360deg); }
}
.dy-denied-card {
  max-width: 420px;
  margin: 0 24px;
  padding: 48px 40px;
  border-radius: 16px;
  background: #ffffff;
  text-align: center;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
}
.dy-denied-icon {
  font-size: 44px;
  line-height: 1;
  margin-bottom: 18px;
}
.dy-denied-title {
  margin: 0 0 14px;
  font-size: 22px;
  font-weight: 700;
  color: #1f2937;
}
.dy-denied-desc {
  margin: 0 0 8px;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.7;
  word-break: break-all;
}
.dy-denied-sub {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
}
.dy-denied-admin-btn {
  margin-top: 22px;
  padding: 9px 26px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #f9fafb;
  color: #4b5563;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.dy-denied-admin-btn:hover {
  border-color: #2563eb;
  color: #2563eb;
  background: #eff6ff;
}
</style>

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
