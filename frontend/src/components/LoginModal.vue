<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="admin-login" style="margin:0;position:relative">
      <button
        style="position:absolute;top:12px;right:14px;background:none;border:none;cursor:pointer;fontSize:18px;color:#94A3B8;lineHeight:1;padding:4px"
        title="关闭"
        @click="$emit('close')"
      >✕</button>
      <h2>管理员登录</h2>
      <p style="font-size:13px; color:#64748B; margin-bottom:16px; line-height:1.6; text-align:left">
        主管理员：账号留空，输入主密码即可登录。<br>
        子管理员：输入主管理员分发的账号和密码。
      </p>
      <p class="login-mobile-hint">建议使用电脑登录管理后台</p>

      <input v-model="account" type="text" placeholder="账号（主管理员留空）" @keyup.enter="handleLogin" />
      <input v-model="password" type="password" placeholder="请输入密码" @keyup.enter="handleLogin" />

      <div v-if="error" class="error" style="display:block">{{ error }}</div>

      <button class="btn btn-primary" style="width:100%" :disabled="loading" @click="handleLogin">
        {{ loading ? '登录中...' : '登录' }}
      </button>
      <button class="btn btn-secondary" style="width:100%; margin-top:8px" @click="$emit('close')">
        返回前端
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '@/store/appStore'

const emit = defineEmits<{
  close: []
  success: []
}>()

const store = useAppStore()

const account = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!password.value) {
    error.value = '请输入密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    // V6: 主管理员账号为空 → master@yili.local，密码 yili2026
    const email = account.value.trim() || 'master@yili.local'
    const resolvedEmail = email.includes('@') ? email : email + '@yili.local'
    await store.login(resolvedEmail, password.value)
    emit('success')
  } catch (e: any) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>
