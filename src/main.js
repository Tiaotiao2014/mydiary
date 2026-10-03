import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import HomeView from './views/HomeView.vue'
import EditorView from './views/EditorView.vue'
import LockView from './views/LockView.vue'
import SettingsView from './views/SettingsView.vue'
import TrashView from './views/TrashView.vue'
import { useSecurityStore } from './stores/security'

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/edit/:id', name: 'editor', component: EditorView },
  { path: '/lock', name: 'lock', component: LockView },
  { path: '/settings', name: 'settings', component: SettingsView },
  { path: '/trash', name: 'trash', component: TrashView },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// ── 启动门禁 ────────────────────────────────────────────────
// 设置了主密码后，未解锁前一律先跳到解锁页（这是一次性的会话内校验，
// 应用退出后内存中的密钥即失效，下次启动需重新输入）。
router.beforeEach(async (to) => {
  const security = useSecurityStore()
  if (!security.configLoaded) {
    try { await security.loadConfig() } catch { /* 读不到配置就放行，避免把用户锁在门外 */ }
  }
  if (!security.hasMasterPassword) return true
  if (security.isUnlocked) return true
  if (to.path === '/lock') return true
  return { path: '/lock', query: { next: to.fullPath } }
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
