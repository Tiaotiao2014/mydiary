@echo off
chcp 65001 >nul
title MyDiary 环境安装
cd /d "%~dp0"

echo.
echo  ============================================
echo    MyDiary 一键环境安装
echo  ============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [错误] 未检测到 Node.js！
    echo.
    echo  请先安装 Node.js 18 或更高版本：
    echo    官网 https://nodejs.org/zh-cn 下载 LTS 版本
    echo    或使用 winget install OpenJS.NodeJS.LTS
    echo  安装完成后，重新双击本脚本即可。
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node --version') do set "NODE_VER=%%v"
echo  [1/3] 已检测到 Node.js %NODE_VER%
echo.

echo  [2/3] 正在安装依赖，首次约需 2-5 分钟，请耐心等待...
echo.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo  [错误] 依赖安装失败。
    echo  常见原因：网络不通。国内网络可尝试改用镜像后重跑：
    echo    npm config set registry https://registry.npmmirror.com
    echo.
    pause
    exit /b 1
)

echo.
echo  [3/3] 安装完成！
echo.
echo  ============================================
echo    启动方式：双击 start.bat
echo    或在命令行运行：npm start
echo  ============================================
echo.
pause
