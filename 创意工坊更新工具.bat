@echo off
setlocal EnableExtensions
chcp 65001 >nul
title 轮回战场 - 创意工坊更新工具

set "ROOT=%~dp0"
set "UPDATER=%ROOT%cloudflare\scripts\update-servers.mjs"

if not exist "%UPDATER%" (
  echo.
  echo [错误] 找不到创意工坊更新脚本：
  echo %UPDATER%
  echo.
  echo 请把这个 BAT 放在“轮回战场”仓库根目录后再运行。
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [错误] 没有找到 Node.js。
  echo 请先安装 Node.js 22 或更高版本。
  echo.
  pause
  exit /b 1
)

node -e "const m=Number(process.versions.node.split('.')[0]);process.exit(m>=22?0:1)" >nul 2>nul
if errorlevel 1 (
  echo.
  echo [错误] Node.js 版本过低，需要 Node.js 22 或更高版本。
  node -v
  echo.
  pause
  exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo [错误] 没有找到 Git。
  echo 请先安装 Git for Windows，并确保 git 命令可用。
  echo.
  pause
  exit /b 1
)

:MENU
cls
echo ============================================================
echo              轮回战场 · 创意工坊更新工具
echo ============================================================
echo.
echo   [1] 更新测试服
echo       main  -^> staging D1 / KV / R2 / Worker
echo.
echo   [2] 更新正式服
echo       workshop-stable -^> production
echo       会要求再次输入 PRODUCTION 确认
echo.
echo   [3] 依次更新测试服 + 正式服
echo.
echo   [4] 只检查测试服，不执行迁移和部署
echo.
echo   [5] 只检查正式服，不执行迁移和部署
echo.
echo   [6] 两个环境都只检查，不执行迁移和部署
echo.
echo   [7] 查看当前 main / workshop-stable 版本
echo.
echo   [0] 退出
echo.
echo ------------------------------------------------------------
echo 正式客户端发布（推进 workshop-stable + 创建版本 Tag）
echo 仍由 GitHub 的 creative-workshop-promote-stable 执行。
echo 服务器更新与客户端正式发布是两件不同的事。
echo ------------------------------------------------------------
echo.

choice /c 12345670 /n /m "请选择 [1-7,0]："
set "CHOICE=%errorlevel%"

if "%CHOICE%"=="8" goto :EOF
if "%CHOICE%"=="7" goto :STATUS
if "%CHOICE%"=="6" goto :CHECK_BOTH
if "%CHOICE%"=="5" goto :CHECK_PRODUCTION
if "%CHOICE%"=="4" goto :CHECK_STAGING
if "%CHOICE%"=="3" goto :UPDATE_BOTH
if "%CHOICE%"=="2" goto :UPDATE_PRODUCTION
if "%CHOICE%"=="1" goto :UPDATE_STAGING
goto :MENU

:UPDATE_STAGING
call :RUN staging
goto :AFTER

:UPDATE_PRODUCTION
call :RUN production
goto :AFTER

:UPDATE_BOTH
call :RUN both
goto :AFTER

:CHECK_STAGING
call :RUN staging --dry-run
goto :AFTER

:CHECK_PRODUCTION
call :RUN production --dry-run
goto :AFTER

:CHECK_BOTH
call :RUN both --dry-run
goto :AFTER

:STATUS
cls
echo ============================================================
echo                    当前发布指针
echo ============================================================
echo.
git -C "%ROOT%" fetch origin main workshop-stable --quiet
if errorlevel 1 (
  echo [失败] 无法读取远端 Git 信息。
  goto :AFTER
)
for /f %%A in ('git -C "%ROOT%" rev-parse --short=12 origin/main') do set "MAIN_SHA=%%A"
for /f %%A in ('git -C "%ROOT%" rev-parse --short=12 origin/workshop-stable') do set "STABLE_SHA=%%A"
for /f "delims=" %%A in ('git -C "%ROOT%" show origin/main:src/CreativeWorkshop/app/workshop-app.js ^| findstr /c:"WORKSHOP_VERSION ="') do set "MAIN_VERSION=%%A"
for /f "delims=" %%A in ('git -C "%ROOT%" show origin/workshop-stable:src/CreativeWorkshop/app/workshop-app.js ^| findstr /c:"WORKSHOP_VERSION ="') do set "STABLE_VERSION=%%A"
echo 测试通道 main：
echo   SHA     %MAIN_SHA%
echo   %MAIN_VERSION%
echo.
echo 正式通道 workshop-stable：
echo   SHA     %STABLE_SHA%
echo   %STABLE_VERSION%
echo.
goto :AFTER

:RUN
cls
echo ============================================================
echo                    正在执行，请稍候
echo ============================================================
echo.
node "%UPDATER%" %*
set "RESULT=%errorlevel%"
echo.
if "%RESULT%"=="0" (
  echo ============================================================
  echo [完成] 操作已成功结束。
  echo ============================================================
) else (
  echo ============================================================
  echo [失败] 操作没有完成，错误码：%RESULT%
  echo 请查看上方最后一段错误信息。
  echo ============================================================
)
exit /b %RESULT%

:AFTER
echo.
echo [R] 返回主菜单
echo [0] 关闭工具
echo.
choice /c R0 /n /m "请选择："
if errorlevel 2 goto :EOF
goto :MENU
