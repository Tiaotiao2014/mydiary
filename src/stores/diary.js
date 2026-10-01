import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDiaryStore = defineStore('diary', () => {
  const diaries = ref([])
  const currentDiary = ref(null)
  const libraryPath = ref(null)

  function setLibraryPath(p) { libraryPath.value = p }

  return { diaries, currentDiary, libraryPath, setLibraryPath }
})
