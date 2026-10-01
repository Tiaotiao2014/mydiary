<template>
  <div class="lock-view">
    <div class="lock-card">
      <div class="lock-icon">🔒</div>
      <h2>主密码</h2>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-else class="hint">输入主密码解锁全部日记</p>

      <form @submit.prevent="unlock">
        <input
          ref="passwordInput"
          v-model="password"
          type="password"
          class="password-input"
          placeholder="请输入密码..."
          autofocus
        />
        <button type="submit" class="btn btn-primary btn-block" :disabled="unlocking">
          {{ unlocking ? '解密中...' : '解锁' }}
        </button>
      </form>

      <!-- 单篇解锁 -->
      <div v-if="diaryData" class="diary-lock">
        <div class="divider"></div>
        <p class="diary-hint">单篇密码解锁</p>
        <input
          v-model="diaryPassword"
          type="password"
          class="password-input"
          placeholder="单篇密码..."
        />
        <button
          class="btn btn-ghost"
          :disabled="diaryUnlocking"
          @click="unlockDiary"
        >
          {{ diaryUnlocking ? '解密中...' : '解锁这篇日记' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { decryptContent } from '@/services/crypto'

const router = useRouter()
const route = useRoute()

const password = ref('')
const passwordInput = ref(null)
const unlocking = ref(false)
const error = ref('')

// 单篇解锁
const diaryData = ref(null)
const diaryPassword = ref('')
const diaryUnlocking = ref(false)

onMounted(async () => {
  // 检查是否有待解锁的单篇日记
  const diaryParam = route.query.diary
  if (diaryParam) {
    diaryData.value = JSON.parse(decodeURIComponent(diaryParam))
  }
  nextTick(() => passwordInput.value?.focus())
})

async function unlock() {
  if (!password.value) return
  unlocking.value = true
  error.value = ''

  try {
    // 如果没有主密码设置，直接放行
    // 实际场景：检查 library config 是否有主密码标记
    const config = window.electronAPI ? await window.electronAPI.getConfig() : null
    if (!config?.masterPasswordSet) {
      // 未设主密码，直接进主页
      router.push('/')
      return
    }

    // 有主密码：用第一段已知加密内容验证（简化：直接放行，P4 完整版需存校验块）
    // 这里暂以成功解锁为准
    router.push('/')
  } catch (e) {
    error.value = '密码错误，请重试'
  } finally {
    unlocking.value = false
  }
}

async function unlockDiary() {
  if (!diaryPassword.value || !diaryData.value) return
  diaryUnlocking.value = true

  try {
    const plaintext = await decryptContent(diaryData.value, diaryPassword.value)
    const diary = JSON.parse(plaintext)
    router.push(`/edit/${diary.id}?date=${diary.date}&decrypted=${encodeURIComponent(JSON.stringify(diary))}`)
  } catch {
    diaryPassword.value = ''
    alert('单篇密码错误')
  } finally {
    diaryUnlocking.value = false
  }
}
</script>

<style scoped>
.lock-view {
  display: flex; align-items: center; justify-content: center;
  min-height: 60vh; padding: 40px 20px;
}
.lock-card {
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: 16px; padding: 40px; width: 100%; max-width: 380px;
  display: flex; flex-direction: column; gap: 16px; align-items: center;
  text-align: center;
}
.lock-icon { font-size: 48px; }
.lock-card h2 { color: var(--fg); font-size: 20px; }
.hint { color: var(--fg); opacity: 0.5; font-size: 13px; }
.error { color: #e74c3c; font-size: 13px; }

form { width: 100%; display: flex; flex-direction: column; gap: 12px; }
.password-input {
  width: 100%; padding: 10px 14px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--bg);
  color: var(--fg); font-size: 14px; outline: none;
}
.password-input:focus { border-color: var(--accent); }

.btn-block { width: 100%; }
.btn-ghost {
  background: transparent; color: var(--fg); border: 1px solid var(--border);
  border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 13px; width: 100%;
}
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

.diary-lock { width: 100%; display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.divider { height: 1px; background: var(--border); margin: 8px 0; }
.diary-hint { font-size: 12px; opacity: 0.6; }
</style>
