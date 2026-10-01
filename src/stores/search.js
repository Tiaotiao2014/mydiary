import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSearchStore = defineStore('search', () => {
  const query = ref('')
  const activeTag = ref(null)

  // 从所有日记里提取唯一标签列表
  function allTags(diaries) {
    const set = new Set()
    for (const d of diaries) {
      for (const t of d.tags || []) set.add(t)
    }
    return [...set].sort()
  }

  // 按标签 + 关键词过滤
  function filterDiaries(diaries, keyword, tag) {
    const kw = (keyword || '').trim().toLowerCase()
    return diaries.filter(d => {
      if (tag && !(d.tags || []).includes(tag)) return false
      if (kw) {
        const text = extractText(d).toLowerCase()
        return text.includes(kw) || (d.title || '').toLowerCase().includes(kw)
      }
      return true
    })
  }

  function extractText(d) {
    if (!d.content?.content) return ''
    const parts = []
    function walk(node) {
      if (node.type === 'text' && node.text) parts.push(node.text)
      if (node.attrs?.latex) parts.push(node.attrs.latex)
      if (node.content) node.content.forEach(walk)
    }
    walk(d.content)
    return parts.join(' ')
  }

  return { query, activeTag, allTags, filterDiaries }
})
