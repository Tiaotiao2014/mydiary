import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 界面状态（目前只有主题）
 *
 * 为什么需要独立的 store：
 * 主题状态原本只存在于 App.vue 组件内部，设置页改主题时只能把值写进配置文件，
 * 却改不到界面上正在用的状态 —— 结果是「点了深色没反应，重启才生效」。
 * 抽成 store 后，App.vue（顶栏按钮）与设置页共享同一份状态，改完立即生效。
 */
export const useUiStore = defineStore('ui', () => {
  const isDark = ref(false)
  let mediaListener = null
  let mediaQuery = null

  /** 只改界面，不落盘 */
  function applyTheme(theme) {
    if (theme === 'system') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      isDark.value = mediaQuery.matches
      if (mediaListener) mediaQuery.removeEventListener('change', mediaListener)
      mediaListener = e => { isDark.value = e.matches }
      mediaQuery.addEventListener('change', mediaListener)
    } else {
      if (mediaQuery && mediaListener) {
        mediaQuery.removeEventListener('change', mediaListener)
        mediaListener = null
      }
      isDark.value = theme === 'dark'
    }
  }

  /** 启动时从配置读取主题并应用 */
  async function loadTheme() {
    if (!window.electronAPI) return
    const config = await window.electronAPI.getConfig()
    applyTheme(config?.theme || 'light')
  }

  /** 切换并持久化 */
  async function setTheme(theme) {
    applyTheme(theme)
    if (window.electronAPI) {
      // 注意：set-config 是「整体覆盖」写入。
      // 这里必须先读出旧配置再合并，否则只传 { theme } 会把主密码等其它设置一起抹掉。
      const old = (await window.electronAPI.getConfig()) || {}
      await window.electronAPI.setConfig({ ...old, theme })
    }
  }

  function toggleTheme() {
    return setTheme(isDark.value ? 'light' : 'dark')
  }

  return { isDark, loadTheme, applyTheme, setTheme, toggleTheme }
})
