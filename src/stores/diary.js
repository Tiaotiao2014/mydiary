import { defineStore } from 'pinia'
import { ref } from 'vue'

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// ── 浏览器 fallback：模块级内存持久化 ─────────────────────
// iab 中 localStorage 可能不可用，用模块级变量兜底
const browserDB = { diaries: [], trash: [] }
const LS_KEY = 'mydiary-browser-data'

function browserLoad() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        browserDB.diaries = data.diaries || []
        browserDB.trash = data.trash || []
        return
      }
    }
  } catch { /* ignore */ }
}

function browserSave() {
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
      browserLoad()
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
      const saved = await window.electronAPI.createDiary(diary)
      if (saved) {
        diaries.value = [saved, ...diaries.value]
        currentDiary.value = saved
        return saved
      }
    }
    // 浏览器环境
    browserDB.diaries.unshift(diary)
    diaries.value = browserDB.diaries
    trash.value = browserDB.trash
    currentDiary.value = diary
    browserSave()
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
      await window.electronAPI.saveDiary({ date: diary.date, id: diary.id, data: diary })
    }
    diary.updatedAt = new Date().toISOString()
    const idx = browserDB.diaries.findIndex(d => d.id === diary.id)
    if (idx !== -1) browserDB.diaries[idx] = { ...diary }
    diaries.value = browserDB.diaries
    trash.value = browserDB.trash
    if (currentDiary.value?.id === diary.id) {
      currentDiary.value = { ...diary }
    }
    if (!isElectron()) browserSave()
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
      browserSave()
    }
    if (currentDiary.value?.id === id) currentDiary.value = null
  }

  async function fetchTrash() {
    if (isElectron()) {
      trash.value = await window.electronAPI.listTrash()
    } else {
      browserLoad()
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
      browserSave()
    }
  }

  async function permanentDeleteTrash(date, id) {
    if (isElectron()) {
      await window.electronAPI.permanentDeleteTrash({ date, id })
    } else {
      browserDB.trash = browserDB.trash.filter(d => !(d.date === date && d.id === id))
      trash.value = browserDB.trash
      browserSave()
    }
  }

  async function emptyTrash() {
    if (isElectron()) {
      await window.electronAPI.emptyTrash()
    } else {
      browserDB.trash = []
      trash.value = []
      browserSave()
    }
  }

  return {
    diaries, trash, currentDiary, libraryPath, loading,
    initLibrary, fetchDiaries, createDiary, loadDiary, saveDiary,
    deleteDiary, fetchTrash, restoreDiary, permanentDeleteTrash, emptyTrash,
  }
})
