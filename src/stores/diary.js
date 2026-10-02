import { defineStore } from 'pinia'
import { ref } from 'vue'

// 生成简单 UUID（浏览器 fallback 用）
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export const useDiaryStore = defineStore('diary', () => {
  const diaries = ref([])
  const trash = ref([])
  const currentDiary = ref(null)
  const libraryPath = ref(null)
  const loading = ref(false)

  const isElectron = () => !!window.electronAPI

  async function initLibrary() {
    if (isElectron()) {
      libraryPath.value = await window.electronAPI.getLibraryPath()
    }
  }

  async function fetchDiaries() {
    loading.value = true
    try {
      if (isElectron()) {
        diaries.value = await window.electronAPI.listDiaries()
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
        diaries.value.unshift(saved)
        return saved
      }
    }
    // browser fallback：只存内存，不写文件
    diaries.value.unshift(diary)
    currentDiary.value = diary
    return diary
  }

  async function loadDiary(date, id) {
    if (isElectron()) {
      currentDiary.value = await window.electronAPI.getDiary({ date, id })
      return currentDiary.value
    }
    // browser fallback：从内存里找
    const found = diaries.value.find(d => d.id === id)
    if (found) currentDiary.value = found
    return found || null
  }

  async function saveDiary(diary) {
    if (!diary) return
    if (isElectron()) {
      await window.electronAPI.saveDiary({ date: diary.date, id: diary.id, data: diary })
    }
    diary.updatedAt = new Date().toISOString()
    const idx = diaries.value.findIndex(d => d.id === diary.id)
    if (idx !== -1) diaries.value[idx] = { ...diary }
    if (currentDiary.value?.id === diary.id) {
      currentDiary.value = { ...diary }
    }
  }

  async function deleteDiary(date, id) {
    if (isElectron()) {
      await window.electronAPI.deleteDiary({ date, id })
    }
    diaries.value = diaries.value.filter(d => !(d.date === date && d.id === id))
    if (currentDiary.value?.id === id) currentDiary.value = null
  }

  async function fetchTrash() {
    if (isElectron()) {
      trash.value = await window.electronAPI.listTrash()
    }
  }

  async function restoreDiary(date, id) {
    if (isElectron()) {
      await window.electronAPI.restoreDiary({ date, id })
      trash.value = trash.value.filter(d => !(d.date === date && d.id === id))
      await fetchDiaries()
    }
  }

  async function permanentDeleteTrash(date, id) {
    if (isElectron()) {
      await window.electronAPI.permanentDeleteTrash({ date, id })
    }
    trash.value = trash.value.filter(d => !(d.date === date && d.id === id))
  }

  async function emptyTrash() {
    if (isElectron()) {
      await window.electronAPI.emptyTrash()
    }
    trash.value = []
  }

  return {
    diaries, trash, currentDiary, libraryPath, loading,
    initLibrary, fetchDiaries, createDiary, loadDiary, saveDiary,
    deleteDiary, fetchTrash, restoreDiary, permanentDeleteTrash, emptyTrash,
  }
})
