/**
 * 导出服务
 * - 整库 ZIP（使用 Electron 主进程的 archiver）
 * - 单条 HTML（前端生成）
 * - 单条 PDF（Electron webContents.printToPDF）
 * - 单条 DOCX（简化版，实际用 html-docx-js 或 Pandoc）
 */

// ── 生成 HTML ─────────────────────────────────────────────
export function diaryToHTML(diary, attachmentsBase) {
  const content = extractPlainText(diary.content)
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(diary.title || '日记')}</title>
  <style>
    body { font-family: -apple-system, "Segoe UI", sans-serif; max-width: 720px; margin: 0 auto; padding: 40px 20px; color: #1a1a2e; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    .meta { font-size: 13px; color: #888; margin-bottom: 20px; }
    .tags span { display: inline-block; background: #4a6cf7; color: #fff; font-size: 12px; padding: 2px 8px; border-radius: 10px; margin-right: 6px; }
    .content { line-height: 1.8; font-size: 15px; }
    pre { background: #f4f6fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>${escapeHtml(diary.title || '无标题')}</h1>
  <div class="meta">${diary.date} · ${diary.tags?.length ? diary.tags.join(' · ') : '无标签'}</div>
  ${diary.tags?.length ? `<div class="tags">${diary.tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
  <div class="content">${content}</div>
</body>
</html>`
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function extractPlainText(content) {
  if (!content?.content) return ''
  const parts = []
  function walk(node, depth = 0) {
    switch (node.type) {
      case 'text':
        parts.push(escapeHtml(node.text || ''))
        break
      case 'heading':
        parts.push(`<h${node.attrs?.level || 1}>`)
        node.content?.forEach(c => walk(c, depth + 1))
        parts.push(`</h${node.attrs?.level || 1}>`)
        break
      case 'paragraph':
        parts.push('<p>')
        node.content?.forEach(c => walk(c, depth + 1))
        parts.push('</p>')
        break
      case 'bulletList':
      case 'orderedList':
        parts.push(`<ul>` )
        node.content?.forEach(item => {
          parts.push('<li>')
          item.content?.forEach(c => walk(c, depth + 1))
          parts.push('</li>')
        })
        parts.push('</ul>')
        break
      case 'blockquote':
        parts.push('<blockquote>')
        node.content?.forEach(c => walk(c, depth + 1))
        parts.push('</blockquote>')
        break
      case 'codeBlock':
        parts.push('<pre><code>')
        node.content?.forEach(c => walk(c, depth + 1))
        parts.push('</code></pre>')
        break
      case 'image':
        parts.push(`<img src="${escapeHtml(node.attrs?.src || '')}" style="max-width:100%" />`)
        break
      case 'table':
        parts.push('<table style="border-collapse:collapse;width:100%">')
        node.content?.forEach(row => {
          parts.push('<tr>')
          row.content?.forEach(cell => {
            const tag = cell.type === 'tableHeader' ? 'th' : 'td'
            parts.push(`<${tag} style="border:1px solid #ddd;padding:8px">`)
            cell.content?.forEach(c => walk(c, depth + 1))
            parts.push(`</${tag}>`)
          })
          parts.push('</tr>')
        })
        parts.push('</table>')
        break
      case 'horizontalRule':
        parts.push('<hr>')
        break
      case 'inlineMath':
        parts.push(`$${escapeHtml(node.attrs?.latex || '')}$`)
        break
      default:
        node.content?.forEach(c => walk(c, depth + 1))
    }
  }
  walk(content)
  return parts.join('')
}

// ── 下载 HTML 文件 ────────────────────────────────────────
export function downloadDiaryHTML(diary) {
  const html = diaryToHTML(diary)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  triggerDownload(blob, `diary_${diary.date}_${diary.title || 'untitled'}.html`)
}

// ── 触发浏览器下载（Electron 环境走 IPC）──────────────────
function triggerDownload(blob, filename) {
  if (window.electronAPI) {
    // 通过 IPC 让主进程写文件
    const reader = new FileReader()
    reader.onload = () => {
      window.electronAPI.saveExportFile({ filename, data: reader.result, type: blob.type })
    }
    reader.readAsDataURL(blob)
  } else {
    // 纯浏览器环境
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}
