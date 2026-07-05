@echo off
chcp 65001 >nul
REM =============================================
REM TimeBlock 服务器一键启动脚本 - Windows 版
REM =============================================

title TimeBlock Server

echo.
echo ╔══════════════════════════════════════════════╗
echo ║     TimeBlock 服务器一键启动 (Windows)       ║
echo ╚══════════════════════════════════════════════╝
echo.

REM 切换到脚本所在目录
cd /d "%~dp0"

REM 检查 Node.js 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] Node.js 未安装
    echo [提示] 请从 https://nodejs.org/ 下载安装 Node.js
    pause
    exit /b 1
)

REM 显示 Node.js 版本
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [信息] Node.js 版本: %NODE_VERSION%

REM 执行启动脚本
node start.js

REM 如果服务器异常退出，暂停以查看错误信息
if %errorlevel% neq 0 (
    echo.
    echo [错误] 服务器异常退出 (code: %errorlevel%)
    pause
)

exit /b %errorlevel%