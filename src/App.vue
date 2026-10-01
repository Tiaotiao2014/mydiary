<template>
  <div :class="['app-root', { 'dark-mode': isDark }]">
    <div class="topbar">
      <span class="app-title" @click="router.push('/')">MyDiary</span>
      <div class="topbar-actions">
        <button class="btn btn-ghost-top" @click="toggleTheme">
          {{ isDark ? '☀️' : '🌙' }}
        </button>
        <button class="btn btn-primary" @click="router.push('/edit/new')">＋ 新建</button>
      </div>
    </div>
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isDark = ref(false)

onMounted(async () => {
  if (window.electronAPI) {
    const config = await window.electronAPI.getConfig()
    if (config?.theme === 'dark') isDark.value = true
    else if (config?.theme === 'system') {
      const q = window.matchMedia('(prefers-color-scheme: dark)')
      isDark.value = q.matches
      q.addEventListener('change', (e) => { isDark.value = e.matches })
    }
  }
})

function toggleTheme() {
  isDark.value = !isDark.value
}
</script>

<style>
:root {
  --bg: #ffffff;
  --fg: #1a1a2e;
  --accent: #4a6cf7;
  --card-bg: #f4f6fa;
  --border: #e0e4ec;
}
.dark-mode {
  --bg: #0f0f1a;
  --fg: #e8e8f0;
  --accent: #6c8cff;
  --card-bg: #1a1a2e;
  --border: #2a2a40;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--fg);
}
.app-root { min-height: 100vh; background: var(--bg); color: var(--fg); }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px; border-bottom: 1px solid var(--border);
  position: sticky; top: 0; background: var(--bg); z-index: 10;
}
.app-title { font-size: 18px; font-weight: 700; color: var(--accent); cursor: pointer; }
.topbar-actions { display: flex; gap: 8px; align-items: center; }
.content { max-width: 900px; margin: 0 auto; padding: 24px; }
.btn-primary {
  background: var(--accent); color: #fff;
  padding: 8px 16px; border-radius: 8px; border: none;
  cursor: pointer; font-size: 14px; font-weight: 500;
}
.btn-primary:hover { opacity: 0.85; }
.btn-ghost-top {
  background: transparent; color: var(--fg); opacity: 0.6;
  border: 1px solid var(--border); border-radius: 8px;
  padding: 6px 12px; cursor: pointer; font-size: 14px;
}
.btn-ghost-top:hover { opacity: 1; }
</style>
