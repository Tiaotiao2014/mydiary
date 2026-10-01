<template>
  <div class="editor-page">
    <div class="editor-header">
      <input v-model="title" class="title-input" placeholder="日记标题..." @change="onMetaChange" />
      <div class="header-actions">
        <button class="btn btn-ghost" @click="goBack">← 返回</button>
        <button class="btn btn-ghost" @click="deleteDiary">🗑 删除</button>
        <button class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>

    <div class="tags-row">
      <span v-for="tag in tagList" :key="tag" class="tag-chip" @click="removeTag(tag)">{{ tag }} ×</span>
      <input
        v-if="addingTag"
        v-model="tagInput"
        class="tag-input"
        @blur="confirmTag"
        @keyup.enter="confirmTag"
      />
      <button v-else class="tag-add" @click="addingTag = true">＋ 标签</button>
    </div>

    <DiaryEditor v-if="editorReady" :content="editorContent" @update="onEditorUpdate" />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDiaryStore } from '@/stores/diary'
import DiaryEditor from '@/components/DiaryEditor.vue'

const route = useRoute()
const router = useRouter()
const store = useDiaryStore()

const title = ref('')
const tagList = ref([])
const addingTag = ref(false)
const tagInput = ref('')
const editorContent = ref(null)
const editorReady = ref(false)
const saving = ref(false)
let saveTimer = null
let diaryId = null

onMounted(async () => {
  const id = route.params.id
  if (!id) return

  if (id === 'new') {
    const diary = await store.createDiary({ date: new Date().toISOString().slice(0, 10) })
    if (!diary) return
    diaryId = diary.id
    title.value = diary.title || ''
    tagList.value = [...(diary.tags || [])]
    editorContent.value = diary.content
    store.currentDiary = diary
    editorReady.value = true
  } else {
    diaryId = id
    const date = route.query.date || new Date().toISOString().slice(0, 10)
    const diary = await store.loadDiary(date, id)
    if (diary) {
      title.value = diary.title || ''
      tagList.value = [...(diary.tags || [])]
      editorContent.value = diary.content
      store.currentDiary = diary
    }
    editorReady.value = true
  }
})

function onEditorUpdate(newContent) {
  editorContent.value = newContent
  scheduleAutoSave()
}

function onMetaChange() {
  scheduleAutoSave()
}

function scheduleAutoSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 2000)
}

async function save() {
  if (!store.currentDiary) return
  saving.value = true
  try {
    await store.saveDiary({
      ...store.currentDiary,
      title: title.value,
      tags: tagList.value,
      content: editorContent.value,
    })
  } finally {
    saving.value = false
  }
}

function goBack() {
  save().then(() => router.push('/'))
}

async function deleteDiary() {
  const d = store.currentDiary
  if (!d) return
  if (confirm('确定要删除这篇日记吗？（可进入回收站恢复）')) {
    await store.deleteDiary(d.date, d.id)
    router.push('/')
  }
}

function confirmTag() {
  const t = tagInput.value.trim()
  if (t && !tagList.value.includes(t)) tagList.value.push(t)
  tagInput.value = ''
  addingTag.value = false
  onMetaChange()
}

function removeTag(t) {
  tagList.value = tagList.value.filter(x => x !== t)
  onMetaChange()
}

onBeforeUnmount(() => clearTimeout(saveTimer))
</script>

<style scoped>
.editor-page { display: flex; flex-direction: column; gap: 12px; }
.editor-header {
  display: flex; align-items: center; gap: 12px;
  padding-bottom: 12px; border-bottom: 1px solid var(--border);
}
.title-input {
  flex: 1; font-size: 20px; font-weight: 700;
  border: none; background: transparent; color: var(--fg); outline: none;
}
.title-input::placeholder { color: var(--fg); opacity: 0.3; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.btn-ghost {
  background: transparent; color: var(--fg); opacity: 0.7;
  border: 1px solid var(--border); border-radius: 8px;
  padding: 8px 14px; cursor: pointer; font-size: 13px;
}
.btn-ghost:hover { opacity: 1; }
.btn-primary {
  background: var(--accent); color: #fff; border: none;
  padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px;
}
.btn-primary:disabled { opacity: 0.5; }
.tags-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-height: 28px; }
.tag-chip {
  background: var(--accent); color: #fff; font-size: 12px;
  padding: 3px 10px; border-radius: 12px; cursor: pointer;
}
.tag-chip:hover { opacity: 0.8; }
.tag-add {
  background: transparent; border: 1px dashed var(--border); color: var(--fg);
  font-size: 12px; padding: 3px 10px; border-radius: 12px; cursor: pointer; opacity: 0.6;
}
.tag-input {
  font-size: 12px; padding: 3px 8px; border-radius: 12px;
  border: 1px solid var(--accent); background: transparent; color: var(--fg);
  width: 80px; outline: none;
}
</style>
