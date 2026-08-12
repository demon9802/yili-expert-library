<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="user-login-modal">
      <button class="close-btn" title="关闭" @click="$emit('close')">✕</button>

      <!-- Tab Switch -->
      <div class="auth-tabs">
        <button :class="['auth-tab', { active: mode === 'login' }]" @click="mode = 'login'">登录</button>
        <button :class="['auth-tab', { active: mode === 'signup' }]" @click="mode = 'signup'">注册</button>
      </div>

      <!-- Login Form -->
      <div v-if="mode === 'login'" class="auth-form">
        <h3>用户登录</h3>
        <p class="auth-hint">登录后可同步收藏的专家到云端，换设备不丢失。</p>
        <input
          v-model="loginEmail"
          type="text"
          placeholder="邮箱地址"
          @keydown.enter="handleLogin"
        />
        <input
          v-model="loginPassword"
          type="password"
          placeholder="密码"
          @keydown.enter="handleLogin"
        />
        <div v-if="error" class="auth-error">{{ error }}</div>
        <button class="btn btn-primary auth-submit" :disabled="loading" @click="handleLogin">
          {{ loading ? '登录中...' : '登录' }}
        </button>
        <button class="auth-switch" @click="mode = 'signup'">没有账号？去注册 →</button>
      </div>

      <!-- Signup Form -->
      <div v-else class="auth-form">
        <h3>用户注册</h3>
        <p class="auth-hint">使用邮箱注册即可，注册后自动登录。</p>
        <input
          v-model="signupEmail"
          type="text"
          placeholder="邮箱地址"
          @keydown.enter="handleSignup"
        />
        <input
          v-model="signupPassword"
          type="password"
          placeholder="密码（至少6位）"
          @keydown.enter="handleSignup"
        />
        <input
          v-model="signupConfirm"
          type="password"
          placeholder="确认密码"
          @keydown.enter="handleSignup"
        />
        <div v-if="error" class="auth-error">{{ error }}</div>
        <button class="btn btn-primary auth-submit" :disabled="loading" @click="handleSignup">
          {{ loading ? '注册中...' : '注册' }}
        </button>
        <button class="auth-switch" @click="mode = 'login'">已有账号？去登录 →</button>
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

const mode = ref<'login' | 'signup'>('login')
const loginEmail = ref('')
const loginPassword = ref('')
const signupEmail = ref('')
const signupPassword = ref('')
const signupConfirm = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  error.value = ''
  if (!loginEmail.value.trim()) {
    error.value = '请输入邮箱'
    return
  }
  if (!loginPassword.value) {
    error.value = '请输入密码'
    return
  }
  loading.value = true
  try {
    await store.login(loginEmail.value.trim(), loginPassword.value)
    emit('success')
  } catch (e: any) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}

async function handleSignup() {
  error.value = ''
  if (!signupEmail.value.trim()) {
    error.value = '请输入邮箱'
    return
  }
  if (!signupEmail.value.includes('@')) {
    error.value = '邮箱格式不正确'
    return
  }
  if (!signupPassword.value || signupPassword.value.length < 6) {
    error.value = '密码至少6位'
    return
  }
  if (signupPassword.value !== signupConfirm.value) {
    error.value = '两次密码不一致'
    return
  }
  loading.value = true
  try {
    await store.signUp(signupEmail.value.trim(), signupPassword.value)
    emit('success')
  } catch (e: any) {
    error.value = e.message || '注册失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.user-login-modal {
  background: #fff;
  border-radius: 16px;
  padding: 32px 36px 28px;
  width: 380px;
  max-width: 90vw;
  position: relative;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.close-btn {
  position: absolute;
  top: 14px;
  right: 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  color: #94A3B8;
  line-height: 1;
  padding: 4px;
}

.close-btn:hover {
  color: #475569;
}

.auth-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 24px;
  border-bottom: 2px solid #E2E8F0;
}

.auth-tab {
  flex: 1;
  padding: 10px 0;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: #94A3B8;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}

.auth-tab.active {
  color: #2563EB;
  border-bottom-color: #2563EB;
}

.auth-form h3 {
  font-size: 18px;
  font-weight: 700;
  color: #1E293B;
  margin: 0 0 8px;
}

.auth-hint {
  font-size: 13px;
  color: #64748B;
  line-height: 1.5;
  margin: 0 0 18px;
}

.auth-form input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #D1D5DB;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 12px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.auth-form input:focus {
  border-color: #2563EB;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.auth-error {
  background: #FEF2F2;
  color: #DC2626;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 12px;
  line-height: 1.5;
}

.auth-submit {
  width: 100%;
  padding: 11px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  background: #2563EB;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
}

.auth-submit:hover:not(:disabled) {
  background: #1D4ED8;
}

.auth-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-switch {
  display: block;
  width: 100%;
  text-align: center;
  margin-top: 14px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: #2563EB;
  padding: 4px;
}

.auth-switch:hover {
  text-decoration: underline;
}
</style>
