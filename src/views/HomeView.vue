<template>
  <div class="home">
    <div class="empty-state" v-if="diaries.length === 0">
      <p>还没有日记，点击右上角"新建"开始第一篇吧。</p>
    </div>
    <div class="diary-list">
      <div v-for="group in groupedDiaries" :key="group.date" class="date-group">
        <h3 class="date-label">{{ formatDate(group.date) }}</h3>
        <div v-for="d in group.items" :key="d.id" class="diary-card" @click="openDiary(d)">
          <div class="diary-title">{{ d.title || '无标题' }}</div>
          <div class="diary-preview">{{ d.preview }}</div>
          <div class="diary-tags">
            <span v-for="tag in d.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const diaries = ref([])

onMounted(async () => {
  // TODO: 从本地文件读取日记列表
  // MVP 占位数据
  diaries.value = []
})

const groupedDiaries = computed(() => {
  const map = {}
  for (const d of diaries.value) {
    const date = d.date
    if (!map[date]) map[date] = []
    map[date].push(d)
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }))
})

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const weekDays = ['日','一','二','三','四','五','六']
  return `${d.getFullYear()} 年 ${d.getMonth()+1} 月 ${d.getDate()} 日 星期${weekDays[d.getDay()]}`
}

function openDiary(d) {
  // TODO: 路由到编辑页
}
</script>

<style scoped>
.empty-state { text-align: center; padding: 60px 0; color: var(--fg); opacity: 0.6; }
.diary-list { display: flex; flex-direction: column; gap: 24px; }
.date-group { }
.date-label { font-size: 15px; font-weight: 600; color: var(--accent); margin-bottom: 10px; }
.diary-card {
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: 10px; padding: 16px; cursor: pointer;
  transition: border-color 0.15s;
}
.diary-card:hover { border-color: var(--accent); }
.diary-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.diary-preview { font-size: 14px; opacity: 0.7; margin-bottom: 8px; }
.diary-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.tag {
  background: var(--accent); color: #fff;
  font-size: 12px; padding: 2px 8px; border-radius: 10px;
}
</style>
