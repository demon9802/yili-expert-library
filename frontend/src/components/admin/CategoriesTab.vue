<template>
  <div class="admin-tab categories-tab">
    <div class="tab-header">
      <h2>分类管理</h2>
      <p class="tab-desc">管理"适用领域"标签的名称与颜色。改名会同步到所有相关专家，删除会清理专家身上的引用。</p>
    </div>

    <div class="fields-list">
      <div v-for="field in store.fields" :key="field.id ?? field.name" class="field-row">
        <input
          class="field-name-input"
          :value="field.name"
          @change="onRename(field, ($event.target as HTMLInputElement).value)"
        />
        <input
          class="field-color-input"
          type="color"
          :value="field.color"
          @change="onColorChange(field, ($event.target as HTMLInputElement).value)"
        />
        <span class="field-preview" :style="{ background: field.color, color: field.textColor || '#fff' }">
          {{ field.name }}
        </span>
        <div class="actions">
          <button class="btn-link danger" @click="onDelete(field)">删除</button>
        </div>
      </div>
    </div>

    <div class="add-row">
      <input v-model="newName" class="field-name-input" placeholder="标签名称" />
      <input v-model="newColor" class="field-color-input" type="color" />
      <button class="btn btn-primary" :disabled="!canAdd" @click="onAdd">添加</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/appStore'
import type { Field } from '@/types'

const store = useAppStore()
const newName = ref('')
const newColor = ref('#2563EB')

const canAdd = computed(
  () => newName.value.trim().length > 0 && !store.fields.some(f => f.name === newName.value.trim())
)

function onRename(field: Field, raw: string) {
  const name = raw.trim()
  if (!name || name === field.name) return
  if (store.fields.some(f => f.name === name)) {
    window.alert('标签名称已存在')
    return
  }
  store.saveField({ ...field, name, _oldName: field.name })
}

function onColorChange(field: Field, color: string) {
  store.saveField({ ...field, color })
}

function onDelete(field: Field) {
  const affected = store.experts.filter(e => (e.fields || []).includes(field.name))
  if (affected.length > 0) {
    const preview = affected.slice(0, 5).map(e => e.name).join('、')
    const msg = `有 ${affected.length} 位专家使用此标签（${preview}${affected.length > 5 ? ' 等' : ''}），删除后将同步清理这些专家的引用，确认删除？`
    if (!window.confirm(msg)) return
  }
  store.deleteField(field.name)
}

async function onAdd() {
  if (!canAdd.value) return
  await store.saveField({
    name: newName.value.trim(),
    color: newColor.value,
    textColor: '#ffffff',
    hideWhenEmpty: false,
    sortOrder: store.fields.length,
  })
  newName.value = ''
}
</script>

<style scoped>
.tab-header { margin-bottom: 16px; }
.tab-header h2 { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
.tab-desc { font-size: 13px; color: var(--text-secondary); margin: 0; }

.fields-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  flex-wrap: wrap;
}
.field-name-input {
  flex: 1;
  min-width: 160px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
}
.field-name-input:focus { outline: none; border-color: var(--primary); }
.field-color-input {
  width: 40px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  cursor: pointer;
}
.field-preview {
  padding: 4px 14px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}
.actions { margin-left: auto; }
.btn-link {
  background: none;
  border: none;
  color: var(--primary);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}
.btn-link.danger { color: #dc2626; }

.add-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--bg);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
}
.btn {
  padding: 7px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.btn-primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
