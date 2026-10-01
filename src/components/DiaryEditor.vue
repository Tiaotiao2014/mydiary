<template>
  <div class="editor-wrapper">
    <div class="editor-toolbar">
      <button :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()">B</button>
      <button :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()">I</button>
      <button :class="{ active: editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()">S</button>
      <button :class="{ active: editor.isActive('heading', { level: 1 }) }" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()">H1</button>
      <button :class="{ active: editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
      <button @click="editor.chain().focus().toggleBulletList().run()">•</button>
      <button @click="editor.chain().focus().toggleOrderedList().run()">1.</button>
      <button @click="editor.chain().focus().toggleBlockquote().run()">"</button>
      <button @click="editor.chain().focus().toggleCodeBlock().run()">&lt;/&gt;</button>
      <button @click="editor.chain().focus().setHorizontalRule().run()">—</button>
    </div>
    <EditorContent :editor="editor" class="editor-content" />
  </div>
</template>

<script setup>
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'

const props = defineProps({
  content: { type: Object, default: null },
})
const emit = defineEmits(['update:content'])

const editor = useEditor({
  extensions: [StarterKit, Image],
  content: props.content ? JSON.stringify(props.content) : '',
  onUpdate: ({ editor }) => {
    emit('update:content', editor.getJSON())
  },
})
</script>

<style scoped>
.editor-wrapper { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.editor-toolbar {
  display: flex; gap: 4px; padding: 8px 12px;
  border-bottom: 1px solid var(--border); background: var(--card-bg);
}
.editor-toolbar button {
  padding: 4px 8px; border: none; background: transparent;
  color: var(--fg); cursor: pointer; border-radius: 4px; font-size: 13px;
}
.editor-toolbar button:hover { background: var(--accent); color: #fff; }
.editor-toolbar button.active { background: var(--accent); color: #fff; }
.editor-content { min-height: 300px; }
.editor-content :deep(.ProseMirror) {
  padding: 16px; min-height: 300px; outline: none;
}
</style>
