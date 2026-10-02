<template>
  <div class="home">
    <!-- 搜索栏 -->
    <div class="search-bar">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          class="search-input"
          placeholder="搜索日记（标题、正文、标签）..."
        />
        <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">×</button>
      </div>

      <!-- 标签筛选 -->
      <div v-if="tags.length > 0" class="tag-filters">
        <button
          v-for="tag in tags"
          :key="tag"
          :class="['tag-filter', { active: activeTag === tag }]"
          @click="activeTag = activeTag === tag ? null : tag"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <!-- 加载 / 空状态 -->
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="filteredDiaries.length === 0" class="empty-state">
      <p v-if="diaries.length === 0">还没有日记，点击右上角"新建"开始第一篇吧。</p>
      <p v-else-if="searchQuery || activeTag">没有匹配的结果</p>
      <p v-else>还没有日记</p>
    </div>

    <!-- 日记列表 -->
    <div v-else class="diary-list">
      <div v-for="group in groupedDiaries" :key="group.date" class="date-group">
        <h3 class="date-label">{{ formatDate(group.date) }}</h3>
        <div
          v-for="d in group.items"
          :key="d.id"
          class="diary-card"
          @click="openDiary(d)"
        >
          <div class="diary-card-inner">
            <div class="diary-title">{{ d.title || '无标题' }}</div>
            <button class="diary-delete" @click.stop="deleteDiary(d)" title="删除到回收站">🗑</button>
          </div>
          <div class="diary-preview">{{ getPreview(d) }}</div>
          <div class="diary-tags">
            <span v-for="tag in d.tags" :key="tag" class="tag" @click.stop="setTag(tag)">
              {{ tag }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDiaryStore } from '@/stores/diary'
import { useSearchStore } from '@/stores/search'

const store = useDiaryStore()
const search = useSearchStore()
const router = useRouter()

const searchQuery = ref('')
const activeTag = ref(null)

onMounted(async () => {
  await store.initLibrary()
  await store.fetchDiaries()
})

const loading = computed(() => store.loading)
const diaries = computed(() => store.diaries)

const tags = computed(() => search.allTags(diaries.value))

const filteredDiaries = computed(() => {
  return search.filterDiaries(diaries.value, searchQuery.value, activeTag.value)
})

const groupedDiaries = computed(() => {
  const map = {}
  for (const d of filteredDiaries.value) {
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

function deleteDiary(d) {
  if (confirm('确定删除「' + (d.title || '无标题') + '」吗？（删除后可在回收站恢复）')) {
    store.deleteDiary(d.date, d.id).then(() => store.fetchDiaries())
  }
}

function setTag(tag) {
  activeTag.value = tag
}
</script>

<style scoped>
.search-bar { margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px; }

.search-input-wrap {
  position: relative; display: flex; align-items: center;
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: 10px; padding: 0 12px;
}
.search-input-wrap:focus-within { border-color: var(--accent); }
.search-icon { opacity: 0.4; font-size: 14px; }
.search-input {
  flex: 1; padding: 10px 8px; border: none; background: transparent;
  color: var(--fg); font-size: 14px; outline: none;
}
.search-input::placeholder { color: var(--fg); opacity: 0.4; }
.clear-btn {
  background: transparent; border: none; color: var(--fg);
  cursor: pointer; font-size: 16px; opacity: 0.5;
}

.tag-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.tag-filter {
  background: transparent; border: 1px solid var(--border); color: var(--fg);
  font-size: 12px; padding: 4px 12px; border-radius: 14px; cursor: pointer;
  transition: all 0.15s;
}
.tag-filter:hover { border-color: var(--accent); color: var(--accent); }
.tag-filter.active { background: var(--accent); color: #fff; border-color: var(--accent); }

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
.diary-card-inner { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.diary-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.diary-delete {
  background: transparent; border: none; cursor: pointer;
  font-size: 14px; opacity: 0; transition: opacity 0.15s;
  padding: 2px 6px; border-radius: 6px;
}
.diary-card:hover .diary-delete { opacity: 0.6; }
.diary-delete:hover { opacity: 1 !important; background: rgba(231,76,60,0.15); }
.diary-preview { font-size: 13px; opacity: 0.65; margin-bottom: 8px; line-height: 1.5; }
.diary-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.tag {
  background: var(--accent); color: #fff;
  font-size: 11px; padding: 2px 8px; border-radius: 10px; cursor: pointer;
}
.tag:hover { opacity: 0.8; }
</style>
