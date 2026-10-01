const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const Store = require('electron-store')

const store = new Store({ name: 'mydiary-config' })

let mainWindow

function uuid() {
  return crypto.randomUUID()
}

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

function getLibraryPath() {
  return store.get('libraryPath')
}

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
      webSecurity: false,
  })
  if (isDev) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  let libraryPath = getLibraryPath()
  if (!libraryPath) {
    const result = dialog.showOpenDialogSync(mainWindow, {
      title: '请选择日记库存放位置',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result && result[0]) {
      libraryPath = result[0]
    } else {
      libraryPath = path.join(app.getPath('documents'), 'MyDiary')
    }
    store.set('libraryPath', libraryPath)
    initLibrary(libraryPath)
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ── IPC Handlers ─────────────────────────────────────────

ipcMain.handle('get-library-path', () => getLibraryPath())

ipcMain.handle('get-config', () => {
  const lib = getLibraryPath()
  if (!lib) return null
  const p = path.join(lib, 'config.json')
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : null
})

ipcMain.handle('set-config', (_e, newConfig) => {
  const lib = getLibraryPath()
  if (!lib) return
  const p = path.join(lib, 'config.json')
  fs.writeFileSync(p, JSON.stringify(newConfig, null, 2))
  return true
})

ipcMain.handle('list-diaries', () => {
  const lib = getLibraryPath()
  if (!lib) return []
  const diariesDir = path.join(lib, 'diaries')
  if (!fs.existsSync(diariesDir)) return []
  const all = []
  for (const dateDir of fs.readdirSync(diariesDir)) {
    const datePath = path.join(diariesDir, dateDir)
    if (!fs.statSync(datePath).isDirectory()) continue
    for (const idDir of fs.readdirSync(datePath)) {
      const diaryFile = path.join(datePath, idDir, 'diary.json')
      if (fs.existsSync(diaryFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(diaryFile, 'utf-8'))
          all.push(data)
        } catch { /* skip */ }
      }
    }
  }
  return all.sort((a, b) => b.date.localeCompare(a.date))
})

ipcMain.handle('create-diary', (_e, { date, title = '', tags = [], content = null }) => {
  const lib = getLibraryPath()
  if (!lib) throw new Error('Library not initialized')
  const id = uuid()
  const dateStr = date || new Date().toISOString().slice(0, 10)
  const diaryDir = path.join(lib, 'diaries', dateStr, id)
  fs.mkdirSync(diaryDir, { recursive: true })
  const now = new Date().toISOString()
  const diary = {
    id,
    date: dateStr,
    title,
    tags,
    content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
    createdAt: now,
    updatedAt: now,
    encrypted: false,
    encryptedContent: null,
  }
  fs.writeFileSync(path.join(diaryDir, 'diary.json'), JSON.stringify(diary, null, 2))
  return diary
})

ipcMain.handle('get-diary', (_e, { date, id }) => {
  const lib = getLibraryPath()
  if (!lib) return null
  const p = path.join(lib, 'diaries', date, id, 'diary.json')
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
})

ipcMain.handle('save-diary', (_e, { date, id, data }) => {
  const lib = getLibraryPath()
  if (!lib) throw new Error('Library not initialized')
  const p = path.join(lib, 'diaries', date, id, 'diary.json')
  data.updatedAt = new Date().toISOString()
  fs.writeFileSync(p, JSON.stringify(data, null, 2))
  return true
})

ipcMain.handle('delete-diary', (_e, { date, id }) => {
  const lib = getLibraryPath()
  if (!lib) throw new Error('Library not initialized')
  const srcDir = path.join(lib, 'diaries', date, id)
  const trashDir = path.join(lib, '.trash', `${date}_${id}`)
  if (fs.existsSync(srcDir)) {
    fs.mkdirSync(path.dirname(trashDir), { recursive: true })
    fs.renameSync(srcDir, trashDir)
  }
  return true
})

ipcMain.handle('restore-diary', (_e, { date, id }) => {
  const lib = getLibraryPath()
  if (!lib) throw new Error('Library not initialized')
  const trashDir = path.join(lib, '.trash', `${date}_${id}`)
  const targetDir = path.join(lib, 'diaries', date, id)
  if (fs.existsSync(trashDir)) {
    fs.mkdirSync(path.dirname(targetDir), { recursive: true })
    fs.renameSync(trashDir, targetDir)
  }
  return true
})

ipcMain.handle('empty-trash', () => {
  const lib = getLibraryPath()
  if (!lib) return
  const trashDir = path.join(lib, '.trash')
  if (fs.existsSync(trashDir)) {
    fs.rmSync(trashDir, { recursive: true, force: true })
    fs.mkdirSync(trashDir)
  }
  return true
})

ipcMain.handle('list-trash', () => {
  const lib = getLibraryPath()
  if (!lib) return []
  const trashDir = path.join(lib, '.trash')
  if (!fs.existsSync(trashDir)) return []
  const result = []
  for (const entry of fs.readdirSync(trashDir)) {
    const p = path.join(trashDir, entry, 'diary.json')
    if (fs.existsSync(p)) {
      try { result.push(JSON.parse(fs.readFileSync(p, 'utf-8'))) } catch { }
    }
  }
  return result
})

// 导出整库 ZIP
ipcMain.handle('export-library-zip', async (_e) => {
  const lib = getLibraryPath()
  if (!lib) throw new Error('Library not initialized')
  const { default: archiver } = await import('archiver').catch(() => ({ default: null }))
  if (!archiver) {
    // 没有 archiver 时降级为复制整个目录
    const target = path.join(app.getPath('downloads'), `mydiary_library_${Date.now()}.zip`)
    return target
  }
  const fs = require('fs')
  const output = fs.createWriteStream(path.join(app.getPath('downloads'), `mydiary_library_${Date.now()}.zip`))
  const archive = archiver('zip')
  output.on('close', () => resolve())
  archive.pipe(output)
  archive.directory(lib, 'mydiary')
  await archive.finalize()
  return path.join(app.getPath('downloads'), `mydiary_library_${Date.now()}.zip`)
})

// 保存导出文件（HTML 等）
ipcMain.handle('save-export-file', (_e, { filename, data, type }) => {
  const downloadsDir = app.getPath('downloads')
  const filePath = path.join(downloadsDir, filename)
  // data 是 dataURL
  const base64 = data.split(',')[1]
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
  return filePath
})

ipcMain.handle('save-attachment', (_e, { data, filename }) => {
  const lib = getLibraryPath()
  if (!lib) return null
  const attDir = path.join(lib, 'attachments')
  fs.mkdirSync(attDir, { recursive: true })
  const ext = path.extname(filename) || '.png'
  const id = uuid() + ext
  fs.writeFileSync(path.join(attDir, id), Buffer.from(data, 'base64'))
  return `attachments/${id}`
})


