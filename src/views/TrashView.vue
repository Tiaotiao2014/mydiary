<template>
  <div class="trash-page">
    <div class="trash-header">
      <h2>回收站</h2>
      <button v-if="trash.length > 0" class="btn btn-danger" @click="emptyTrash">清空回收站</button>
    </div>

    <div v-if="trash.length === 0" class="empty-state">
      <p>回收站是空的</p>
    </div>

    <div v-else class="trash-list">
      <div v-for="d in trash" :key="d.id" class="trash-card">
        <div class="trash-info">
          <div class="diary-title">{{ d.title || '无标题' }}</div>
          <div class="trash-meta">
            删除于 {{ d.deletedAt ? formatDate(d.deletedAt) : d.date }}
            <span v-if="d.tags?.length" class="trash-tags">{{ d.tags.join(' · ') }}</span>
          </div>
        </div>
        <div class="trash-actions">
          <button class="btn btn-restore" @click="restoreDiary(d)">↩ 恢复</button>
          <button class="btn btn-perm" @click="permanentDelete(d)">✕ 永久删除</button>
        </div>
      </div>
    </div>

    <button class="btn btn-back" @click="router.push('/')">← 返回</button>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDiaryStore } from '@/stores/diary'

const router = useRouter()
const store = useDiaryStore()
const trash = store.trash

onMounted(() => store.fetchTrash())

async function restoreDiary(d) {
  await store.restoreDiary(d.date, d.id)
  await store.fetchTrash()
  await store.fetchDiaries()
}

async function permanentDelete(d) {
  if (confirm(`确定永久删除「${d.title || '无标题'}」？此操作不可撤销。`)) {
    await store.permanentDeleteTrash(d.date, d.id)
  }
}

async function emptyTrash() {
  if (confirm('确定清空回收站？所有日记将被永久删除，此操作不可撤销。')) {
    await store.emptyTrash()
    await store.fetchTrash()
  }
}

function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped>
.trash-page { display: flex; flex-direction: column; gap: 20px; }
.trash-header { display: flex; align-items: center; justify-content: space-between; }
.trash-header h2 { font-size: 20px; color: var(--fg); }
.empty-state { text-align: center; padding: 60px 0; opacity: 0.5; }

.trash-list { display: flex; flex-direction: column; gap: 10px; }
.trash-card {
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: 10px; padding: 14px 16px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.trash-info { flex: 1; min-width: 0; }
.diary-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.trash-meta { font-size: 12px; opacity: 0.5; }
.trash-tags { opacity: 0.6; margin-left: 8px; }

.trash-actions { display: flex; gap: 6px; flex-shrink: 0; }
.btn-danger {
  background: #e74c3c; color: #fff; border: none;
  padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px;
}
.btn-danger:hover { opacity: 0.85; }
.btn-restore {
  background: transparent; color: var(--accent); border: 1px solid var(--accent);
  border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 12px;
}
.btn-restore:hover { background: var(--accent); color: #fff; }
.btn-perm {
  background: transparent; color: #e74c3c; border: 1px solid #e74c3c;
  border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 12px;
}
.btn-perm:hover { background: #e74c3c; color: #fff; }
.btn-back {
  background: transparent; color: var(--fg); border: 1px solid var(--border);
  border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 13px;
  align-self: flex-start;
}
</style>
