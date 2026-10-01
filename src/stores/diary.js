import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDiaryStore = defineStore('diary', () => {
  const diaries = ref([])
  const trash = ref([])
  const currentDiary = ref(null)
  const libraryPath = ref(null)
  const loading = ref(false)

  async function initLibrary() {
    if (window.electronAPI) {
      libraryPath.value = await window.electronAPI.getLibraryPath()
    }
  }

  async function fetchDiaries() {
    loading.value = true
    try {
      if (window.electronAPI) {
        diaries.value = await window.electronAPI.listDiaries()
      }
    } finally {
      loading.value = false
    }
  }

  async function createDiary(data = {}) {
    if (!window.electronAPI) return null
    const diary = await window.electronAPI.createDiary(data)
    diaries.value.unshift(diary)
    return diary
  }

  async function loadDiary(date, id) {
    if (!window.electronAPI) return null
    currentDiary.value = await window.electronAPI.getDiary({ date, id })
    return currentDiary.value
  }

  async function saveDiary(diary) {
    if (!window.electronAPI) return
    await window.electronAPI.saveDiary({ date: diary.date, id: diary.id, data: diary })
    // 更新列表中的副本
    const idx = diaries.value.findIndex(d => d.id === diary.id)
    if (idx !== -1) diaries.value[idx] = diary
    if (currentDiary.value?.id === diary.id) {
      currentDiary.value = { ...diary }
    }
  }

  async function deleteDiary(date, id) {
    if (!window.electronAPI) return
    await window.electronAPI.deleteDiary({ date, id })
    diaries.value = diaries.value.filter(d => !(d.date === date && d.id === id))
  }

  async function fetchTrash() {
    if (!window.electronAPI) return
    trash.value = await window.electronAPI.listTrash()
  }

  async function restoreDiary(date, id) {
    if (!window.electronAPI) return
    await window.electronAPI.restoreDiary({ date, id })
    trash.value = trash.value.filter(d => !(d.date === date && d.id === id))
    await fetchDiaries()
  }

  async function emptyTrash() {
    if (!window.electronAPI) return
    await window.electronAPI.emptyTrash()
    trash.value = []
  }

  return {
    diaries, trash, currentDiary, libraryPath, loading,
    initLibrary, fetchDiaries, createDiary, loadDiary, saveDiary,
    deleteDiary, fetchTrash, restoreDiary, emptyTrash,
  }
})
