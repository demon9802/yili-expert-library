<template>
  <div class="admin-login">
    <h2>管理员登录</h2>
    <p style="font-size:13px;color:#64748B;margin-bottom:16px;line-height:1.6">
      主管理员：账号留空，输入主密码即可登录。<br />
      子管理员：输入主管理员分发的账号和密码。
    </p>
    <p class="login-mobile-hint">建议使用电脑登录管理后台</p>

    <input
      v-model="account"
      type="text"
      placeholder="账号（主管理员留空）"
      @keydown.enter="handleLogin"
    />
    <input
      v-model="password"
      type="password"
      placeholder="请输入密码"
      @keydown.enter="handleLogin"
    />

    <div v-if="error" class="error" style="display:block">{{ error }}</div>

    <button class="btn btn-primary" style="width:100%" @click="handleLogin">登录</button>
    <button class="btn btn-secondary" style="width:100%;margin-top:8px" @click="goBack">返回前端</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/store/appStore'
import { authApi } from '@/api/auth'
import { setToken } from '@/api/request'

const router = useRouter()
const store = useAppStore()

const account = ref('')
const password = ref('')
const error = ref('')

function resolveEmail(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return 'master@yili.local'
  if (trimmed.includes('@')) return trimmed
  return trimmed + '@yili.local'
}

async function handleLogin() {
  error.value = ''
  const pwd = password.value
  if (!pwd) {
    error.value = '请输入密码'
    return
  }
  try {
    const email = resolveEmail(account.value)
    const result = await authApi.login(email, pwd)
    const token = result.token
    const user = result.user
    setToken(token)
    store.currentUser = {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
    }
    router.push('/admin')
  } catch (e: any) {
    const msg = e.message || '登录失败'
    if (msg.includes('500') || msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('超时')) {
      error.value = '无法连接后端服务（localhost:8080）。请先启动 backend：\nmvn spring-boot:run'
    } else {
      error.value = msg
    }
  }
}

function goBack() {
  router.push('/')
}
</script>
