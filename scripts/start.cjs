/**
 * 启动脚本 —— 解决 ELECTRON_RUN_AS_NODE 环境变量问题
 *
 * 背景：
 *   本机存在全局环境变量 ELECTRON_RUN_AS_NODE=1，它会强制 Electron 退化成
 *   普通 Node.js，导致 app 模块为 undefined，软件无法启动（报错
 *   "Cannot read properties of undefined (reading 'whenReady')"）。
 *
 * 关键：必须把变量【从环境中删除】，而不是置为空字符串或 0。
 *   实测：cross-env ELECTRON_RUN_AS_NODE=  → 仍然退化成 Node（变量仍存在）
 *         env -u / delete                   → 正常启动 Electron
 *
 * 所以这里用 Node 直接 delete 掉它，再拉起 electron 可执行文件。
 */
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

// ── 1. 彻底移除该变量 ─────────────────────────────────────
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

// --dev 参数：连接 Vite 开发服务器（npm run dev 用）
if (process.argv.includes('--dev')) {
  env.VITE_DEV_SERVER_URL = 'http://localhost:5173'
}
const devMode = !!env.VITE_DEV_SERVER_URL

// --library=<路径> 或环境变量 MYDIARY_LIBRARY：直接指定日记库，省去启动弹窗
const libArg = process.argv.find(a => a.startsWith('--library='))
if (libArg) {
  env.MYDIARY_LIBRARY = libArg.slice('--library='.length)
}
const libPreview = env.MYDIARY_LIBRARY

// ── 2. 定位 electron 可执行文件 ───────────────────────────
function resolveElectron() {
  const pkgDir = path.join(__dirname, '..', 'node_modules', 'electron')
  const pathFile = path.join(pkgDir, 'path.txt')

  if (!fs.existsSync(pathFile)) {
    console.error('❌ 找不到 electron，请先执行：npm install')
    process.exit(1)
  }
  const binary = fs.readFileSync(pathFile, 'utf-8').trim()
  const exe = path.join(pkgDir, 'dist', binary)

  if (!fs.existsSync(exe)) {
    console.error('❌ Electron 二进制缺失：' + exe)
    console.error('   请执行：ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js')
    process.exit(1)
  }
  return exe
}

// ── 3. 启动应用 ───────────────────────────────────────────
const exe = resolveElectron()
const projectRoot = path.join(__dirname, '..')

console.log('🚀 启动 MyDiary（已清除 ELECTRON_RUN_AS_NODE）')
console.log('   模式：' + (devMode ? '开发（连接 ' + env.VITE_DEV_SERVER_URL + '）' : '生产（读取 dist/）'))
if (libPreview) console.log('   日记库：' + libPreview)
console.log('   ' + exe + ' ' + projectRoot)

const child = spawn(exe, ['.'], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
  windowsHide: false,
})

child.on('close', code => {
  if (code === 0) process.exit(0)
  console.error('❌ MyDiary 退出，代码：' + code)
  process.exit(code ?? 1)
})

// 转发退出信号，保证 Ctrl+C 能干净地关掉
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { if (!child.killed) child.kill(sig) })
}
