<template>
  <section class="admin-tab">
    <div class="admin-toolbar">
      <h3>专家排序</h3>
      <button class="btn primary" :disabled="saving" @click="saveOrder">保存排序</button>
    </div>

    <ol class="sort-list">
      <li v-for="(expert, index) in orderedExperts" :key="expert.id" class="sort-item">
        <span>{{ index + 1 }}. {{ expert.name }}</span>
        <div>
          <button class="btn" :disabled="index === 0" @click="move(index, -1)">上移</button>
          <button class="btn" :disabled="index === orderedExperts.length - 1" @click="move(index, 1)">下移</button>
        </div>
      </li>
    </ol>
    <p v-if="message" class="message">{{ message }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { expertApi } from '@/api/expert'
import { useAppStore } from '@/store/appStore'
import type { Expert } from '@/types'

const store = useAppStore()
const orderedExperts = ref<Expert[]>([])
const saving = ref(false)
const message = ref('')

watch(
  () => store.experts,
  experts => {
    orderedExperts.value = [...experts]
  },
  { immediate: true, deep: true }
)

function move(index: number, offset: number) {
  const nextIndex = index + offset
  const list = [...orderedExperts.value]
  const [item] = list.splice(index, 1)
  list.splice(nextIndex, 0, item)
  orderedExperts.value = list
  message.value = ''
}

async function saveOrder() {
  saving.value = true
  try {
    const updatedExperts = await Promise.all(
      orderedExperts.value.map((expert, index) =>
        expertApi.update(expert.id, { sortOrder: index + 1 } as Partial<Expert>)
      )
    )
    updatedExperts.forEach(updated => {
      const storeIndex = store.experts.findIndex(expert => expert.id === updated.id)
      if (storeIndex >= 0) store.experts[storeIndex] = updated
    })
    message.value = '排序已保存'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.admin-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.sort-list { padding: 0; list-style: none; }
.sort-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; background: #fff; }
.btn { margin-left: 8px; padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; }
.btn:disabled { cursor: not-allowed; opacity: .5; }
.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.message { color: #059669; }
</style>
