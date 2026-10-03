const { contextBridge, ipcRenderer } = require('electron')

/**
 * 注意：这里无法修复 "An object could not be cloned."。
 *
 * contextBridge 暴露的方法被前端调用时，参数会先在「主世界 → 隔离世界」
 * 的边界完成序列化；若参数里含 Vue 响应式 Proxy，错误在进入本文件之前
 * 就已经抛出，因此转换必须在前端（见 src/stores/diary.js 的 toPlain）。
 * 这里保持最简实现，避免造成"已在此处理"的误解。
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // 库 & 配置
  getLibraryPath: () => ipcRenderer.invoke('get-library-path'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config) => ipcRenderer.invoke('set-config', config),

  // 日记 CRUD
  listDiaries: () => ipcRenderer.invoke('list-diaries'),
  createDiary: (data) => ipcRenderer.invoke('create-diary', data),
  getDiary: (params) => ipcRenderer.invoke('get-diary', params),
  saveDiary: (params) => ipcRenderer.invoke('save-diary', params),
  deleteDiary: (params) => ipcRenderer.invoke('delete-diary', params),
  restoreDiary: (params) => ipcRenderer.invoke('restore-diary', params),

  // 回收站
  listTrash: () => ipcRenderer.invoke('list-trash'),
  emptyTrash: () => ipcRenderer.invoke('empty-trash'),
  permanentDeleteTrash: (params) => ipcRenderer.invoke('permanent-delete-trash', params),

  // 附件
  saveAttachment: (data) => ipcRenderer.invoke('save-attachment', data),

  // 导出 / 导入
  exportLibraryZip: () => ipcRenderer.invoke('export-library-zip'),
  saveExportFile: (data) => ipcRenderer.invoke('save-export-file', data),
  inspectImportZip: () => ipcRenderer.invoke('inspect-import-zip'),
  importLibraryZip: (params) => ipcRenderer.invoke('import-library-zip', params),
})
