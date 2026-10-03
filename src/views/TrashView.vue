<template>
  <div class="trash-page">
    <div class="trash-header">
      <h2>回收站</h2>
      <button v-if="trash.length > 0" class="btn btn-danger" @click="showEmptyModal = true">清空回收站</button>
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
          <button class="btn btn-perm" @click="showPermModal = { date: d.date, id: d.id, title: d.title || '无标题' }">✕ 永久删除</button>
        </div>
      </div>
    </div>

    <button class="btn btn-back" @click="router.push('/')">← 返回</button>

    <!-- 永久删除确认 -->
    <Teleport to="body">
      <div v-if="showPermModal" class="modal-overlay" @click.self="showPermModal = null">
        <div class="modal">
          <p>确定永久删除「{{ showPermModal.title }}」？</p>
          <p class="modal-hint">此操作不可撤销</p>
          <div class="modal-actions">
            <button class="btn modal-cancel" @click="showPermModal = null">取消</button>
            <button class="btn modal-confirm" @click="doPermanentDelete">永久删除</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 清空回收站确认 -->
    <Teleport to="body">
      <div v-if="showEmptyModal" class="modal-overlay" @click.self="showEmptyModal = false">
        <div class="modal">
          <p>确定清空回收站？</p>
          <p class="modal-hint">所有日记将被永久删除，此操作不可撤销</p>
          <div class="modal-actions">
            <button class="btn modal-cancel" @click="showEmptyModal = false">取消</button>
            <button class="btn modal-confirm" @click="doEmptyTrash">清空</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDiaryStore } from '@/stores/diary'

const router = useRouter()
const store = useDiaryStore()
// 必须用 computed 包一层：直接写 `const trash = store.trash` 只会抓住
// 「此刻」的数组引用，而 store 内 fetchTrash 是整体替换数组（trash.value = ...），
// 组件会一直指着旧数组 —— 表现为「刚删完的日记在回收站里看不到，切走再回来才出现」。
const trash = computed(() => store.trash)

const showPermModal = ref(null)
const showEmptyModal = ref(false)

onMounted(() => store.fetchTrash())

async function restoreDiary(d) {
  await store.restoreDiary(d.date, d.id)
  await store.fetchTrash()
  await store.fetchDiaries()
}

function doPermanentDelete() {
  if (!showPermModal.value) return
  const { date, id } = showPermModal.value
  showPermModal.value = null
  store.permanentDeleteTrash(date, id).then(() => store.fetchTrash())
}

function doEmptyTrash() {
  showEmptyModal.value = false
  store.emptyTrash().then(() => store.fetchTrash())
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

/* 模态框 */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: var(--card-bg, #f4f6fa); border: 1px solid var(--border, #e0e4ec);
  border-radius: 12px; padding: 24px; min-width: 320px; max-width: 420px;
}
.modal p { font-size: 15px; color: var(--fg, #1a1a2e); margin-bottom: 8px; }
.modal-hint { font-size: 13px; opacity: 0.5; margin-bottom: 16px; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
.modal-cancel {
  background: transparent; border: 1px solid var(--border, #e0e4ec); color: var(--fg, #1a1a2e);
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
}
.modal-cancel:hover { opacity: 0.8; }
.modal-confirm {
  background: #e74c3c; border: none; color: #fff;
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
}
.modal-confirm:hover { opacity: 0.85; }
</style>
