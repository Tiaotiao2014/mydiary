@echo off
chcp 65001 >nul
title MyDiary
cd /d "%~dp0"
node scripts/start.cjs
if %errorlevel% neq 0 (
    echo.
    echo  启动失败。若尚未安装依赖，请先双击 setup.bat。
    echo.
    pause
)
