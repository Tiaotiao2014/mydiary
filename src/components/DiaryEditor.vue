<template>
  <div class="editor-wrapper">
    <div class="editor-toolbar">
      <button :class="{ active: editor?.isActive('bold') }" @click="editor?.chain().focus().toggleBold().run()" title="加粗"><b>B</b></button>
      <button :class="{ active: editor?.isActive('italic') }" @click="editor?.chain().focus().toggleItalic().run()" title="斜体"><i>I</i></button>
      <button :class="{ active: editor?.isActive('strike') }" @click="editor?.chain().focus().toggleStrike().run()" title="删除线"><s>S</s></button>
      <button :class="{ active: editor?.isActive('heading', { level: 1 }) }" @click="editor?.chain().focus().toggleHeading({ level: 1 }).run()" title="一级标题">H1</button>
      <button :class="{ active: editor?.isActive('heading', { level: 2 }) }" @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()" title="二级标题">H2</button>
      <button :class="{ active: editor?.isActive('bulletList') }" @click="editor?.chain().focus().toggleBulletList().run()" title="无序列表">•</button>
      <button :class="{ active: editor?.isActive('orderedList') }" @click="editor?.chain().focus().toggleOrderedList().run()" title="有序列表">1.</button>
      <button :class="{ active: editor?.isActive('blockquote') }" @click="editor?.chain().focus().toggleBlockquote().run()" title="引用">❝</button>
      <button @click="editor?.chain().focus().toggleCodeBlock().run()" title="代码块">&lt;/&gt;</button>
      <button @click="editor?.chain().focus().setHorizontalRule().run()" title="水平线">—</button>
      <button @click="editor?.chain().focus().setImage({ src: 'https://via.placeholder.com/300' }).run()" title="插入图片">🖼</button>
    </div>
    <EditorContent :editor="editor" class="editor-content" />
  </div>
</template>

<script setup>
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'

const props = defineProps({
  content: { type: [Object, String], default: null },
})
const emit = defineEmits(['update', 'update:content'])

const editor = useEditor({
  extensions: [StarterKit, Image],
  content: props.content
    ? (typeof props.content === 'string' ? props.content : JSON.stringify(props.content))
    : '',
  onUpdate: ({ editor: e }) => {
    emit('update', e.getJSON())
    emit('update:content', e.getJSON())
  },
})
</script>

<style scoped>
.editor-wrapper { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.editor-toolbar {
  display: flex; gap: 2px; padding: 8px 12px; flex-wrap: wrap;
  border-bottom: 1px solid var(--border); background: var(--card-bg);
}
.editor-toolbar button {
  padding: 5px 9px; border: none; background: transparent;
  color: var(--fg); cursor: pointer; border-radius: 4px; font-size: 13px;
  min-width: 32px;
}
.editor-toolbar button:hover { background: var(--accent); color: #fff; }
.editor-toolbar button.active { background: var(--accent); color: #fff; }
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
  background: var(--card-bg); border-radius: 6px; padding: 12px; font-family: monospace; font-size: 13px;
}
</style>
