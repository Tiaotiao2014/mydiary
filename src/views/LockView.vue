<template>
  <div class="lock-view">
    <div class="lock-card">
      <div class="lock-icon">🔒</div>
      <h2>主密码</h2>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-else class="hint">输入主密码以打开加密的日记</p>

      <form @submit.prevent="unlock">
        <input
          ref="passwordInput"
          v-model="password"
          type="password"
          class="password-input"
          placeholder="请输入主密码..."
          autocomplete="current-password"
        />
        <button type="submit" class="btn btn-primary btn-block" :disabled="busy">
          {{ busy ? '校验中…' : '解锁' }}
        </button>
      </form>

      <div v-if="canReset" class="reset-zone">
        <div class="divider"></div>
        <p class="reset-hint">
          忘记密码了？当前没有已加密的日记，可以重置主密码（不会丢失任何日记）。
        </p>
        <button class="btn btn-ghost" :disabled="busy" @click="resetPassword">重置主密码</button>
      </div>
      <p v-else-if="encryptedCount > 0" class="reset-hint">
        库中还有 {{ encryptedCount }} 篇加密日记。忘记密码将无法再打开它们，密码无法找回。
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSecurityStore } from '@/stores/security'
import { useDiaryStore } from '@/stores/diary'

const router = useRouter()
const route = useRoute()
const security = useSecurityStore()
const diaryStore = useDiaryStore()

const password = ref('')
const passwordInput = ref(null)
const busy = ref(false)
const error = ref('')

const encryptedCount = computed(() => diaryStore.countEncrypted())
// 只有当库中不存在加密日记时，才允许"忘记密码"重置
const canReset = computed(() => encryptedCount.value === 0)

onMounted(async () => {
  await security.loadConfig()
  // 没有设置主密码就没有要解锁的东西
  if (!security.hasMasterPassword) {
    router.replace('/')
    return
  }
  // 需要篇数来判断能否重置
  try { await diaryStore.fetchDiaries() } catch { /* 忽略 */ }
  nextTick(() => passwordInput.value?.focus())
})

async function unlock() {
  if (!password.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const okPwd = await security.unlock(password.value)
    if (!okPwd) {
      error.value = '密码不正确，请重试'
      password.value = ''
      return
    }
    // 解锁成功后，加密日记的标题等内容才能被解出来
    await diaryStore.fetchDiaries()
    const next = typeof route.query.next === 'string' ? route.query.next : '/'
    router.replace(next)
  } catch (e) {
    error.value = '解锁失败：' + (e?.message || e)
  } finally {
    busy.value = false
  }
}

async function resetPassword() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await security.removeMasterPassword(encryptedCount.value)
    router.replace('/')
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    busy.value = false
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

.reset-zone { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.divider { height: 1px; background: var(--border); margin: 4px 0; }
.reset-hint { font-size: 12px; opacity: 0.6; line-height: 1.6; color: var(--fg); }
</style>
