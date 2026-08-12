<template>
  <section class="admin-tab settings-tab">
    <div class="admin-toolbar">
      <h3>系统设置</h3>
      <button class="btn primary" :disabled="saving" @click="saveSettings">保存设置</button>
    </div>

    <label>应用标题<input v-model.trim="settings.appTitle" /></label>
    <label>应用描述<textarea v-model="settings.description" rows="4" /></label>
    <p v-if="message" class="message">{{ message }}</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { settingApi } from '@/api/setting'

const settings = reactive({
  appTitle: '伊利专家资源库',
  description: '',
})
const saving = ref(false)
const message = ref('')

async function loadSettings() {
  const [appTitle, description] = await Promise.all([
    settingApi.get('appTitle'),
    settingApi.get('description'),
  ])
  settings.appTitle = appTitle || settings.appTitle
  settings.description = description || ''
}

async function saveSettings() {
  saving.value = true
  try {
    await Promise.all([
      settingApi.save('appTitle', settings.appTitle),
      settingApi.save('description', settings.description),
    ])
    message.value = '系统设置已保存'
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<style scoped>
.admin-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.settings-tab label { display: block; margin-bottom: 14px; }
.settings-tab input, .settings-tab textarea { width: 100%; box-sizing: border-box; margin-top: 6px; padding: 8px; }
.btn { padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; }
.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.message { color: #059669; }
</style>
