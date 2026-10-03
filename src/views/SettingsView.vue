<template>
  <div class="settings-page">
    <h2>设置</h2>

    <section class="settings-section">
      <h3>主密码</h3>
      <p class="section-desc">
        主密码用于加密你标记为「加密」的日记：标题、标签、正文都会被加密后才写入硬盘，
        没有密码无法打开（标题在磁盘上也是空的）。密码本身不会被保存，只保存由它派生出的
        校验块，因此<strong>密码无法找回</strong>。设置后每次启动都需要输入一次。
      </p>

      <div v-if="!security.hasMasterPassword" class="password-form">
        <input v-model="newPassword" type="password" placeholder="新密码（最少 6 位）" class="pw-input" />
        <input v-model="confirmPassword" type="password" placeholder="确认密码" class="pw-input" />
        <button class="btn btn-primary" :disabled="!canSetPassword" @click="setMasterPassword">设置主密码</button>
      </div>

      <template v-else>
        <p class="section-desc">
          当前状态：<strong>{{ security.isUnlocked ? '已解锁' : '已锁定' }}</strong>
          · 已加密日记 {{ encryptedCount }} 篇
        </p>
        <div class="export-actions">
          <button class="btn btn-outline" :disabled="!security.isUnlocked" @click="lockNow">立即锁定</button>
          <button class="btn btn-danger" @click="removePassword">移除主密码</button>
        </div>
      </template>

      <p v-if="passwordError" class="error">{{ passwordError }}</p>
      <p v-if="passwordSuccess" class="success">{{ passwordSuccess }}</p>
    </section>

    <section class="settings-section">
      <h3>外观</h3>
      <div class="theme-row">
        <button
          v-for="theme in ['light', 'dark', 'system']"
          :key="theme"
          :class="['theme-btn', { active: config?.theme === theme }]"
          @click="setTheme(theme)"
        >
          {{ theme === 'light' ? '☀️ 浅色' : theme === 'dark' ? '🌙 深色' : '🖥 跟随系统' }}
        </button>
      </div>
    </section>

    <section class="settings-section">
      <h3>备份与迁移</h3>
      <p class="section-desc">
        导出会把整个日记库（含附件）打成一个 ZIP 包；导入时把包里的日记合并进当前库，
        已存在的日记不会被动到。
      </p>

      <div class="export-actions">
        <button class="btn btn-primary" :disabled="busy.export" @click="exportZip">
          {{ busy.export ? '正在打包…' : '⬇ 导出整库 ZIP' }}
        </button>
        <button class="btn btn-outline" :disabled="busy.import" @click="startImport">
          {{ busy.import ? '正在读取…' : '⬆ 导入 ZIP 备份' }}
        </button>
      </div>

      <p v-if="exportResult" class="success">
        ✅ 已导出：{{ exportResult.zipPath }}
        <span class="muted">（{{ formatSize(exportResult.size) }}）</span>
      </p>
      <p v-if="importResult" class="success">
        ✅ 导入完成：新增 {{ importResult.added }} 篇，覆盖 {{ importResult.overwritten }} 篇，
        跳过 {{ importResult.skipped }} 篇；还原回收站 {{ importResult.trashed }} 篇，
        附件 {{ importResult.attachments }} 个
      </p>
      <p v-if="actionError" class="error">⚠ {{ actionError }}</p>
    </section>

    <section class="settings-section">
      <h3>回收站</h3>
      <button class="btn btn-danger" @click="showEmptyModal = true">清空回收站</button>
    </section>

    <button class="btn btn-ghost" @click="router.push('/')">← 返回</button>

    <!-- ── 导入预览弹窗 ─────────────────────────────── -->
    <Teleport to="body">
      <div v-if="importPreview" class="modal-overlay" @click.self="closeImport">
        <div class="modal modal-wide">
          <h3 class="modal-title">导入预览</h3>
          <p class="modal-sub">备份包：<b>{{ importPreview.zipName }}</b></p>

          <div class="preview-stats">
            <div class="stat"><span class="stat-num">{{ importPreview.activeDiaryCount }}</span><span class="stat-label">篇日记</span></div>
            <div class="stat"><span class="stat-num">{{ importPreview.trashCount }}</span><span class="stat-label">篇回收站</span></div>
            <div class="stat"><span class="stat-num">{{ importPreview.attachmentCount }}</span><span class="stat-label">个附件</span></div>
            <div class="stat"><span class="stat-num">{{ importPreview.totalEntries }}</span><span class="stat-label">个文件</span></div>
          </div>

          <div v-if="importPreview.diaryCount === 0" class="warn-box">
            这个包里没有找到任何日记，可能不是 MyDiary 的备份文件。
          </div>

          <template v-else>
            <p class="merge-label">遇到同一篇日记已存在时：</p>
            <div class="merge-options">
              <label :class="['merge-opt', { active: mergeStrategy === 'skip-existing' }]">
                <input type="radio" value="skip-existing" v-model="mergeStrategy" />
                <span>
                  <b>保留现有的</b>
                  <em>（推荐）已存在的日记不动，只把新的加进来</em>
                </span>
              </label>
              <label :class="['merge-opt', { active: mergeStrategy === 'overwrite' }]">
                <input type="radio" value="overwrite" v-model="mergeStrategy" />
                <span>
                  <b>用备份包覆盖</b>
                  <em>同一天同一篇的日记，以备份包里的版本为准</em>
                </span>
              </label>
            </div>

            <div class="diary-preview-list">
              <div v-for="d in importPreview.diaries.slice(0, 30)" :key="d.id" class="preview-item">
                <span class="preview-date">{{ d.date }}</span>
                <span class="preview-title">{{ d.title || '无标题' }}</span>
                <span v-if="d.inTrash || d.deletedAt" class="preview-flag">回收站中</span>
              </div>
              <p v-if="importPreview.diaries.length > 30" class="muted preview-more">
                …… 还有 {{ importPreview.diaries.length - 30 }} 篇未显示
              </p>
            </div>
          </template>

          <p v-if="actionError" class="error">⚠ {{ actionError }}</p>

          <div class="modal-actions">
            <button class="btn modal-cancel" @click="closeImport">取消</button>
            <button
              class="btn modal-confirm"
              :disabled="importPreview.diaryCount === 0 || busy.import"
              @click="doImport"
            >
              {{ busy.import ? '导入中…' : '确认导入' }}
            </button>
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
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDiaryStore } from '@/stores/diary'
import { useUiStore } from '@/stores/ui'
import { useSecurityStore } from '@/stores/security'

const router = useRouter()
const ui = useUiStore()
const security = useSecurityStore()
const store = useDiaryStore()

const encryptedCount = computed(() => store.countEncrypted())

const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordSuccess = ref('')
const config = ref(null)
const showEmptyModal = ref(false)

const busy = reactive({ export: false, import: false })
const exportResult = ref(null)
const actionError = ref('')

const importPreview = ref(null)
const importResult = ref(null)
const mergeStrategy = ref('skip-existing')

onMounted(async () => {
  if (window.electronAPI) {
    config.value = await window.electronAPI.getConfig()
  }
  await security.loadConfig()
  // 需要篇数来提示"还有几篇加密日记"，也用于判断能否移除主密码
  try { await store.fetchDiaries() } catch { /* 忽略 */ }
})

const canSetPassword = computed(() => {
  return newPassword.value.length >= 6 && newPassword.value === confirmPassword.value
})

async function setMasterPassword() {
  passwordError.value = ''
  passwordSuccess.value = ''
  if (newPassword.value.length < 6) {
    passwordError.value = '密码至少 6 位'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = '两次密码不一致'
    return
  }
  try {
    await security.setMasterPassword(newPassword.value)
    newPassword.value = ''
    confirmPassword.value = ''
    config.value = { ...(config.value || {}), masterPasswordSet: true }
    passwordSuccess.value = '主密码已设置，当前处于已解锁状态'
  } catch (e) {
    passwordError.value = '设置失败：' + (e?.message || e)
  }
}

function lockNow() {
  security.lock()
  passwordSuccess.value = '已锁定，需要密码才能查看加密日记'
  // 跳首页会因门禁自动转到解锁页
  router.push('/')
}

async function removePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''
  try {
    await security.removeMasterPassword(encryptedCount.value)
    config.value = { ...(config.value || {}), masterPasswordSet: false }
    passwordSuccess.value = '主密码已移除'
  } catch (e) {
    passwordError.value = e?.message || String(e)
  }
}

async function setTheme(theme) {
  // 走共享 store：既立即改变界面，又合并写回配置（不会抹掉其它设置项）
  await ui.setTheme(theme)
  config.value = { ...(config.value || {}), theme }
}

// ── 导出整库 ZIP ─────────────────────────────────────────
async function exportZip() {
  actionError.value = ''
  exportResult.value = null
  if (!window.electronAPI?.exportLibraryZip) {
    actionError.value = 'ZIP 导出需要在桌面客户端中使用'
    return
  }
  busy.export = true
  try {
    const res = await window.electronAPI.exportLibraryZip()
    // res 为 null 表示用户在弹出的保存对话框里点了取消 —— 不是失败，静默处理
    if (res?.zipPath) exportResult.value = res
  } catch (e) {
    actionError.value = '导出失败：' + (e?.message || e)
  } finally {
    busy.export = false
  }
}

// ── 导入 ZIP ─────────────────────────────────────────────
async function startImport() {
  actionError.value = ''
  importResult.value = null
  if (!window.electronAPI?.inspectImportZip) {
    actionError.value = 'ZIP 导入需要在桌面客户端中使用'
    return
  }
  busy.import = true
  try {
    const info = await window.electronAPI.inspectImportZip()
    if (info) importPreview.value = info
  } catch (e) {
    actionError.value = '读取备份包失败：' + (e?.message || e)
  } finally {
    busy.import = false
  }
}

async function doImport() {
  if (!importPreview.value) return
  actionError.value = ''
  busy.import = true
  try {
    const res = await window.electronAPI.importLibraryZip({
      zipFile: importPreview.value.zipFile,
      strategy: mergeStrategy.value,
    })
    importResult.value = res
    // 导入成功后关闭弹窗，结果改为显示在设置页上（避免弹窗一直挡着）
    importPreview.value = null
    // 刷新列表，让刚导入的日记立刻出现在首页
    await store.fetchDiaries()
    await store.fetchTrash()
  } catch (e) {
    // 失败时保留弹窗（importPreview 不清空），用户能看到错误并重试
    actionError.value = '导入失败：' + (e?.message || e)
  } finally {
    busy.import = false
  }
}

function closeImport() {
  importPreview.value = null
  importResult.value = null
  actionError.value = ''
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return n.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

function doEmptyTrash() {
  showEmptyModal.value = false
  store.emptyTrash()
}
</script>

<style scoped>
.settings-page { display: flex; flex-direction: column; gap: 28px; }
.settings-page h2 { font-size: 22px; color: var(--fg); }
.settings-section {
  background: var(--card-bg); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px;
}
.settings-section h3 { font-size: 15px; color: var(--accent); margin-bottom: 8px; }
.section-desc { font-size: 13px; opacity: 0.6; margin-bottom: 12px; line-height: 1.6; }
.setting-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.setting-row label { font-size: 14px; display: flex; align-items: center; gap: 8px; }
.password-form { display: flex; flex-direction: column; gap: 8px; }
.pw-input {
  padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg); color: var(--fg); font-size: 14px; outline: none;
}
.pw-input:focus { border-color: var(--accent); }
.error { color: #e74c3c; font-size: 13px; word-break: break-all; }
.success { color: #27ae60; font-size: 13px; word-break: break-all; }
.muted { opacity: 0.55; }
.theme-row { display: flex; gap: 8px; flex-wrap: wrap; }
.theme-btn {
  padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border);
  background: transparent; color: var(--fg); cursor: pointer; font-size: 13px;
}
.theme-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

.export-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }

.btn-danger {
  background: #e74c3c; color: #fff; border: none;
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
}
.btn-danger:hover { opacity: 0.85; }
.btn-ghost {
  background: transparent; border: 1px solid var(--border); color: var(--fg);
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
  align-self: flex-start;
}
.btn-primary {
  background: var(--accent); color: #fff;
  padding: 8px 16px; border-radius: 8px; border: none;
  cursor: pointer; font-size: 13px;
}
.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline {
  background: transparent; color: var(--accent); border: 1px solid var(--accent);
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
}
.btn-outline:hover:not(:disabled) { background: var(--accent); color: #fff; }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }

/* 模态框 */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: var(--card-bg, #f4f6fa); border: 1px solid var(--border, #e0e4ec);
  border-radius: 12px; padding: 24px; min-width: 320px; max-width: 420px;
}
.modal-wide { max-width: 560px; width: 90vw; max-height: 82vh; overflow-y: auto; }
.modal-title { font-size: 17px; color: var(--fg); margin-bottom: 6px; }
.modal-sub { font-size: 13px; opacity: 0.7; margin-bottom: 16px; }
.modal p { font-size: 15px; color: var(--fg, #1a1a2e); margin-bottom: 8px; }
.modal-hint { font-size: 13px; opacity: 0.5; margin-bottom: 16px; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; }
.modal-cancel {
  background: transparent; border: 1px solid var(--border, #e0e4ec); color: var(--fg, #1a1a2e);
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
}
.modal-cancel:hover { opacity: 0.8; }
.modal-confirm {
  background: var(--accent); border: none; color: #fff;
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
}
.modal-confirm:hover:not(:disabled) { opacity: 0.85; }
.modal-confirm:disabled { opacity: 0.45; cursor: not-allowed; }

/* 导入预览 */
.preview-stats { display: flex; gap: 10px; margin-bottom: 16px; }
.stat {
  flex: 1; background: var(--bg); border: 1px solid var(--border);
  border-radius: 10px; padding: 12px; text-align: center;
}
.stat-num { display: block; font-size: 22px; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 12px; opacity: 0.6; }
.warn-box {
  background: rgba(231,76,60,0.1); border: 1px solid rgba(231,76,60,0.4);
  color: #e74c3c; font-size: 13px; padding: 10px 12px; border-radius: 8px;
}
.merge-label { font-size: 13px; opacity: 0.7; margin: 14px 0 8px; }
.merge-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.merge-opt {
  display: flex; gap: 10px; align-items: flex-start; cursor: pointer;
  border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px;
  transition: border-color 0.15s;
}
.merge-opt.active { border-color: var(--accent); background: rgba(74,108,247,0.07); }
.merge-opt input { margin-top: 3px; }
.merge-opt span { display: flex; flex-direction: column; gap: 2px; }
.merge-opt b { font-size: 13.5px; color: var(--fg); }
.merge-opt em { font-size: 12px; font-style: normal; opacity: 0.6; }

.diary-preview-list {
  max-height: 200px; overflow-y: auto; border: 1px solid var(--border);
  border-radius: 8px; padding: 6px;
}
.preview-item {
  display: flex; align-items: center; gap: 10px;
  padding: 5px 8px; font-size: 12.5px; border-radius: 5px;
}
.preview-item:nth-child(odd) { background: var(--bg); }
.preview-date { opacity: 0.55; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.preview-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-flag {
  font-size: 11px; color: #e67e22; border: 1px solid #e67e22;
  border-radius: 8px; padding: 0 6px; flex-shrink: 0;
}
.preview-more { font-size: 12px; padding: 6px; }
</style>
