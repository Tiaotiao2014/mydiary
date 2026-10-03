#!/usr/bin/env bash
# MyDiary 一键环境安装（macOS / Linux）
set -e
cd "$(dirname "$0")"

echo
echo "  ============================================"
echo "    MyDiary 一键环境安装"
echo "  ============================================"
echo

if ! command -v node >/dev/null 2>&1; then
    echo "  [错误] 未检测到 Node.js！"
    echo
    echo "  请先安装 Node.js 18 或更高版本："
    echo "    官网 https://nodejs.org/zh-cn 下载 LTS 版本"
    echo "    macOS 可用:  brew install node"
    echo "    Ubuntu 可用: sudo apt install nodejs npm"
    echo "  安装完成后重新运行本脚本。"
    exit 1
fi

echo "  [1/3] 已检测到 Node.js $(node --version)"
echo

echo "  [2/3] 正在安装依赖，首次约需 2-5 分钟，请耐心等待..."
echo
npm install

echo
echo "  [3/3] 安装完成！"
echo
echo "  ============================================"
echo "    启动方式：npm start"
echo "  ============================================"
echo
