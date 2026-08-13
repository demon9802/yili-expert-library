<template>
  <section class="admin-tab sort-tab">
    <div class="admin-toolbar">
      <div>
        <h3>排序标签管理</h3>
        <p class="tab-desc">管理前端展示的排序选项，可新增、编辑或删除排序项。默认排序项不可删除。</p>
      </div>
      <button class="btn primary" :disabled="saving" @click="saveOrder">保存排序配置</button>
    </div>

    <div class="sort-options-list">
      <div v-for="(opt, idx) in options" :key="opt.id" class="sort-option-item">
        <span class="sort-option-index">{{ idx + 1 }}</span>
        <input v-model="opt.name" class="sort-option-input" placeholder="排序名称" />
        <input v-model="opt.id" class="sort-option-input" placeholder="排序ID（英文）" />
        <button
          v-if="!isDefault(opt.id)"
          class="btn btn-danger btn-sm"
          @click="removeOption(idx)"
        >删除</button>
      </div>
    </div>

    <div class="add-sort-option">
      <input v-model="newName" class="sort-option-input" placeholder="排序名称" />
      <input v-model="newId" class="sort-option-input" placeholder="排序ID（英文）" />
      <button class="btn primary btn-sm" :disabled="!canAdd" @click="addOption">添加排序项</button>
    </div>

    <p v-if="message" class="message" :class="messageType">{{ message }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAppStore } from '@/store/appStore'

const store = useAppStore()
const options = ref<{ id: string; name: string }[]>([])
const newName = ref('')
const newId = ref('')
const saving = ref(false)
const message = ref('')
const messageType = ref('success')

const defaultIds = ['default', 'overall', 'professional', 'influence']

watch(
  () => store.sortOptions,
  val => { options.value = val.map(o => ({ ...o })) },
  { immediate: true, deep: true }
)

const canAdd = computed(() => {
  const name = newName.value.trim()
  const id = newId.value.trim()
  return name && id && /^[a-zA-Z0-9_-]+$/.test(id) && !options.value.some(o => o.id === id)
})

function isDefault(id: string) {
  return defaultIds.includes(id)
}

function addOption() {
  if (!canAdd.value) return
  options.value.push({ id: newId.value.trim(), name: newName.value.trim() })
  newName.value = ''
  newId.value = ''
  message.value = ''
}

function removeOption(idx: number) {
  options.value.splice(idx, 1)
  message.value = ''
}

async function saveOrder() {
  saving.value = true
  message.value = ''
  try {
    // 确保默认四项至少存在
    const ids = options.value.map(o => o.id)
    const missing = defaultIds.filter(d => !ids.includes(d))
    if (missing.length) {
      message.value = '默认排序项（default/overall/professional/influence）不可删除'
      messageType.value = 'error'
      return
    }
    await store.saveSortOptions(options.value.map(o => ({ id: o.id, name: o.name })))
    message.value = '排序配置已保存'
    messageType.value = 'success'
  } catch (err: any) {
    message.value = '保存失败：' + (err?.message || String(err))
    messageType.value = 'error'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.sort-tab .admin-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 16px;
}
.sort-tab h3 { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
.tab-desc { font-size: 13px; color: var(--text-secondary); margin: 0; }

.sort-options-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}
.sort-option-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.sort-option-index {
  font-weight: 700;
  color: var(--text-secondary);
  min-width: 24px;
}
.sort-option-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.sort-option-input:focus { outline: none; border-color: var(--primary); }

.add-sort-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--bg);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
}

.btn {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-sm { padding: 5px 12px; font-size: 12px; }
.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.btn-danger { background: #fef2f2; color: #dc2626; border-color: #fecaca; }

.message {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
}
.message.success { background: #f0fdf4; color: #059669; border: 1px solid #bbf7d0; }
.message.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
</style>
