const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const Store = require('electron-store')

const store = new Store({ name: 'mydiary-config' })

let mainWindow

function createWindow() {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  const isDev = !!devServerUrl

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  // 首次运行：让用户选择日记库位置
  let libraryPath = store.get('libraryPath')
  if (!libraryPath) {
    const result = dialog.showOpenDialogSync(mainWindow, {
      title: '请选择日记库存放位置',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result && result[0]) {
      libraryPath = result[0]
      store.set('libraryPath', libraryPath)
      initLibrary(libraryPath)
    } else {
      // 取消则使用默认位置
      libraryPath = path.join(app.getPath('documents'), 'MyDiary')
      store.set('libraryPath', libraryPath)
      initLibrary(libraryPath)
    }
  }
  createWindow()
})

function initLibrary(rootPath) {
  const dirs = [
    rootPath,
    path.join(rootPath, 'diaries'),
    path.join(rootPath, 'attachments'),
    path.join(rootPath, '.trash'),
  ]
  dirs.forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  })
  const configPath = path.join(rootPath, 'config.json')
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ theme: 'system', defaultEncrypt: false }, null, 2))
  }
}

// IPC handlers
ipcMain.handle('get-library-path', () => store.get('libraryPath'))
ipcMain.handle('get-config', () => {
  const libPath = store.get('libraryPath')
  if (!libPath) return null
  const configPath = path.join(libPath, 'config.json')
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  }
  return null
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
