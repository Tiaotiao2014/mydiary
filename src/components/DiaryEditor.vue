<template>
  <div class="editor-wrapper">
    <!-- 工具栏 -->
    <div class="editor-toolbar">
      <!-- 文本格式 -->
      <button :class="{ active: editor?.isActive('bold') }" @click="editor?.chain().focus().toggleBold().run()" title="加粗"><b>B</b></button>
      <button :class="{ active: editor?.isActive('italic') }" @click="editor?.chain().focus().toggleItalic().run()" title="斜体"><i>I</i></button>
      <button :class="{ active: editor?.isActive('strike') }" @click="editor?.chain().focus().toggleStrike().run()" title="删除线"><s>S</s></button>

      <span class="tb-sep"></span>

      <!-- 标题 -->
      <button :class="{ active: editor?.isActive('heading', { level: 1 }) }" @click="editor?.chain().focus().toggleHeading({ level: 1 }).run()" title="一级标题">H1</button>
      <button :class="{ active: editor?.isActive('heading', { level: 2 }) }" @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()" title="二级标题">H2</button>

      <span class="tb-sep"></span>

      <!-- 列表 -->
      <button :class="{ active: editor?.isActive('bulletList') }" @click="editor?.chain().focus().toggleBulletList().run()" title="无序列表">•</button>
      <button :class="{ active: editor?.isActive('orderedList') }" @click="editor?.chain().focus().toggleOrderedList().run()" title="有序列表">1.</button>
      <button :class="{ active: editor?.isActive('blockquote') }" @click="editor?.chain().focus().toggleBlockquote().run()" title="引用">❝</button>

      <span class="tb-sep"></span>

      <!-- 插入 -->
      <button @click="editor?.chain().focus().toggleCodeBlock().run()" title="代码块">&lt;/&gt;</button>
      <button @click="editor?.chain().focus().setHorizontalRule().run()" title="水平线">—</button>
      <button @click="insertImage" title="插入图片">🖼</button>

      <span class="tb-sep"></span>

      <!-- 表格 -->
      <button @click="insertTable" title="插入表格">▦</button>

      <span class="tb-sep"></span>

      <!-- 公式 -->
      <button @click="insertMath" title="插入公式">∑</button>
    </div>

    <!-- 编辑区域 -->
    <EditorContent :editor="editor" class="editor-content" />

    <!-- 图片上传（隐藏 input） -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      style="display:none"
      @change="onImageSelected"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { Mathematics } from '@tiptap/extension-mathematics'

// KaTeX CSS
import 'katex/dist/katex.min.css'

const props = defineProps({
  content: { type: [Object, String], default: null },
})
const emit = defineEmits(['update', 'update:content'])

const fileInput = ref(null)

const editor = useEditor({
  extensions: [
    StarterKit,
    Image,
    Table.configure({
      resizable: false,
      allowHeaderRow: true,
      allowHeaderColumn: true,
      allowHeaderCells: true,
    }),
    TableRow,
    TableHeader,
    Mathematics.configure({
      katexOptions: { throwOnError: false },
    }),
  ],
  content: props.content
    ? (typeof props.content === 'string' ? props.content : JSON.stringify(props.content))
    : '',
  onUpdate: ({ editor: e }) => {
    emit('update', e.getJSON())
    emit('update:content', e.getJSON())
  },
})

// 图片上传
async function insertImage() {
  fileInput.value?.click()
}

async function onImageSelected(e) {
  const file = e.target.files?.[0]
  if (!file || !window.electronAPI) return
  const reader = new FileReader()
  reader.onload = async () => {
    const base64 = reader.result.split(',')[1]
    const relPath = await window.electronAPI.saveAttachment({ data: base64, filename: file.name })
    editor.value?.chain().focus().setImage({ src: relPath }).run()
  }
  reader.readAsDataURL(file)
  e.target.value = ''
}

// 表格
function insertTable() {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

// 公式
function insertMath() {
  const latex = prompt('请输入 LaTeX 公式：', 'E = mc^2')
  if (latex) {
    editor.value?.chain().focus().insertContent([
      { type: 'inlineMath', attrs: { latex } },
    ]).run()
  }
}
</script>

<style scoped>
.editor-wrapper { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }

.editor-toolbar {
  display: flex; gap: 2px; padding: 8px 12px; flex-wrap: wrap; align-items: center;
  border-bottom: 1px solid var(--border); background: var(--card-bg);
}
.editor-toolbar button {
  padding: 5px 9px; border: none; background: transparent;
  color: var(--fg); cursor: pointer; border-radius: 4px; font-size: 13px; min-width: 32px;
}
.editor-toolbar button:hover { background: var(--accent); color: #fff; }
.editor-toolbar button.active { background: var(--accent); color: #fff; }
.tb-sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; }

.editor-content { min-height: 400px; }
.editor-content :deep(.ProseMirror) {
  padding: 20px; min-height: 400px; outline: none; font-size: 15px; line-height: 1.7;
}
.editor-content :deep(.ProseMirror h1) { font-size: 1.5em; margin: 0.5em 0; }
.editor-content :deep(.ProseMirror h2) { font-size: 1.25em; margin: 0.5em 0; }
.editor-content :deep(.ProseMirror blockquote) {
  border-left: 3px solid var(--accent); padding-left: 1em; margin: 0.5em 0; opacity: 0.8;
}
.editor-content :deep(.ProseMirror pre) {
  background: var(--card-bg); border-radius: 6px; padding: 12px;
  font-family: monospace; font-size: 13px;
}
.editor-content :deep(.ProseMirror table) {
  border-collapse: collapse; width: 100%; margin: 1em 0;
}
.editor-content :deep(.ProseMirror th),
.editor-content :deep(.ProseMirror td) {
  border: 1px solid var(--border); padding: 8px 10px; font-size: 14px;
}
.editor-content :deep(.ProseMirror th) { background: var(--card-bg); font-weight: 600; }
.editor-content :deep(.ProseMirror img) { max-width: 100%; border-radius: 4px; }
.editor-content :deep(.katex-display) { margin: 1em 0; overflow-x: auto; }
</style>
