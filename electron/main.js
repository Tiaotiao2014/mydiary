const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const Store = require('electron-store')

// 某些机器/虚拟化环境里 GPU 进程会反复崩溃（exit_code=-1073741819），
// 导致窗口无法渲染。显式关掉硬件加速，改用软件渲染即可稳定启动。
// 如需恢复硬件加速，把下面几行注释掉即可。
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('disable-software-rasterizer')

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

// ── 应用菜单栏 ────────────────────────────────────────────
// 不设置的话，Electron 会启用默认菜单，顶层是英文的
// File / Edit / View / Window / Help。这里整体改为中文。
// 各项用 role 指定，保证行为与系统标准一致（撤销/复制/缩放等）。
function buildAppMenu() {
  const isMac = process.platform === 'darwin'

  const template = [
    // macOS 习惯：第一项是以应用名命名的菜单
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: '文件',
      submenu: [
        isMac
          ? { role: 'close', label: '关闭窗口' }
          : { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏显示' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭窗口' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 MyDiary',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 MyDiary',
              message: 'MyDiary',
              detail: '版本 ' + app.getVersion() + '\n纯本地日记软件，数据保存在你自己的电脑上。',
              buttons: ['确定'],
              noLink: true,
            })
          },
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
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
  buildAppMenu()

  let libraryPath = getLibraryPath()

  // 支持用环境变量指定日记库，方便调试/自动化，省去弹窗：
  //   MYDIARY_LIBRARY=D:\你的库路径 npm start
  // 注意：必须写回 store，否则其他 IPC handler 通过 getLibraryPath() 取不到路径，
  // 会导致「能看不能写」（新建/保存报 Library not initialized）。
  if (!libraryPath && process.env.MYDIARY_LIBRARY) {
    libraryPath = process.env.MYDIARY_LIBRARY
    if (!fs.existsSync(libraryPath)) fs.mkdirSync(libraryPath, { recursive: true })
    store.set('libraryPath', libraryPath)
    console.log('[MyDiary] 使用环境变量 MYDIARY_LIBRARY 指定的库：' + libraryPath)
  }

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
  }

  // 确保目录结构齐全（无论库路径来自何处）
  initLibrary(libraryPath)
  console.log('[MyDiary] 日记库：' + libraryPath)
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
    const diaryFile = path.join(srcDir, 'diary.json')
    if (fs.existsSync(diaryFile)) {
      try {
        const d = JSON.parse(fs.readFileSync(diaryFile, 'utf-8'))
        d.deletedAt = new Date().toISOString()
        fs.writeFileSync(diaryFile, JSON.stringify(d, null, 2))
      } catch { /* ignore */ }
    }
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
    for (const entry of fs.readdirSync(trashDir)) {
      fs.rmSync(path.join(trashDir, entry), { recursive: true, force: true })
    }
  }
  return true
})

ipcMain.handle('permanent-delete-trash', (_e, { date, id }) => {
  const lib = getLibraryPath()
  if (!lib) throw new Error('Library not initialized')
  const trashDir = path.join(lib, '.trash', `${date}_${id}`)
  if (fs.existsSync(trashDir)) {
    fs.rmSync(trashDir, { recursive: true, force: true })
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

// ── 导出：整库 ZIP ────────────────────────────────────────
// 关键点：必须等流真正写完（output 触发 close）再 resolve，
// 否则前端会以为"导出成功"，实际拿到的是 0 字节或残缺的压缩包。
ipcMain.handle('export-library-zip', async () => {
  const lib = getLibraryPath()
  if (!lib) throw new Error('Library not initialized')

  // 让用户自己选保存位置（原先直接写死到系统下载目录，用户无法选择）
  const today = new Date().toISOString().slice(0, 10)
  const pick = await dialog.showSaveDialog(mainWindow, {
    title: '选择备份包的保存位置',
    defaultPath: path.join(app.getPath('downloads'), `日记库备份_${today}.zip`),
    filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }],
  })
  // 用户点了取消：返回 null，界面不显示"已导出"
  if (pick.canceled || !pick.filePath) return null

  const zipPath = pick.filePath
  const archiver = require('archiver')

  return await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => resolve({ zipPath, size: archive.pointer() }))
    output.on('error', reject)
    archive.on('error', reject)
    archive.on('warning', err => {
      if (err.code === 'ENOENT') console.warn('[zip warning]', err)
      else reject(err)
    })

    archive.pipe(output)
    // 整个日记库目录打进去，压缩包内顶层目录名固定为 mydiary
    archive.directory(lib, 'mydiary')
    archive.finalize()
  })
})

// ── 导入工具 ──────────────────────────────────────────────
function walkZipEntries(zipFile) {
  return new Promise((resolve, reject) => {
    const yauzl = require('yauzl')
    const entries = []
    yauzl.open(zipFile, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err)
      zip.on('entry', entry => {
        if (/\/$/.test(entry.fileName)) { zip.readEntry(); return }
        entries.push(entry.fileName)
        zip.readEntry()
      })
      zip.on('end', () => resolve(entries))
      zip.on('error', reject)
      zip.readEntry()
    })
  })
}

// 从条目名里解析日记位置，支持两类：
//   正常日记：diaries/<date>/<id>/diary.json
//   回收站：  .trash/<date>_<id>/diary.json
// 注意：导出时整个库目录都会被打包，回收站内容也在其中；若只认 diaries/，
// 回收站日记会在导入时被静默丢弃，导致"整库还原"不完整。
// 实现见 electron/lib/zip-paths.js（纯函数，有单测）。
const { parseDiaryEntry, resolveDiaryDest } = require('./lib/zip-paths')

// 读一个 zip 条目为 Buffer
function readEntryBuffer(zip, entry) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, rs) => {
      if (err) return reject(err)
      const chunks = []
      rs.on('data', c => chunks.push(c))
      rs.on('end', () => resolve(Buffer.concat(chunks)))
      rs.on('error', reject)
    })
  })
}

// 步骤一：让用户选 ZIP，返回清单供预览（不落盘）
ipcMain.handle('inspect-import-zip', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择要导入的 MyDiary 备份包',
    filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }],
    properties: ['openFile'],
  })
  if (result.canceled || !result.filePaths?.length) return null
  const zipFile = result.filePaths[0]

  const allEntries = await walkZipEntries(zipFile)
  const yauzl = require('yauzl')

  const metas = await new Promise((resolve, reject) => {
    const out = []
    yauzl.open(zipFile, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err)
      zip.on('entry', async entry => {
        if (/\/$/.test(entry.fileName)) { zip.readEntry(); return }
        const parsed = parseDiaryEntry(entry.fileName)
        if (!parsed) { zip.readEntry(); return }
        try {
          const buf = await readEntryBuffer(zip, entry)
          const d = JSON.parse(buf.toString('utf-8'))
          out.push({
            id: d.id || parsed.id || parsed.folder || '',
            date: d.date || parsed.date || '',
            title: d.title || '',
            tags: d.tags || [],
            deletedAt: d.deletedAt || null,
            // inTrash：来自 .trash/ 的条目，导入后会还原到回收站
            inTrash: parsed.kind === 'trash',
          })
        } catch { /* 跳过损坏项 */ }
        zip.readEntry()
      })
      zip.on('end', () => resolve(out))
      zip.on('error', reject)
      zip.readEntry()
    })
  })

  const attachmentCount = allEntries.filter(n => /(?:^|\/)attachments\//.test(String(n).replace(/\\/g, '/'))).length

  const trashCount = metas.filter(m => m.inTrash).length
  return {
    zipFile,
    zipName: path.basename(zipFile),
    totalEntries: allEntries.length,
    diaries: metas,
    diaryCount: metas.length,
    trashCount,
    activeDiaryCount: metas.length - trashCount,
    attachmentCount,
  }
})

// 步骤二：执行导入（A 方案：智能合并）
// strategy:
//   'skip-existing' —— 已存在同 id 的跳过（默认，最安全）
//   'overwrite'     —— 已存在同 id 的用包内版本覆盖
ipcMain.handle('import-library-zip', async (_e, { zipFile, strategy = 'skip-existing' }) => {
  const lib = getLibraryPath()
  if (!lib) throw new Error('Library not initialized')
  if (!zipFile || !fs.existsSync(zipFile)) throw new Error('备份包不存在')

  const yauzl = require('yauzl')
  const diariesDir = path.join(lib, 'diaries')
  const attachmentsDir = path.join(lib, 'attachments')
  const trashDir = path.join(lib, '.trash')
  fs.mkdirSync(diariesDir, { recursive: true })
  fs.mkdirSync(attachmentsDir, { recursive: true })
  fs.mkdirSync(trashDir, { recursive: true })

  // trashed = 从备份还原回回收站的篇数（单独统计，便于界面如实反馈）
  const stats = { added: 0, overwritten: 0, skipped: 0, trashed: 0, attachments: 0, failed: 0 }

  await new Promise((resolve, reject) => {
    yauzl.open(zipFile, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err)
      zip.on('entry', async entry => {
        const name = String(entry.fileName).replace(/\\/g, '/')
        if (/\/$/.test(name)) { zip.readEntry(); return }
        try {
          const buf = await readEntryBuffer(zip, entry)
          const diaryMeta = parseDiaryEntry(name)
          if (diaryMeta) {
            const dest = resolveDiaryDest(lib, diaryMeta)
            const exists = fs.existsSync(dest)
            if (exists && strategy === 'skip-existing') {
              stats.skipped++
            } else {
              fs.mkdirSync(path.dirname(dest), { recursive: true })
              fs.writeFileSync(dest, buf)
              if (exists) stats.overwritten++
              else stats.added++
              if (diaryMeta.kind === 'trash') stats.trashed++
            }
          } else if (/attachments\//.test(name)) {
            // 附件按 UUID 命名，同名即同一文件，已存在就跳过
            const filename = path.basename(name)
            const target = path.join(attachmentsDir, filename)
            if (!fs.existsSync(target)) {
              fs.writeFileSync(target, buf)
              stats.attachments++
            }
          }
          // 其余条目（config.json 等）不写入目标库，避免污染现有设置
        } catch {
          stats.failed++
        }
        zip.readEntry()
      })
      zip.on('end', resolve)
      zip.on('error', reject)
      zip.readEntry()
    })
  })

  return { ...stats, libraryPath: lib }
})

// 保存导出文件（HTML / Markdown / CSV 等）—— 让用户自己选保存位置
ipcMain.handle('save-export-file', async (_e, { filename, data }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存导出文件',
    defaultPath: path.join(app.getPath('downloads'), filename),
  })
  if (result.canceled || !result.filePath) return null
  const base64 = String(data).split(',')[1] || ''
  fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'))
  return result.filePath
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
