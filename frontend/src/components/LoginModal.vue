<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="login-modal">
      <h2>管理员登录</h2>
      <div class="form-group">
        <label>邮箱</label>
        <input v-model="email" type="email" placeholder="请输入邮箱" @keyup.enter="handleLogin" />
      </div>
      <div class="form-group">
        <label>密码</label>
        <input v-model="password" type="password" placeholder="请输入密码" @keyup.enter="handleLogin" />
      </div>
      <div v-if="error" class="error-msg">{{ error }}</div>
      <div class="form-actions">
        <button class="btn btn-primary" :disabled="loading" @click="handleLogin">
          {{ loading ? '登录中...' : '登录' }}
        </button>
        <button class="btn btn-text" @click="goSignUp">注册新账号</button>
      </div>
      <div v-if="isSignUp" class="signup-section">
        <div class="form-group">
          <label>确认密码</label>
          <input v-model="confirmPassword" type="password" placeholder="请再次输入密码" />
        </div>
        <button class="btn btn-primary" :disabled="loading" @click="handleSignUp">
          {{ loading ? '注册中...' : '注册' }}
        </button>
      </div>
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

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const isSignUp = ref(false)
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!email.value || !password.value) {
    error.value = '请填写邮箱和密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await store.login(email.value, password.value)
    emit('success')
  } catch (e: any) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}

function goSignUp() {
  isSignUp.value = !isSignUp.value
  error.value = ''
}

async function handleSignUp() {
  if (!email.value || !password.value) {
    error.value = '请填写邮箱和密码'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = '两次密码不一致'
    return
  }
  if (password.value.length < 6) {
    error.value = '密码至少6位'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await store.signUp(email.value, password.value)
    emit('success')
  } catch (e: any) {
    error.value = e.message || '注册失败'
  } finally {
    loading.value = false
  }
}
</script>
