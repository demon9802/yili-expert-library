<template>
  <Teleport to="body">
    <div v-if="contact" class="cas-overlay" @click.self="close">
      <div class="cas-sheet" :class="{ 'cas-mobile': mobile }">
        <div class="cas-head">
          <span class="cas-ico">{{ icon }}</span>
          <div class="cas-meta">
            <div class="cas-label">{{ typeLabel }}</div>
            <div class="cas-val">{{ displayValue }}</div>
          </div>
        </div>
        <div class="cas-btns">
          <button class="cas-btn cas-copy" @click="copy">
            📋 {{ copied ? '已复制 ✓' : '复制' }}
          </button>
          <button v-if="showDial" class="cas-btn cas-dial" @click="dial">📞 拨打电话</button>
        </div>
        <button class="cas-cancel" @click="close">取消</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ContactInfo } from '@/types'
import {
  resolveContactType,
  contactTypeLabel,
  contactTypeIcon,
  formatPhoneDisplay,
  normalizePhone,
  copyText,
  isMobile
} from '@/utils/helpers'

const props = defineProps<{ contact: ContactInfo | null }>()
const emit = defineEmits<{ close: [] }>()

const copied = ref(false)
const mobile = ref(isMobile())

watch(() => props.contact, () => {
  copied.value = false
  mobile.value = isMobile()
})

const type = computed(() => (props.contact ? resolveContactType(props.contact) : 'other'))
const isPhone = computed(() => type.value === 'phone' || type.value === 'mobile')
// 手机端电话/座机提供「复制 + 拨打」；PC 端只提供「复制」（不调用应用）
const showDial = computed(() => isPhone.value && mobile.value)
const icon = computed(() => (props.contact ? contactTypeIcon(props.contact) : ''))
const typeLabel = computed(() => contactTypeLabel(type.value))
const displayValue = computed(() => {
  const c = props.contact
  if (!c) return ''
  const info = c.info || c.value || ''
  if (isPhone.value) return formatPhoneDisplay(info)
  return info
})

async function copy() {
  const c = props.contact
  if (!c) return
  const info = c.info || c.value || ''
  if (!info) return
  try {
    await copyText(info)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* ignore */
  }
}

function dial() {
  const c = props.contact
  if (!c) return
  const info = c.info || c.value || ''
  if (!info) return
  window.location.href = 'tel:' + normalizePhone(info)
}

function close() {
  emit('close')
}
</script>

<style scoped>
.cas-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.cas-sheet {
  background: #fff;
  width: 100%;
  max-width: 420px;
  border-radius: 14px 14px 0 0;
  padding: 16px;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18);
  animation: cas-up 0.2s ease;
}
/* PC 端居中显示，而非贴底 */
.cas-sheet:not(.cas-mobile) {
  position: fixed;
  bottom: auto;
  top: 50%;
  transform: translateY(-50%);
  border-radius: 14px;
}
@keyframes cas-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.cas-mobile {
  animation: cas-up 0.2s ease;
}
.cas-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 12px;
}
.cas-ico { font-size: 22px; }
.cas-meta { min-width: 0; }
.cas-label { font-size: 12px; color: #64748b; }
.cas-val {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  word-break: break-all;
}
.cas-btns { display: flex; gap: 10px; }
.cas-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  background: #f1f5f9;
  color: #334155;
}
.cas-btn.cas-copy { background: #eef2ff; color: #4f46e5; }
.cas-btn.cas-dial { background: #ecfdf5; color: #059669; }
.cas-btn:active { transform: scale(0.98); }
.cas-cancel {
  width: 100%;
  margin-top: 10px;
  padding: 10px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 14px;
  cursor: pointer;
}
</style>
