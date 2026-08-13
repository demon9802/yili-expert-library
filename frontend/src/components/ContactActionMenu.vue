<template>
  <Teleport to="body">
    <!-- 移动端：底部 sheet（复制 + 拨打） -->
    <div v-if="contact && mobile" class="cas-overlay" @click.self="close">
      <div class="cas-sheet cas-mobile">
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

    <!-- PC 端：点击位置附近的小浮窗，仅复制 -->
    <div
      v-if="contact && !mobile"
      class="cas-pc-popover"
      :style="pcStyle"
      @click.stop
    >
      <button class="cas-pc-copy" :class="{ copied }" @click="copy">
        📋 {{ copied ? '已复制' : '复制' }}
      </button>
      <span class="cas-pc-arrow"></span>
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

const props = defineProps<{
  contact: ContactInfo | null
  anchorX?: number
  anchorY?: number
}>()
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

// PC 端小浮窗定位到点击元素上方居中
const pcStyle = computed(() => {
  const x = props.anchorX ?? window.innerWidth / 2
  const y = props.anchorY ?? window.innerHeight / 2
  return {
    left: `${x}px`,
    top: `${y - 8}px`,
    transform: 'translate(-50%, -100%)'
  }
})

// PC 端点击页面其他区域自动关闭小浮窗
let clickAwayHandler: ((e: MouseEvent) => void) | null = null
watch(() => props.contact, (c) => {
  if (mobile.value || !c) return
  if (clickAwayHandler) {
    document.removeEventListener('click', clickAwayHandler)
    clickAwayHandler = null
  }
  if (c) {
    clickAwayHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.cas-pc-popover')) {
        close()
      }
    }
    // 下一事件循环再注册，避免当前点击立即触发关闭
    setTimeout(() => document.addEventListener('click', clickAwayHandler!), 0)
  }
}, { immediate: true })

async function copy() {
  const c = props.contact
  if (!c) return
  const info = c.info || c.value || ''
  if (!info) return
  try {
    await copyText(info)
    copied.value = true
    setTimeout(() => {
      copied.value = false
      close()
    }, 1200)
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

/* PC 端：点击位置附近的小浮窗复制按钮 */
.cas-pc-popover {
  position: fixed;
  z-index: 1000;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.12));
}
.cas-pc-copy {
  padding: 4px 10px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  color: #4f46e5;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.cas-pc-copy:hover {
  background: #eef2ff;
  border-color: #c7d2fe;
}
.cas-pc-copy.copied {
  color: #059669;
  border-color: #a7f3d0;
  background: #ecfdf5;
}
.cas-pc-arrow {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid #fff;
}
</style>
