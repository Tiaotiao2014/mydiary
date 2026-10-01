const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getLibraryPath: () => ipcRenderer.invoke('get-library-path'),
  getConfig: () => ipcRenderer.invoke('get-config'),
})
