import { defineStore } from 'pinia'
import { ref } from 'vue'

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

  async function fetchDiaries() {
    loading.value = true
    try {
      if (isElectron()) {
        diaries.value = await window.electronAPI.listDiaries()
      } else {
        diaries.value = browserDB.diaries
      }
    } finally {
      loading.value = false
    }
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
    if (isElectron()) {
      currentDiary.value = await window.electronAPI.getDiary({ date, id })
      return currentDiary.value
    }
    const found = browserDB.diaries.find(d => d.id === id)
    if (found) currentDiary.value = found
    return found || null
  }

  async function saveDiary(diary) {
    if (!diary) return
    if (isElectron()) {
      await window.electronAPI.saveDiary(toPlain({ date: diary.date, id: diary.id, data: diary }))
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
      trash.value = await window.electronAPI.listTrash()
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
  }
})
