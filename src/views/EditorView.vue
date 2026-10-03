<template>
  <div class="editor-page">
    <div class="editor-header">
      <input v-model="title" class="title-input" placeholder="日记标题..." @change="onMetaChange" />
      <div class="header-actions">
        <button class="btn btn-ghost" @click="goBack">← 返回</button>
        <div class="export-dropdown">
          <button class="btn btn-ghost" :disabled="exporting" @click="exportMenuOpen = !exportMenuOpen">
            {{ exporting ? '导出中…' : '⬇ 导出' }}
          </button>
          <div v-if="exportMenuOpen" class="export-menu" @mouseleave="exportMenuOpen = false">
            <button @click="doExport('html')">导出为 HTML</button>
            <button @click="doExport('md')">导出为 Markdown</button>
            <button @click="doExport('csv')">导出为 Excel (CSV)</button>
          </div>
        </div>
        <button class="btn btn-ghost" @click="requestDelete">🗑 删除</button>
        <button class="btn btn-primary" :disabled="saving" @click="save(true)">
          {{ saving ? '保存中...' : lastSaveText }}
        </button>
      </div>
    </div>

    <p v-if="saveError" class="save-error">⚠ {{ saveError }}</p>

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

    <!-- 删除确认对话框 -->
    <Teleport to="body">
      <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
        <div class="modal">
          <p>确定要删除这篇日记吗？</p>
          <p class="modal-hint">可进入回收站恢复</p>
          <div class="modal-actions">
            <button class="btn modal-cancel" @click="showDeleteModal = false">取消</button>
            <button class="btn modal-confirm" @click="doDelete">删除</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDiaryStore } from '@/stores/diary'
import DiaryEditor from '@/components/DiaryEditor.vue'
import { downloadDiary } from '@/services/export'

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
const lastSaveText = ref('保存')
const showDeleteModal = ref(false)
const exportMenuOpen = ref(false)
const exporting = ref(false)
const saveError = ref('')
let isManualSave = false
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

async function save(manual = false) {
  isManualSave = manual
  if (!store.currentDiary) return
  saving.value = true
  saveError.value = ''
  try {
    await store.saveDiary({
      ...store.currentDiary,
      title: title.value,
      tags: tagList.value,
      content: editorContent.value,
    })
    lastSaveText.value = isManualSave ? '已保存' : '已自动保存'
  } catch (e) {
    // 关键：必须捕获，否则异常会冒泡成"未处理的 Promise 异常"，
    // 导致调用方（如 goBack）的后续逻辑被静默跳过。
    saveError.value = '保存失败：' + (e?.message || e)
    lastSaveText.value = '保存失败'
    console.error('[save] 保存失败:', e)
  } finally {
    saving.value = false
  }
}

async function goBack() {
  // 无论保存成功与否都要能返回，避免"点了没反应"
  try {
    await save()
  } catch (e) {
    console.error('[goBack] 保存环节异常，仍然返回:', e)
  }
  router.push('/')
}

function requestDelete() {
  showDeleteModal.value = true
}

async function doDelete() {
  const d = store.currentDiary
  showDeleteModal.value = false
  if (!d) return
  await store.deleteDiary(d.date, d.id)
  router.push('/')
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

// ── 单篇导出 ─────────────────────────────────────────────
async function doExport(format) {
  exportMenuOpen.value = false
  exporting.value = true
  try {
    // 先落盘，保证导出的是最新内容
    await save()
    await downloadDiary({
      ...(store.currentDiary || {}),
      title: title.value,
      tags: tagList.value,
      content: editorContent.value,
    }, format)
  } catch (e) {
    alert('导出失败：' + (e?.message || e))
  } finally {
    exporting.value = false
  }
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
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

/* 导出下拉 */
.export-dropdown { position: relative; display: inline-block; }
.export-menu {
  position: absolute; top: calc(100% + 6px); right: 0;
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: 8px; padding: 6px; min-width: 168px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18); z-index: 30;
  display: flex; flex-direction: column; gap: 1px;
}
.export-menu button {
  text-align: left; padding: 7px 10px; font-size: 12.5px;
  border: none; background: transparent; color: var(--fg);
  border-radius: 5px; cursor: pointer; white-space: nowrap;
}
.export-menu button:hover { background: var(--accent); color: #fff; }
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
.save-error {
  font-size: 13px; color: #e74c3c; background: rgba(231,76,60,0.1);
  border: 1px solid rgba(231,76,60,0.35); border-radius: 8px;
  padding: 8px 12px; word-break: break-all;
}
.tag-chip {
  background: var(--accent); color: #fff; font-size: 12px;
  padding: 3px 10px; border-radius: 12px; cursor: pointer;
}
.tag-chip:hover { opacity: 0.8; }
.tag-add {
  background: transparent; border: 1px dashed var(--border);
  /* <button> 不继承父级 color，缺省会变成纯黑，深色模式下看不见 */
  color: var(--fg);
  font-size: 12px; padding: 3px 10px; border-radius: 12px; cursor: pointer; opacity: 0.6;
}
.tag-input {
  font-size: 12px; padding: 3px 8px; border-radius: 12px;
  border: 1px solid var(--accent); background: transparent; color: var(--fg);
  width: 80px; outline: none;
}

/* 模态框 */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: var(--card-bg, #f4f6fa); border: 1px solid var(--border, #e0e4ec);
  border-radius: 12px; padding: 24px; min-width: 320px; max-width: 420px;
}
.modal p { font-size: 15px; color: var(--fg, #1a1a2e); margin-bottom: 8px; }
.modal-hint { font-size: 13px; opacity: 0.5; margin-bottom: 16px; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
.modal-cancel {
  background: transparent; border: 1px solid var(--border, #e0e4ec); color: var(--fg, #1a1a2e);
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
}
.modal-cancel:hover { opacity: 0.8; }
.modal-confirm {
  background: #e74c3c; border: none; color: #fff;
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
}
.modal-confirm:hover { opacity: 0.85; }
</style>
