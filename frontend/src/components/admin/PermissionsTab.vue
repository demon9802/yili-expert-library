<template>
  <section class="admin-tab">
    <div class="admin-toolbar">
      <h3>权限管理</h3>
      <button class="btn primary" :disabled="saving" @click="savePermissions">保存权限</button>
    </div>

    <p class="hint">为子管理员配置可访问的管理模块，邮箱每行一个。</p>
    <div class="permission-list">
      <div v-for="item in permissions" :key="item.tab" class="permission-card">
        <label class="inline"><input v-model="item.enabled" type="checkbox" /> {{ item.label }}</label>
        <textarea v-model="item.emailsText" rows="3" placeholder="user@example.com" />
      </div>
    </div>
    <p v-if="message" class="message">{{ message }}</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { settingApi } from '@/api/setting'

interface PermissionItem {
  tab: string
  label: string
  enabled: boolean
  emailsText: string
}

const defaultPermissions: PermissionItem[] = [
  { tab: 'experts', label: '专家管理', enabled: true, emailsText: '' },
  { tab: 'projects', label: '项目管理', enabled: true, emailsText: '' },
  { tab: 'categories', label: '领域分类', enabled: true, emailsText: '' },
  { tab: 'ratings', label: '评分管理', enabled: true, emailsText: '' },
  { tab: 'users', label: '用户管理', enabled: false, emailsText: '' },
  { tab: 'settings', label: '系统设置', enabled: false, emailsText: '' },
]

const permissions = ref<PermissionItem[]>(defaultPermissions.map(item => ({ ...item })))
const saving = ref(false)
const message = ref('')

async function loadPermissions() {
  const raw = await settingApi.get('permissions')
  if (!raw) return
  const saved = JSON.parse(raw) as Record<string, { enabled?: boolean; emails?: string[] }>
  permissions.value = defaultPermissions.map(item => ({
    ...item,
    enabled: saved[item.tab]?.enabled ?? item.enabled,
    emailsText: (saved[item.tab]?.emails || []).join('\n'),
  }))
}

async function savePermissions() {
  saving.value = true
  try {
    const payload = permissions.value.reduce<Record<string, { enabled: boolean; emails: string[] }>>((acc, item) => {
      acc[item.tab] = {
        enabled: item.enabled,
        emails: item.emailsText.split('\n').map(email => email.trim()).filter(Boolean),
      }
      return acc
    }, {})
    await settingApi.save('permissions', JSON.stringify(payload))
    message.value = '权限设置已保存'
  } finally {
    saving.value = false
  }
}

onMounted(loadPermissions)
</script>

<style scoped>
.admin-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.hint { color: #6b7280; }
.permission-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.permission-card { padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
.permission-card textarea { width: 100%; box-sizing: border-box; margin-top: 8px; padding: 8px; }
.inline { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.btn { padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; }
.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.message { color: #059669; }
</style>
