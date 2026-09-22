@echo off
setlocal EnableExtensions
chcp 65001 >nul
title 轮回战场 - 创意工坊发布工具

set "ROOT=%~dp0"
set "UPDATER=%ROOT%cloudflare\scripts\update-servers.mjs"
set "PUBLISHER=%ROOT%cloudflare\scripts\promote-stable.mjs"

if not exist "%UPDATER%" (
  echo.
  echo [错误] 找不到服务器更新脚本：
  echo %UPDATER%
  echo.
  echo 请确认这个 BAT 位于“轮回战场”仓库根目录。
  echo.
  pause
  exit /b 1
)

if not exist "%PUBLISHER%" (
  echo.
  echo [错误] 找不到正式客户端发布脚本：
  echo %PUBLISHER%
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
echo              轮回战场 · 创意工坊发布工具
echo ============================================================
echo.
echo   [1] 更新测试服
echo       origin/main -^> staging D1 / KV / R2 / Worker
echo.
echo   [2] 发布正式客户端
echo       origin/main -^> workshop-stable + workshop-vX.Y.Z
echo       自动读取 WORKSHOP_VERSION、跑测试、创建 Tag、原子推送
echo.
echo   [3] 更新正式服务器
echo       origin/workshop-stable -^> production D1 / KV / R2 / Worker
echo       会要求再次输入 PRODUCTION 确认
echo.
echo   [4] 依次更新测试服 + 正式服务器
echo.
echo   [5] 只检查测试服，不执行迁移和部署
echo.
echo   [6] 只检查正式服务器，不执行迁移和部署
echo.
echo   [7] 两个服务器环境都只检查
echo.
echo   [8] 预演正式客户端发布，不创建 Tag、不推 stable
echo.
echo   [9] 查看当前 main / workshop-stable / 正式 Tag
echo.
echo   [0] 退出
echo.
echo ------------------------------------------------------------
echo 推荐：
echo   日常测试：选择 1
echo   正式上线：先选择 2，再选择 3
echo ------------------------------------------------------------
echo.

choice /c 1234567890 /n /m "请选择 [1-9,0]："
set "MENU_CHOICE=%errorlevel%"

if "%MENU_CHOICE%"=="10" goto :EOF
if "%MENU_CHOICE%"=="9" goto :STATUS
if "%MENU_CHOICE%"=="8" goto :PUBLISH_PREVIEW
if "%MENU_CHOICE%"=="7" goto :CHECK_BOTH
if "%MENU_CHOICE%"=="6" goto :CHECK_PRODUCTION
if "%MENU_CHOICE%"=="5" goto :CHECK_STAGING
if "%MENU_CHOICE%"=="4" goto :UPDATE_BOTH
if "%MENU_CHOICE%"=="3" goto :UPDATE_PRODUCTION
if "%MENU_CHOICE%"=="2" goto :PUBLISH_STABLE
if "%MENU_CHOICE%"=="1" goto :UPDATE_STAGING
goto :MENU

:UPDATE_STAGING
call :RUN_SERVER staging
goto :AFTER

:PUBLISH_STABLE
call :RUN_PUBLISH
goto :AFTER

:UPDATE_PRODUCTION
call :RUN_SERVER production
goto :AFTER

:UPDATE_BOTH
call :RUN_SERVER both
goto :AFTER

:CHECK_STAGING
call :RUN_SERVER staging --dry-run
goto :AFTER

:CHECK_PRODUCTION
call :RUN_SERVER production --dry-run
goto :AFTER

:CHECK_BOTH
call :RUN_SERVER both --dry-run
goto :AFTER

:PUBLISH_PREVIEW
call :RUN_PUBLISH --dry-run
goto :AFTER

:STATUS
cls
echo ============================================================
echo                    当前发布状态
echo ============================================================
echo.
git -C "%ROOT%" fetch origin main workshop-stable --tags --quiet
if errorlevel 1 (
  echo [失败] 无法读取远端 Git 信息。
  goto :AFTER
)

for /f %%A in ('git -C "%ROOT%" rev-parse --short=12 origin/main') do set "MAIN_SHA=%%A"
for /f %%A in ('git -C "%ROOT%" rev-parse --short=12 origin/workshop-stable') do set "STABLE_SHA=%%A"
set "MAIN_VERSION="
set "STABLE_VERSION="
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
echo 正式版本 Tags：
git -C "%ROOT%" tag -l "workshop-v*" --sort=-version:refname
echo.
goto :AFTER

:RUN_PUBLISH
cls
echo ============================================================
echo                  正式客户端发布
echo ============================================================
echo.
node "%PUBLISHER%" %*
set "RESULT=%errorlevel%"
echo.
if "%RESULT%"=="0" (
  echo ============================================================
  echo [完成] 正式客户端发布流程已结束。
  echo ============================================================
) else (
  echo ============================================================
  echo [失败] 正式客户端没有发布，错误码：%RESULT%
  echo 请查看上方最后一段错误信息。
  echo ============================================================
)
exit /b %RESULT%

:RUN_SERVER
cls
echo ============================================================
echo                    服务器更新
echo ============================================================
echo.
node "%UPDATER%" %*
set "RESULT=%errorlevel%"
echo.
if "%RESULT%"=="0" (
  echo ============================================================
  echo [完成] 服务器操作已成功结束。
  echo ============================================================
) else (
  echo ============================================================
  echo [失败] 服务器操作没有完成，错误码：%RESULT%
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
