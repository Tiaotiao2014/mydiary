/**
 * 导出服务（前端）
 * - 单条 HTML —— 把 Tiptap JSON 还原成带样式的 HTML（含 KaTeX CDN，公式自动渲染）
 * - 单条 Markdown —— JSON → Markdown
 * - 单条 CSV —— JSON → .csv（Excel 可直接打开）
 * - 整库 ZIP —— 走主进程 archiver（见 electron/main.js）
 *
 * 说明：数学公式在 Tiptap 里不是节点，而是 "$...$" 文本，导出时按正则处理。
 */

// ── HTML 转义 ─────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── 行内标记（加粗/斜体/删除线/代码/链接）─────────────────
function renderMarks(text, marks = []) {
  let out = escapeHtml(text)
  for (const m of marks) {
    switch (m.type) {
      case 'bold': out = `<strong>${out}</strong>`; break
      case 'italic': out = `<em>${out}</em>`; break
      case 'strike': out = `<s>${out}</s>`; break
      case 'code': out = `<code>${out}</code>`; break
      case 'link': out = `<a href="${escapeHtml(m.attrs?.href || '#')}">${out}</a>`; break
      default: break
    }
  }
  return out
}

// 把 "$...$" 数学文本包成 KaTeX auto-render 能识别的定界符
function renderMathInText(html) {
  return html.replace(/\$([^$\n]+)\$/g, (_m, tex) => {
    return `<span class="math">\\(${escapeHtml(tex)}\\)</span>`
  })
}

// ── Tiptap JSON → HTML 片段 ──────────────────────────────
export function tiptapToHtml(node) {
  if (!node) return ''
  switch (node.type) {
    case 'doc':
      return (node.content || []).map(tiptapToHtml).join('\n')
    case 'paragraph':
      return `<p>${(node.content || []).map(tiptapToHtml).join('')}</p>`
    case 'text':
      return renderMathInText(renderMarks(node.text || '', node.marks))
    case 'heading':
      return `<h${node.attrs?.level || 1}>${(node.content || []).map(tiptapToHtml).join('')}</h${node.attrs?.level || 1}>`
    case 'bulletList':
    case 'orderedList': {
      const tag = node.type === 'orderedList' ? 'ol' : 'ul'
      const start = node.type === 'orderedList' && node.attrs?.start ? ` start="${node.attrs.start}"` : ''
      return `<${tag}${start}>${(node.content || []).map(tiptapToHtml).join('')}</${tag}>`
    }
    case 'listItem':
      return `<li>${(node.content || []).map(tiptapToHtml).join('')}</li>`
    case 'blockquote':
      return `<blockquote>${(node.content || []).map(tiptapToHtml).join('')}</blockquote>`
    case 'codeBlock':
      return `<pre><code>${escapeHtml(collectText(node))}</code></pre>`
    case 'horizontalRule':
      return '<hr>'
    case 'hardBreak':
      return '<br>'
    case 'image':
      return `<img src="${escapeHtml(node.attrs?.src || '')}" alt="${escapeHtml(node.attrs?.alt || '')}">`
    case 'table': {
      const rows = (node.content || []).map(tiptapToHtml).join('')
      return `<table>${rows}</table>`
    }
    case 'tableRow':
      return `<tr>${(node.content || []).map(tiptapToHtml).join('')}</tr>`
    case 'tableHeader':
    case 'tableCell': {
      const tag = node.type === 'tableHeader' ? 'th' : 'td'
      const span = `${node.attrs?.colspan ? ` colspan="${node.attrs.colspan}"` : ''}${node.attrs?.rowspan ? ` rowspan="${node.attrs.rowspan}"` : ''}`
      const align = node.attrs?.textAlign ? ` style="text-align:${node.attrs.textAlign}"` : ''
      return `<${tag}${span}${align}>${(node.content || []).map(tiptapToHtml).join('')}</${tag}>`
    }
    default:
      return (node.content || []).map(tiptapToHtml).join('')
  }
}

function collectText(node, parts = []) {
  if (node?.type === 'text' && node.text) parts.push(node.text)
  if (node?.content) node.content.forEach(c => collectText(c, parts))
  return parts.join('')
}

// ── 单条日记 → 完整 HTML 文档 ────────────────────────────
export function diaryToHTML(diary) {
  const body = tiptapToHtml(diary.content)
  const tags = diary.tags?.length
    ? `<div class="tags">${diary.tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>`
    : ''
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(diary.title || '日记')}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<style>
  body { font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; max-width: 760px; margin: 0 auto; padding: 40px 20px; color: #1a1a2e; line-height: 1.8; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  .meta { font-size: 13px; color: #888; margin-bottom: 16px; }
  .tags span { display: inline-block; background: #4a6cf7; color: #fff; font-size: 12px; padding: 2px 8px; border-radius: 10px; margin-right: 6px; }
  .content { font-size: 15px; }
  pre { background: #f4f6fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
  blockquote { border-left: 3px solid #4a6cf7; padding-left: 1em; color: #555; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; vertical-align: top; }
  th { background: #f4f6fa; font-weight: 600; }
  code { background: #f4f6fa; padding: 1px 4px; border-radius: 3px; }
  img { max-width: 100%; border-radius: 6px; }
</style>
</head>
<body>
  <h1>${escapeHtml(diary.title || '无标题')}</h1>
  <div class="meta">${escapeHtml(diary.date || '')} · ${diary.tags?.length ? diary.tags.map(escapeHtml).join(' · ') : '无标签'}</div>
  ${tags}
  <div class="content">${body}</div>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      if (window.renderMathInElement) {
        renderMathInElement(document.body, {
          delimiters: [
            { left: '\\\\(', right: '\\\\)', display: false },
            { left: '$$', right: '$$', display: true }
          ],
          throwOnError: false
        });
      }
    });
  </script>
</body>
</html>`
}

// ── 单条日记 → Markdown ──────────────────────────────────
export function diaryToMarkdown(diary) {
  return [
    `# ${diary.title || '无标题'}`,
    '',
    `> 日期：${diary.date || ''}　标签：${diary.tags?.length ? diary.tags.join('、') : '无'}`,
    '',
    tiptapToMarkdown(diary.content),
    '',
  ].join('\n')
}

function mdEscape(t) {
  return String(t ?? '').replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1')
}

function tiptapToMarkdown(node, prefix = '') {
  if (!node) return ''
  switch (node.type) {
    case 'doc':
      return (node.content || []).map(n => tiptapToMarkdown(n)).filter(Boolean).join('\n\n')
    case 'paragraph':
      return prefix + (node.content || []).map(inlineMd).join('')
    case 'heading':
      return prefix + '#'.repeat(node.attrs?.level || 1) + ' ' + (node.content || []).map(inlineMd).join('')
    case 'bulletList':
      return (node.content || []).map(li => tiptapToMarkdown(li, '- ')).join('\n')
    case 'orderedList':
      return (node.content || []).map((li, i) => tiptapToMarkdown(li, `${i + 1}. `)).join('\n')
    case 'listItem':
      return (node.content || []).map(c => tiptapToMarkdown(c, prefix)).join('\n')
    case 'blockquote':
      return (node.content || []).map(c => tiptapToMarkdown(c)).join('\n').split('\n').map(l => '> ' + l).join('\n')
    case 'codeBlock':
      return '```\n' + collectText(node) + '\n```'
    case 'horizontalRule':
      return '---'
    case 'image':
      return `![${node.attrs?.alt || ''}](${node.attrs?.src || ''})`
    case 'table': {
      const rows = (node.content || []).map(r => (r.content || []).map(cell =>
        collectText(cell).replace(/\|/g, '\\|').replace(/\n/g, ' ')
      ))
      if (!rows.length) return ''
      const head = rows[0]
      const sep = head.map(() => '---')
      return [head, sep, ...rows.slice(1)].map(r => '| ' + r.join(' | ') + ' |').join('\n')
    }
    default:
      return (node.content || []).map(n => tiptapToMarkdown(n)).filter(Boolean).join('\n')
  }
}

function inlineMd(node) {
  if (node.type === 'hardBreak') return '  \n'
  if (node.type !== 'text') return (node.content || []).map(inlineMd).join('')
  let out = node.text || ''
  const marks = (node.marks || []).map(m => m.type)
  if (marks.includes('code')) out = '`' + out + '`'
  if (marks.includes('bold')) out = '**' + out + '**'
  if (marks.includes('italic')) out = '*' + out + '*'
  if (marks.includes('strike')) out = '~~' + out + '~~'
  return out
}

// ── 单条日记 → CSV（Excel 可直接打开）───────────────────
export function diaryToCsv(diary) {
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = ['标题', '日期', '标签', '正文'].map(cell).join(',')
  const row = [
    diary.title || '',
    diary.date || '',
    (diary.tags || []).join('、'),
    collectText(diary.content),
  ].map(cell).join(',')
  // \ufeff 是 BOM，让 Excel 正确识别 UTF-8 中文
  return '\ufeff' + [header, row].join('\r\n')
}

// ── 下载入口 ─────────────────────────────────────────────
function safeName(s) {
  return String(s || 'untitled').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)
}

export async function downloadDiary(diary, format = 'html') {
  let content = ''
  let mime = 'text/plain;charset=utf-8'
  let ext = 'txt'
  if (format === 'html') { content = diaryToHTML(diary); mime = 'text/html;charset=utf-8'; ext = 'html' }
  else if (format === 'md') { content = diaryToMarkdown(diary); mime = 'text/markdown;charset=utf-8'; ext = 'md' }
  else if (format === 'csv') { content = diaryToCsv(diary); mime = 'text/csv;charset=utf-8'; ext = 'csv' }

  const filename = `日记_${diary.date || ''}_${safeName(diary.title)}.${ext}`
  const blob = new Blob([content], { type: mime })

  // Electron：交给主进程写文件（能拿到真实路径）
  if (window.electronAPI?.saveExportFile) {
    const dataUrl = await blobToDataUrl(blob)
    const filePath = await window.electronAPI.saveExportFile({ filename, data: dataUrl, type: mime })
    return { filePath, filename }
  }
  // 纯浏览器：触发下载
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { filePath: null, filename }
}

function blobToDataUrl(blob) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}
