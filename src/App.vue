<template>
  <div :class="['app-root', { 'dark-mode': isDark }]">
    <div class="topbar">
      <span class="app-title">MyDiary</span>
      <button class="btn btn-primary" @click="newDiary">＋ 新建</button>
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
    if (config && config.theme === 'dark') isDark.value = true
    else if (config && config.theme === 'system') {
      const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
      isDark.value = darkQuery.matches
      darkQuery.addEventListener('change', (e) => { isDark.value = e.matches })
    }
  }
})

function newDiary() {
  // MVP: 简单跳转到编辑页（后续接编辑器）
  router.push('/')
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
.app-root { min-height: 100vh; }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px; border-bottom: 1px solid var(--border);
  position: sticky; top: 0; background: var(--bg); z-index: 10;
}
.app-title { font-size: 18px; font-weight: 700; color: var(--accent); }
.content { max-width: 900px; margin: 0 auto; padding: 24px; }
.btn {
  padding: 8px 16px; border-radius: 8px; cursor: pointer;
  font-size: 14px; border: none;
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { opacity: 0.85; }
</style>
