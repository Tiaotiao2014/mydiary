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
      <div class="tb-dropdown">
        <button
          :class="{ active: editor?.isActive('table') }"
          title="表格"
          @click="tableMenuOpen = !tableMenuOpen"
        >▦</button>
        <div v-if="tableMenuOpen" class="tb-menu">
          <button @click="runAndClose('insertTable', { rows: 3, cols: 3, withHeaderRow: true })">插入 3×3 表格</button>
          <button @click="runAndClose('insertTable', { rows: 4, cols: 4, withHeaderRow: true })">插入 4×4 表格</button>
          <div class="tb-menu-sep"></div>
          <button :disabled="!inTable" @click="runAndClose('addColumnBefore')">左侧插入列</button>
          <button :disabled="!inTable" @click="runAndClose('addColumnAfter')">右侧插入列</button>
          <button :disabled="!inTable" @click="runAndClose('addRowBefore')">上方插入行</button>
          <button :disabled="!inTable" @click="runAndClose('addRowAfter')">下方插入行</button>
          <div class="tb-menu-sep"></div>
          <button :disabled="!inTable" @click="runAndClose('deleteColumn')">删除当前列</button>
          <button :disabled="!inTable" @click="runAndClose('deleteRow')">删除当前行</button>
          <button :disabled="!inTable" @click="runAndClose('deleteTable')">删除整个表格</button>
          <div class="tb-menu-sep"></div>
          <button :disabled="!inTable" @click="runAndClose('mergeCells')">合并选中单元格</button>
          <button :disabled="!inTable" @click="runAndClose('splitCell')">拆分单元格</button>
          <button :disabled="!inTable" @click="runAndClose('toggleHeaderRow')">切换表头行</button>
          <div class="tb-menu-sep"></div>
          <button :disabled="!inTable" @click="runAndClose('toggleCellAlign', 'left')">单元格左对齐</button>
          <button :disabled="!inTable" @click="runAndClose('toggleCellAlign', 'center')">单元格居中</button>
          <button :disabled="!inTable" @click="runAndClose('toggleCellAlign', 'right')">单元格右对齐</button>
        </div>
      </div>

      <span class="tb-sep"></span>

      <!-- 公式 -->
      <button title="插入行内公式" @click="insertMath">∑</button>
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
import { ref, computed, onMounted, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Mathematics from '@tiptap/extension-mathematics'
import 'katex/dist/katex.min.css'

const props = defineProps({
  content: { type: [Object, String], default: null },
})
const emit = defineEmits(['update'])

const fileInput = ref(null)
const tableMenuOpen = ref(false)

// 给单元格/表头扩展加一个 textAlign 属性，实现单元格对齐
function withTextAlign(Ext) {
  return Ext.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        textAlign: {
          default: null,
          parseHTML: element => element.style.textAlign || null,
          renderHTML: attributes => (attributes.textAlign ? { style: `text-align: ${attributes.textAlign}` } : {}),
        },
      }
    },
  })
}

const AlignedTableHeader = withTextAlign(TableHeader)
const AlignedTableCell = withTextAlign(TableCell)

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
    // 表格四件套：缺一不可（Table=表格本体，Row=行，Header=表头单元格，Cell=普通单元格）
    Table.configure({
      resizable: true,
      lastColumnResizable: true,
      allowTableNodeSelection: true,
      HTMLAttributes: { class: 'mydiary-table' },
    }),
    TableRow,
    AlignedTableHeader,
    AlignedTableCell,
    // 公式：基于 ProseMirror Decoration + KaTeX，无 schema 节点
    Mathematics.configure({
      katexOptions: { throwOnError: false },
    }),
  ],
  // 只在初始化时传入内容，之后编辑器自己管理
  content: props.content || '',
  onUpdate: ({ editor: e }) => {
    emit('update', e.getJSON())
    tableMenuOpen.value = false
  },
})

const inTable = computed(() => !!editor.value?.isActive('table'))

// 单元格对齐（自定义实现，不依赖内置命令）
function setCellAlign(align) {
  const e = editor.value
  if (!e) return
  const { state, view } = e
  const { from, to } = state.selection
  const tr = state.tr
  let changed = false
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign: align })
      changed = true
    }
  })
  if (changed) view.dispatch(tr)
}

// 执行命令并关闭菜单
function runAndClose(command, arg) {
  const e = editor.value
  if (!e) return
  if (command === 'toggleCellAlign') {
    setCellAlign(arg)
  } else {
    e.chain().focus()[command](arg).run()
  }
  tableMenuOpen.value = false
}

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

// 插入行内公式：写入 $ $ 并把光标停在中间
function insertMath() {
  const e = editor.value
  if (!e) return
  e.chain().focus().insertContent('$  $').run()
  const pos = e.state.selection.from
  e.commands.setTextSelection(pos - 2)
}
</script>

<style scoped>
.editor-wrapper { border: 1px solid var(--border); border-radius: 10px; }

.editor-toolbar {
  display: flex; gap: 2px; padding: 8px 12px; flex-wrap: wrap; align-items: center;
  border-bottom: 1px solid var(--border); background: var(--card-bg);
  position: relative; z-index: 20;
}
.editor-toolbar button {
  padding: 5px 9px; border: none; background: transparent;
  color: var(--fg); cursor: pointer; border-radius: 4px; font-size: 13px; min-width: 32px;
  white-space: nowrap;
}
.editor-toolbar button:hover:not(:disabled) { background: var(--accent); color: #fff; }
.editor-toolbar button.active { background: var(--accent); color: #fff; }
.editor-toolbar button:disabled { opacity: 0.35; cursor: not-allowed; }
.tb-sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; }

/* 表格下拉菜单 */
.tb-dropdown { position: relative; display: inline-block; }
.tb-menu {
  position: absolute; top: calc(100% + 6px); left: 0;
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: 8px; padding: 6px; min-width: 172px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18); z-index: 30;
  display: flex; flex-direction: column; gap: 1px;
}
.tb-menu button {
  text-align: left; padding: 6px 10px; font-size: 12.5px;
  border-radius: 5px; white-space: nowrap; min-width: 0; color: var(--fg);
}
.tb-menu-sep { height: 1px; background: var(--border); margin: 4px 2px; }

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

/* ── 表格样式（不写这些，表格边框看不见、拖拽手柄也出不来）──── */
.editor-content :deep(.ProseMirror table) {
  border-collapse: collapse; table-layout: fixed; width: 100%;
  margin: 12px 0; overflow: hidden;
}
.editor-content :deep(.ProseMirror td),
.editor-content :deep(.ProseMirror th) {
  border: 1px solid var(--border); padding: 6px 10px; vertical-align: top;
  position: relative; min-width: 60px;
}
.editor-content :deep(.ProseMirror th) {
  background: var(--card-bg); font-weight: 600; text-align: left;
}
.editor-content :deep(.ProseMirror .selectedCell)::after {
  content: ''; position: absolute; inset: 0; background: rgba(74, 108, 247, 0.18);
  pointer-events: none;
}
.editor-content :deep(.ProseMirror .column-resize-handle) {
  position: absolute; right: -2px; top: 0; bottom: 0; width: 4px;
  background: var(--accent); pointer-events: none;
}
.editor-content :deep(.ProseMirror .tableWrapper) { overflow-x: auto; }
.editor-content :deep(.ProseMirror.resize-cursor) { cursor: col-resize; }

/* ── 公式样式 ───────────────────────────────────────── */
.editor-content :deep(.Tiptap-mathematics-render) {
  display: inline-block; padding: 0 2px; cursor: pointer;
}
.editor-content :deep(.Tiptap-mathematics-render--editable:hover) {
  background: rgba(74, 108, 247, 0.12); border-radius: 3px;
}
.editor-content :deep(.Tiptap-mathematics-editor) {
  color: var(--accent); font-family: monospace;
}
</style>
