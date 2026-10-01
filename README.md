# MyDiary

纯本地日记软件，无云依赖，MIT 开源。

## 功能特性

- **富文本编辑**：加粗/斜体/删除线、多级标题、列表、引用、代码块、水平线
- **表格支持**：可调整大小的表格，支持表头
- **数学公式**：LaTeX 公式（KaTeX 渲染）
- **图片附件**：本地存储，正文引用相对路径
- **标签系统**：自建标签，按标签筛选
- **全文搜索**：搜索标题、正文、标签
- **双层加密**：主密码（AES-256-GCM + PBKDF2）+ 单篇锁
- **自动保存**：停止输入 2 秒后自动落盘
- **回收站**：删除进回收站，30 天内可恢复
- **导出**：单条 HTML；整库 ZIP
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

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式（Vite dev server + Electron）
npm run dev

# 仅构建前端
npm run build:vite

# 完整构建（前端 + 安装包）
npm run build
```

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
