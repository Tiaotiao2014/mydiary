const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 库 & 配置
  getLibraryPath: () => ipcRenderer.invoke('get-library-path'),
  getConfig: () => ipcRenderer.invoke('get-config'),

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

  // 附件
  saveAttachment: (data) => ipcRenderer.invoke('save-attachment', data),
})
