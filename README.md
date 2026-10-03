# MyDiary

纯本地日记软件，无云依赖，MIT 开源。

## 功能特性

- **富文本编辑**：加粗/斜体/删除线、多级标题、列表、引用、代码块、水平线
- **表格支持**：可调整列宽的表格，支持表头、增删行列、合并/拆分单元格、单元格对齐
- **数学公式**：行内 LaTeX 公式 `$...$`（KaTeX 渲染）
- **图片附件**：本地存储，正文引用相对路径
- **标签系统**：自建标签，按标签筛选
- **全文搜索**：搜索标题、正文、标签
- **双层加密**：主密码（AES-256-GCM + PBKDF2）+ 单篇锁
- **自动保存**：停止输入 2 秒后自动落盘
- **回收站**：删除进回收站，30 天内可恢复
- **导出**：整库 ZIP；单篇 HTML / Markdown / Excel(CSV)
- **导入**：ZIP 备份恢复，支持预览清单与智能合并（已存在则跳过，或按包覆盖）；**回收站内容一并还原**
- **主题**：浅色 / 深色 / 跟随系统

## 数据存储结构

```
<日记库根目录>/
  config.json          # 全局设置
  diaries/             # 所有日记
    2026-10-01/
      a1b2c3d4/
        diary.json     # 元数据 + Tiptap JSON 正文
  attachments/         # 图片附件（UUID 命名）
  .trash/              # 回收站
```

## 开发环境要求

- Node.js >= 18
- npm >= 9
- Git

## 备份与还原（导入 / 导出）

入口：应用内 **设置 → 备份与迁移**。

- **导出整库 ZIP**：把整个日记库（`diaries/`、`attachments/`、`.trash/`）打包，落到系统下载目录。
- **导入 ZIP 备份**：选择备份包 → 展示预览清单（日记数 / 回收站数 / 附件数 / 文件数）→ 选择合并策略 → 确认导入。

合并策略（遇到同 id 的日记已存在时）：

| 策略 | 行为 |
|---|---|
| 保留现有的（默认） | 已存在的日记不动，只导入新的 |
| 用备份包覆盖 | 同 id 以备份包版本为准 |

说明：

- **回收站（`.trash/`）中的日记会被一并还原**到新库的回收站，`deletedAt` 保留。
- 附件复用原名（UUID），已存在则跳过，不会重复占用空间。
- 备份包中的 `config.json` **不会**覆盖目标库设置，避免主题、主密码等配置被意外改动。

## 开发

```bash
# 安装依赖
npm install

# 启动应用（推荐）—— 会自动处理 ELECTRON_RUN_AS_NODE 环境变量问题
npm start

# 开发模式（Vite 热更新 + Electron）
npm run dev

# 仅构建前端
npm run build:vite

# 完整构建（前端 + 安装包）
npm run build
```

### ⚠️ 启动注意事项

**不要用 `npm run start` 之外的 `electron .` 直接启动**，也**不要**把 `package.json` 里的
`start` 脚本改回 `electron .`。原因：

本机环境存在全局变量 `ELECTRON_RUN_AS_NODE=1`，它会让 Electron 退化成普通 Node.js，
表现为启动时报错：

```
TypeError: Cannot read properties of undefined (reading 'whenReady')
```

`npm start` 走的是 `scripts/start.cjs`，它会**真正删除**这个变量后再拉起 Electron。
注意：**置空（`ELECTRON_RUN_AS_NODE=`）或设为 `0` 都无效**——Electron 只判断变量是否存在。

### 指定日记库位置

首次启动会弹出文件夹选择框。若想跳过弹窗（或用于调试/自动化），可用环境变量：

```bash
# 方式一：环境变量
MYDIARY_LIBRARY="D:/我的日记库" npm start

# 方式二：命令行参数
npm start -- --library="D:/我的日记库"
```

如果启动后窗口白屏或闪退，多半是 GPU 渲染问题。`electron/main.js` 已默认关闭硬件加速
（`app.disableHardwareAcceleration()`）以适配虚拟机/远程桌面环境。若你的机器支持硬件
加速并希望开启，把 `main.js` 顶部那几行 `app.commandLine.appendSwitch(...)` 注释掉即可。

## 构建安装包

```bash
# 需要预装 electron-builder
npm run build
# 产物在 dist_electron/
```

## 技术栈

| 模块 | 技术 |
|------|------|
| 外壳 | Electron 31 |
| 界面 | Vue 3 + Vite |
| 编辑器 | Tiptap（ProseMirror） |
| 公式 | KaTeX |
| 状态管理 | Pinia |
| 存储 | 本地文件系统（electron-store 配置） |
| 加密 | Web Crypto（AES-256-GCM + PBKDF2） |

## 许可证

MIT
