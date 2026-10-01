<template>
  <div class="home">
    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="diaries.length === 0" class="empty-state">
      <p>还没有日记，点击右上角"新建"开始第一篇吧。</p>
    </div>

    <div v-else class="diary-list">
      <div v-for="group in groupedDiaries" :key="group.date" class="date-group">
        <h3 class="date-label">{{ formatDate(group.date) }}</h3>
        <div
          v-for="d in group.items"
          :key="d.id"
          class="diary-card"
          @click="openDiary(d)"
        >
          <div class="diary-title">{{ d.title || '无标题' }}</div>
          <div class="diary-preview">{{ getPreview(d) }}</div>
          <div class="diary-tags">
            <span v-for="tag in d.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDiaryStore } from '@/stores/diary'

const store = useDiaryStore()
const router = useRouter()

const loading = computed(() => store.loading)
const diaries = computed(() => store.diaries)

onMounted(async () => {
  await store.initLibrary()
  await store.fetchDiaries()
})

const groupedDiaries = computed(() => {
  const map = {}
  for (const d of diaries.value) {
    if (!map[d.date]) map[d.date] = []
    map[d.date].push(d)
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }))
})

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日  星期${weekDays[d.getDay()]}`
}

function getPreview(d) {
  // 简单提取 Tiptap JSON 里的纯文本
  if (!d.content?.content) return ''
  const texts = []
  function walk(node) {
    if (node.type === 'text' && node.text) texts.push(node.text)
    if (node.content) node.content.forEach(walk)
  }
  walk(d.content)
  return texts.join('').slice(0, 120) || '（无正文）'
}

function openDiary(d) {
  router.push(`/edit/${d.id}?date=${d.date}`)
}
</script>

<style scoped>
.loading, .empty-state { text-align: center; padding: 60px 0; opacity: 0.5; }
.diary-list { display: flex; flex-direction: column; gap: 28px; }
.date-group { }
.date-label { font-size: 14px; font-weight: 600; color: var(--accent); margin-bottom: 10px; }
.diary-card {
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: 10px; padding: 16px; cursor: pointer;
  transition: border-color 0.15s;
}
.diary-card:hover { border-color: var(--accent); }
.diary-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.diary-preview { font-size: 13px; opacity: 0.65; margin-bottom: 8px; line-height: 1.5; }
.diary-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.tag {
  background: var(--accent); color: #fff;
  font-size: 11px; padding: 2px 8px; border-radius: 10px;
}
</style>
