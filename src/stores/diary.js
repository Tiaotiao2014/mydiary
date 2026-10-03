import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSecurityStore } from './security'

/**
 * 送往 IPC 之前，必须把 Vue 响应式对象（Proxy）转成纯数据。
 *
 * 原因：contextBridge 暴露的 API 在参数跨出主世界时就要做克隆，
 * 而 Proxy 无法被克隆，会抛 "An object could not be cloned."。
 * 该错误若无人 catch，会变成未处理的 Promise 异常，
 * 导致调用链静默中断（典型症状：按钮点了没反应；保存看着成功其实没写盘）。
 *
 * 注意：不能放在 preload 里处理 —— 参数在进入 preload 前就已跨过边界。
 */
function toPlain(value) {
  if (value === null || typeof value !== 'object') return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// ── 浏览器 fallback 持久化 ────────────────────────────────
// 数据优先级：window.__MYDIARY_DATA__（index.html 注入）> localStorage > 模块内存
const LS_KEY = 'mydiary-browser-data'

function initBrowserDB() {
  let diaries = []
  let trash = []
  // 1. 从 index.html 注入的全局变量读取（刷新前保存的数据）
  if (typeof window !== 'undefined' && window.__MYDIARY_DATA__) {
    const d = window.__MYDIARY_DATA__
    diaries = d.diaries || []
    trash = d.trash || []
  } else {
    // 2. 从 localStorage 读取
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const raw = localStorage.getItem(LS_KEY)
        if (raw) {
          const d = JSON.parse(raw)
          diaries = d.diaries || []
          trash = d.trash || []
        }
      }
    } catch { /* ignore */ }
  }
  return { diaries, trash }
}

// 模块级单例（同一页面生命周期内共享）
const _initial = initBrowserDB()
const browserDB = {
  diaries: _initial.diaries,
  trash: _initial.trash,
}

function persistBrowserData() {
  // 保存回 index.html 的全局变量（刷新后恢复用）
  if (typeof window !== 'undefined') {
    try { window.__MYDIARY_DATA__ = { diaries: browserDB.diaries, trash: browserDB.trash } } catch { /* ignore */ }
  }
  // 保存到 localStorage（如果可用）
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      localStorage.setItem(LS_KEY, JSON.stringify(browserDB))
    }
  } catch { /* quota or unavailable */ }
}

// ── Store ──────────────────────────────────────────────────
export const useDiaryStore = defineStore('diary', () => {
  const diaries = ref([])
  const trash = ref([])
  const currentDiary = ref(null)
  const libraryPath = ref(null)
  const loading = ref(false)

  function isElectron() {
    return typeof window !== 'undefined' && !!window.electronAPI
  }

  async function initLibrary() {
    if (isElectron()) {
      libraryPath.value = await window.electronAPI.getLibraryPath()
    } else {
      diaries.value = browserDB.diaries
      trash.value = browserDB.trash
    }
  }

  /**
   * 把磁盘上的原始日记整理成界面可用的形态。
   * 加密日记：已解锁则解密出标题/标签/正文；未解锁则打上 locked 标记，
   * 界面据此显示锁图标而**不显示任何明文内容**。
   */
  async function resolveDiary(d) {
    if (!d || !d.encrypted) return d
    const security = useSecurityStore()
    if (!security.isUnlocked) return { ...d, locked: true, title: '', tags: [] }
    try {
      const payload = await security.decrypt(d.encryptedContent)
      return { ...d, title: payload.title || '', tags: payload.tags || [], content: payload.content || null, locked: false }
    } catch {
      // 密钥不对或数据损坏：同样按"锁定"处理，不展示任何内容
      return { ...d, locked: true, title: '', tags: [], decryptFailed: true }
    }
  }

  async function fetchDiaries() {
    loading.value = true
    try {
      const raw = isElectron()
        ? await window.electronAPI.listDiaries()
        : browserDB.diaries
      diaries.value = await Promise.all(raw.map(resolveDiary))
    } finally {
      loading.value = false
    }
  }

  /** 处于加密状态的日记篇数（移除主密码前要先确认这个为 0） */
  function countEncrypted() {
    return diaries.value.filter(d => d.encrypted).length
  }

  async function createDiary(data = {}) {
    const now = new Date().toISOString()
    const dateStr = data.date || now.slice(0, 10)
    const diary = {
      id: generateId(),
      date: dateStr,
      title: data.title || '',
      tags: data.tags || [],
      content: data.content || { type: 'doc', content: [{ type: 'paragraph' }] },
      createdAt: now,
      updatedAt: now,
      encrypted: false,
      encryptedContent: null,
    }

    if (isElectron()) {
      const saved = await window.electronAPI.createDiary(toPlain(diary))
      if (saved) {
        diaries.value = [saved, ...diaries.value]
        currentDiary.value = saved
        return saved
      }
    }
    browserDB.diaries.unshift(diary)
    diaries.value = browserDB.diaries
    trash.value = browserDB.trash
    currentDiary.value = diary
    persistBrowserData()
    return diary
  }

  async function loadDiary(date, id) {
    let raw = null
    if (isElectron()) {
      raw = await window.electronAPI.getDiary({ date, id })
    } else {
      raw = browserDB.diaries.find(d => d.id === id) || null
    }
    currentDiary.value = raw
    return raw ? await resolveDiary(raw) : null
  }

  async function saveDiary(diary) {
    if (!diary) return
    const security = useSecurityStore()

    // 落盘用的对象：先剔除纯界面标记，再按是否加密决定写什么
    const diskData = { ...diary }
    delete diskData.locked
    delete diskData.decryptFailed

    if (diskData.encrypted) {
      if (!security.isUnlocked) throw new Error('尚未解锁，无法保存加密日记')
      // 标题、标签、正文一并加密 —— 标题往往比正文更敏感，不能留在明文里
      diskData.encryptedContent = await security.encrypt({
        title: diary.title || '',
        tags: diary.tags || [],
        content: diary.content || null,
      })
      diskData.title = ''
      diskData.tags = []
      diskData.content = null
    } else {
      diskData.encryptedContent = null
    }

    if (isElectron()) {
      await window.electronAPI.saveDiary(toPlain({ date: diskData.date, id: diskData.id, data: diskData }))
    }

    diary.updatedAt = new Date().toISOString()
    const idx = browserDB.diaries.findIndex(d => d.id === diary.id)
    if (idx !== -1) browserDB.diaries[idx] = { ...diary }
    diaries.value = browserDB.diaries
    trash.value = browserDB.trash
    if (currentDiary.value?.id === diary.id) {
      currentDiary.value = { ...diary }
    }
    if (!isElectron()) persistBrowserData()
  }

  async function deleteDiary(date, id) {
    if (isElectron()) {
      await window.electronAPI.deleteDiary({ date, id })
    } else {
      const removed = browserDB.diaries.filter(d => d.date === date && d.id === id)
      if (removed.length > 0) {
        removed[0].deletedAt = new Date().toISOString()
        browserDB.trash.push(...removed)
      }
      browserDB.diaries = browserDB.diaries.filter(d => !(d.date === date && d.id === id))
      diaries.value = browserDB.diaries
      trash.value = browserDB.trash
      persistBrowserData()
    }
    if (currentDiary.value?.id === id) currentDiary.value = null
  }

  async function fetchTrash() {
    if (isElectron()) {
      const raw = await window.electronAPI.listTrash()
      // 回收站里也可能有加密日记，同样按解锁状态决定是否解出标题
      trash.value = await Promise.all(raw.map(resolveDiary))
    } else {
      trash.value = browserDB.trash
      diaries.value = browserDB.diaries
    }
  }

  async function restoreDiary(date, id) {
    if (isElectron()) {
      await window.electronAPI.restoreDiary({ date, id })
      trash.value = trash.value.filter(d => !(d.date === date && d.id === id))
      await fetchDiaries()
      return
    }
    const item = browserDB.trash.find(d => d.date === date && d.id === id)
    if (item) {
      delete item.deletedAt
      browserDB.trash = browserDB.trash.filter(d => !(d.date === date && d.id === id))
      browserDB.diaries.unshift(item)
      trash.value = browserDB.trash
      diaries.value = browserDB.diaries
      persistBrowserData()
    }
  }

  async function permanentDeleteTrash(date, id) {
    if (isElectron()) {
      await window.electronAPI.permanentDeleteTrash({ date, id })
    } else {
      browserDB.trash = browserDB.trash.filter(d => !(d.date === date && d.id === id))
      trash.value = browserDB.trash
      persistBrowserData()
    }
  }

  async function emptyTrash() {
    if (isElectron()) {
      await window.electronAPI.emptyTrash()
    } else {
      browserDB.trash = []
      trash.value = []
      persistBrowserData()
    }
  }

  return {
    diaries, trash, currentDiary, libraryPath, loading,
    initLibrary, fetchDiaries, createDiary, loadDiary, saveDiary,
    deleteDiary, fetchTrash, restoreDiary, permanentDeleteTrash, emptyTrash,
    resolveDiary, countEncrypted,
  }
})
