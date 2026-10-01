<template>
  <div class="settings-page">
    <h2>设置</h2>

    <!-- 主密码 -->
    <section class="settings-section">
      <h3>主密码</h3>
      <p class="section-desc">设置后每次启动需输入密码解锁。忘记密码将导致全库不可读。</p>
      <div class="setting-row">
        <label>
          <input type="checkbox" v-model="hasMasterPassword" />
          启用主密码
        </label>
      </div>
      <div v-if="!hasMasterPassword" class="password-form">
        <input v-model="newPassword" type="password" placeholder="新密码（最少 6 位）" class="pw-input" />
        <input v-model="confirmPassword" type="password" placeholder="确认密码" class="pw-input" />
        <button
          class="btn btn-primary"
          :disabled="!canSetPassword"
          @click="setMasterPassword"
        >
          设置主密码
        </button>
      </div>

      <p v-if="passwordError" class="error">{{ passwordError }}</p>
      <p v-if="passwordSuccess" class="success">{{ passwordSuccess }}</p>
    </section>

    <!-- 主题 -->
    <section class="settings-section">
      <h3>外观</h3>
      <div class="theme-row">
        <button
          v-for="theme in ['light', 'dark', 'system']"
          :key="theme"
          :class="['theme-btn', { active: config?.theme === theme }]"
          @click="setTheme(theme)"
        >
          {{ theme === 'light' ? '☀️ 浅色' : theme === 'dark' ? '🌙 深色' : '🖥 跟随系统' }}
        </button>
      </div>
    </section>

    <!-- 回收站 -->
    <section class="settings-section">
      <h3>回收站</h3>
      <button class="btn btn-danger" @click="emptyTrash">清空回收站</button>
    </section>

    <button class="btn btn-ghost" @click="router.push('/')">← 返回</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDiaryStore } from '@/stores/diary'

const router = useRouter()
const store = useDiaryStore()

const hasMasterPassword = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordSuccess = ref('')
const config = ref(null)

onMounted(async () => {
  if (window.electronAPI) {
    config.value = await window.electronAPI.getConfig()
    hasMasterPassword.value = !!config.value?.masterPasswordSet
  }
})

const canSetPassword = computed(() => {
  return newPassword.value.length >= 6 && newPassword.value === confirmPassword.value
})

async function setMasterPassword() {
  passwordError.value = ''
  passwordSuccess.value = ''
  if (newPassword.value.length < 6) {
    passwordError.value = '密码至少 6 位'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = '两次密码不一致'
    return
  }
  // 写入 config
  if (window.electronAPI) {
    await window.electronAPI.setConfig({ ...config.value, masterPasswordSet: true, theme: config.value?.theme })
    hasMasterPassword.value = true
    passwordSuccess.value = '主密码已启用'
    newPassword.value = ''
    confirmPassword.value = ''
  }
}

async function setTheme(theme) {
  if (window.electronAPI) {
    await window.electronAPI.setConfig({ ...config.value, theme })
    config.value = { ...config.value, theme }
  }
}

async function emptyTrash() {
  if (confirm('确定清空回收站？30 天内的日记将被永久删除。')) {
    await store.emptyTrash()
  }
}

</script>

<style scoped>
.settings-page { display: flex; flex-direction: column; gap: 28px; }
.settings-page h2 { font-size: 22px; color: var(--fg); }
.settings-section {
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px;
}
.settings-section h3 { font-size: 15px; color: var(--accent); margin-bottom: 8px; }
.section-desc { font-size: 13px; opacity: 0.6; margin-bottom: 12px; }
.setting-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.setting-row label { font-size: 14px; display: flex; align-items: center; gap: 8px; }

.password-form { display: flex; flex-direction: column; gap: 8px; }
.pw-input {
  padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg); color: var(--fg); font-size: 14px; outline: none;
}
.pw-input:focus { border-color: var(--accent); }

.error { color: #e74c3c; font-size: 13px; }
.success { color: #27ae60; font-size: 13px; }

.theme-row { display: flex; gap: 8px; flex-wrap: wrap; }
.theme-btn {
  padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border);
  background: transparent; color: var(--fg); cursor: pointer; font-size: 13px;
}
.theme-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

.btn-danger {
  background: #e74c3c; color: #fff; border: none;
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
}
.btn-danger:hover { opacity: 0.85; }
.btn-ghost {
  background: transparent; border: 1px solid var(--border); color: var(--fg);
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
  align-self: flex-start;
}
</style>

