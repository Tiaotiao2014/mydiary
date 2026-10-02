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

      <!-- 表格（待修复） -->
      <button title="插入表格（待修复）" disabled>▦</button>

      <span class="tb-sep"></span>

      <!-- 公式（待修复） -->
      <button title="插入公式（待修复）" disabled>∑</button>
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
import { ref, onMounted, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'

const props = defineProps({
  content: { type: [Object, String], default: null },
})
const emit = defineEmits(['update'])

const fileInput = ref(null)

const editor = useEditor({
  extensions: [
    // 代码块配 enterCodeBlock：代码块后按 Enter 自动插入新段落，可继续书写
    StarterKit.configure({
      codeBlock: {
        enterCodeBlock: true,
      },
    }),
    Image.configure({
      allowBase64: true,
    }),
  ],
  // 只在初始化时传入内容，之后编辑器自己管理
  content: props.content || '',
  onUpdate: ({ editor: e }) => {
    emit('update', e.getJSON())
  },
})

// 挂载后聚焦编辑器
onMounted(() => {
  nextTick(() => {
    editor.value?.commands.focus('start')
  })
})

async function insertImage() {
  fileInput.value?.click()
}

async function onImageSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    const base64 = reader.result
    if (window.electronAPI?.saveAttachment) {
      const relPath = await window.electronAPI.saveAttachment({ data: base64.split(',')[1], filename: file.name })
      editor.value?.chain().focus().setImage({ src: relPath }).run()
    } else {
      // 纯浏览器环境：直接内嵌 base64
      editor.value?.chain().focus().setImage({ src: base64 }).run()
    }
  }
  reader.readAsDataURL(file)
  e.target.value = ''
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
.editor-toolbar button:hover:not(:disabled) { background: var(--accent); color: #fff; }
.editor-toolbar button.active { background: var(--accent); color: #fff; }
.editor-toolbar button:disabled { opacity: 0.35; cursor: not-allowed; }
.tb-sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; }

.editor-content { min-height: 400px; }
.editor-content :deep(.ProseMirror) {
  padding: 20px; min-height: 400px; outline: none; font-size: 15px; line-height: 1.7;
  cursor: text;
}
.editor-content :deep(.ProseMirror h1) { font-size: 1.5em; margin: 0.5em 0; }
.editor-content :deep(.ProseMirror h2) { font-size: 1.25em; margin: 0.5em 0; }
.editor-content :deep(.ProseMirror blockquote) {
  border-left: 3px solid var(--accent); padding-left: 1em; margin: 0.5em 0; opacity: 0.8;
}
.editor-content :deep(.ProseMirror pre) {
  background: var(--card-bg); border-radius: 6px; padding: 12px;
  font-family: monospace; font-size: 13px; position: relative;
}
.editor-content :deep(.ProseMirror pre code) { font-family: inherit; }
.editor-content :deep(.ProseMirror img) { max-width: 100%; border-radius: 4px; }
</style>
