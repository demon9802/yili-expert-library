<template>
  <div class="modal-overlay">
    <div class="user-login-modal">
      <button class="close-btn" title="关闭" @click="$emit('close')">✕</button>

      <!-- Tab Switch（修改密码模式不显示 Tab） -->
      <div v-if="mode !== 'changePassword'" class="auth-tabs">
        <button :class="['auth-tab', { active: mode === 'login' }]" @click="mode = 'login'">登录</button>
        <button :class="['auth-tab', { active: mode === 'signup' }]" @click="mode = 'signup'">注册</button>
      </div>

      <!-- Login Form -->
      <div v-if="mode === 'login'" class="auth-form">
        <h3>用户登录</h3>
        <p class="auth-hint">登录后可同步收藏的专家到云端，换设备不丢失。<br />未注册，不影响其他功能使用。</p>
        <input
          v-model="loginEmail"
          type="text"
          placeholder="账号名称"
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
        <p class="auth-footnote">忘记密码，请联系DACC重置</p>
      </div>

      <!-- Signup Form -->
      <div v-else-if="mode === 'signup'" class="auth-form">
        <h3>用户注册</h3>
        <p class="auth-hint">自定义账号名称、设置密码，即可完成注册。<br />账号仅作为登录凭据，不读取任何信息，请放心使用。</p>
        <input
          v-model="signupEmail"
          type="text"
          placeholder="账号名称"
          @blur="checkAccountAvailable"
          @keydown.enter="handleSignup"
        />
        <div v-if="accountTip" :class="['account-tip', { taken: accountTaken }]">{{ accountTip }}</div>
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

      <!-- Change Password Form（登录后修改密码） -->
      <div v-else class="auth-form">
        <h3>修改密码</h3>
        <p class="auth-hint">当前账号：{{ store.currentUser?.email || '' }}，修改成功后请使用新密码登录。</p>
        <input
          v-model="oldPassword"
          type="password"
          placeholder="当前密码"
          @keydown.enter="handleChangePassword"
        />
        <input
          v-model="newPassword"
          type="password"
          placeholder="新密码（至少6位）"
          @keydown.enter="handleChangePassword"
        />
        <input
          v-model="confirmPassword"
          type="password"
          placeholder="确认新密码"
          @keydown.enter="handleChangePassword"
        />
        <div v-if="error" class="auth-error">{{ error }}</div>
        <div v-if="successMsg" class="auth-success">{{ successMsg }}</div>
        <button class="btn btn-primary auth-submit" :disabled="loading" @click="handleChangePassword">
          {{ loading ? '提交中...' : '确认修改' }}
        </button>
        <button class="auth-switch" @click="$emit('close')">完成 / 关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '@/store/appStore'
import { authApi } from '@/api/auth'

const props = defineProps<{
  /** 初始模式：login / signup / changePassword（登录后修改密码） */
  startMode?: 'login' | 'signup' | 'changePassword'
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const store = useAppStore()

const mode = ref<'login' | 'signup' | 'changePassword'>(props.startMode || 'login')
const loginEmail = ref('')
const loginPassword = ref('')
const signupEmail = ref('')
const signupPassword = ref('')
const signupConfirm = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const successMsg = ref('')
// 账号实时占用校验（注册输入框失焦触发；接口不可用时静默降级为提交时校验）
const accountTip = ref('')
const accountTaken = ref(false)

async function checkAccountAvailable() {
  accountTip.value = ''
  accountTaken.value = false
  const name = signupEmail.value.trim()
  if (!name || name.length < 2) return
  try {
    const exists = await authApi.checkAccount(name)
    if (exists) {
      accountTaken.value = true
      accountTip.value = '该账号已注册，请直接登录'
    } else {
      accountTip.value = '账号可用 ✓'
    }
  } catch {
    /* 接口不可用（如后端未更新）：静默，交给提交时后端校验兜底 */
  }
}

async function handleLogin() {
  error.value = ''
  if (!loginEmail.value.trim()) {
    error.value = '请输入账号名称'
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
  // 账号名为任意自定义字符串（不再要求邮箱格式）；唯一性由后端注册查重+DB唯一索引保障，
  // 重复时后端返回"该账号已注册，请直接登录"并展示在下方错误区
  if (!signupEmail.value.trim()) {
    error.value = '请输入账号名称'
    return
  }
  if (signupEmail.value.trim().length < 2) {
    error.value = '账号名称至少2个字符'
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
    // 提交前再校验一次占用（防止失焦校验未触发/结果过期）
    const exists = await authApi.checkAccount(signupEmail.value.trim()).catch(() => false)
    if (exists) {
      accountTaken.value = true
      accountTip.value = '该账号已注册，请直接登录'
      error.value = '该账号已注册，请直接登录'
      return
    }
    await store.signUp(signupEmail.value.trim(), signupPassword.value)
    emit('success')
  } catch (e: any) {
    error.value = e.message || '注册失败'
  } finally {
    loading.value = false
  }
}

// 登录后修改密码：仅需当前密码+新密码，不调取用户其他信息
async function handleChangePassword() {
  error.value = ''
  successMsg.value = ''
  if (!oldPassword.value) {
    error.value = '请输入当前密码'
    return
  }
  if (!newPassword.value || newPassword.value.length < 6) {
    error.value = '新密码至少6位'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = '两次新密码不一致'
    return
  }
  loading.value = true
  try {
    await authApi.changePassword(oldPassword.value, newPassword.value)
    successMsg.value = '密码修改成功，下次登录请使用新密码'
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e: any) {
    error.value = e.message || '修改失败，请检查当前密码是否正确'
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

.auth-footnote {
  text-align: center;
  font-size: 12px;
  color: #94A3B8;
  margin: 8px 0 0;
  line-height: 1.5;
}

.auth-success {
  background: #F0FDF4;
  color: #16A34A;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 12px;
  line-height: 1.5;
}

.account-tip {
  font-size: 12px;
  color: #16A34A;
  margin: -6px 0 10px 2px;
  line-height: 1.4;
}

.account-tip.taken {
  color: #DC2626;
}
</style>
