@echo off
setlocal EnableExtensions
chcp 65001 >nul
title 轮回战场 - 发布与服务器工具

set "ROOT=%~dp0"
set "UPDATER=%ROOT%cloudflare\scripts\update-servers.mjs"
set "WORKSHOP_PUBLISHER=%ROOT%cloudflare\scripts\promote-stable.mjs"
set "WORLD_PUBLISHER=%ROOT%cloudflare\scripts\promote-world-engine.mjs"

for %%F in ("%UPDATER%" "%WORKSHOP_PUBLISHER%" "%WORLD_PUBLISHER%") do (
  if not exist "%%~F" (
    echo.
    echo [错误] 找不到发布脚本：
    echo %%~F
    echo.
    echo 请确认这个 BAT 位于“轮回战场”仓库根目录。
    echo.
    pause
    exit /b 1
  )
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
echo                轮回战场 · 发布与服务器工具
echo ============================================================
echo.
echo   [1] 更新测试服
echo       origin/main -^> staging Worker + 共享 D1 / KV / R2
echo.
echo   [2] 发布创意工坊正式版
echo       origin/main -^> workshop-stable + workshop-vX.Y.Z
echo       只读取 WORKSHOP_VERSION，不修改世界推进版本
echo.
echo   [3] 发布世界推进正式版
echo       origin/main -^> world-engine-vX.Y.Z
echo       只读取 WORLD_ENGINE_VERSION，不推进 workshop-stable
echo.
echo   [4] 更新正式服务器
echo       origin/workshop-stable -^> production Worker + 共享 D1 / KV / R2
echo       会要求再次输入 PRODUCTION 确认
echo.
echo   [5] 依次更新测试服 + 正式服务器
echo.
echo   [6] 只检查测试服，不执行迁移和部署
echo.
echo   [7] 只检查正式服务器，不执行迁移和部署
echo.
echo   [8] 预演创意工坊正式发布
echo.
echo   [9] 查看 main / workshop-stable / 两类正式 Tag
echo.
echo   [0] 退出
echo.
echo ------------------------------------------------------------
echo 推荐：
echo   只改创意工坊：2 ^> 4
echo   只改世界推进：3
echo   两边都改：分别提升各自版本，再依次执行 2 和 3
echo ------------------------------------------------------------
echo.

choice /c 1234567890 /n /m "请选择 [1-9,0]："
set "MENU_CHOICE=%errorlevel%"

if "%MENU_CHOICE%"=="10" goto :EOF
if "%MENU_CHOICE%"=="9" goto :STATUS
if "%MENU_CHOICE%"=="8" goto :PUBLISH_WORKSHOP_PREVIEW
if "%MENU_CHOICE%"=="7" goto :CHECK_PRODUCTION
if "%MENU_CHOICE%"=="6" goto :CHECK_STAGING
if "%MENU_CHOICE%"=="5" goto :UPDATE_BOTH
if "%MENU_CHOICE%"=="4" goto :UPDATE_PRODUCTION
if "%MENU_CHOICE%"=="3" goto :PUBLISH_WORLD
if "%MENU_CHOICE%"=="2" goto :PUBLISH_WORKSHOP
if "%MENU_CHOICE%"=="1" goto :UPDATE_STAGING
goto :MENU

:UPDATE_STAGING
call :RUN_SERVER staging
goto :AFTER

:PUBLISH_WORKSHOP
call :RUN_WORKSHOP_PUBLISH
goto :AFTER

:PUBLISH_WORLD
call :RUN_WORLD_PUBLISH
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

:PUBLISH_WORKSHOP_PREVIEW
call :RUN_WORKSHOP_PUBLISH --dry-run
goto :AFTER

:STATUS
cls
echo ============================================================
echo                    当前发布状态
echo ============================================================
echo.
echo 说明：这里只读取本地已经同步的 Git 引用，不会连接 GitHub。
echo.
set "MAIN_SHA="
set "STABLE_SHA="
set "MAIN_WORKSHOP_VERSION="
set "MAIN_WORLD_VERSION="
set "STABLE_WORKSHOP_VERSION="
for /f %%A in ('git -C "%ROOT%" rev-parse --short=12 refs/remotes/origin/main 2^>nul') do set "MAIN_SHA=%%A"
for /f %%A in ('git -C "%ROOT%" rev-parse --short=12 refs/remotes/origin/workshop-stable 2^>nul') do set "STABLE_SHA=%%A"
if not defined MAIN_SHA for /f %%A in ('git -C "%ROOT%" rev-parse --short=12 refs/heads/main 2^>nul') do set "MAIN_SHA=%%A"
if not defined STABLE_SHA for /f %%A in ('git -C "%ROOT%" rev-parse --short=12 refs/heads/workshop-stable 2^>nul') do set "STABLE_SHA=%%A"
if not defined MAIN_SHA (
  echo [失败] 本地没有 main 引用，请先更新本地仓库。
  goto :AFTER
)
if not defined STABLE_SHA set "STABLE_SHA=未同步"

for /f "delims=" %%A in ('git -C "%ROOT%" show refs/remotes/origin/main:src/CreativeWorkshop/app/workshop-app.js 2^>nul ^| findstr /c:"WORKSHOP_VERSION ="') do set "MAIN_WORKSHOP_VERSION=%%A"
if not defined MAIN_WORKSHOP_VERSION for /f "delims=" %%A in ('git -C "%ROOT%" show refs/heads/main:src/CreativeWorkshop/app/workshop-app.js 2^>nul ^| findstr /c:"WORKSHOP_VERSION ="') do set "MAIN_WORKSHOP_VERSION=%%A"

for /f "delims=" %%A in ('git -C "%ROOT%" show refs/remotes/origin/main:src/WorldEngine/core/WorldEngineFoundation.part.js 2^>nul ^| findstr /c:"WORLD_ENGINE_VERSION="') do set "MAIN_WORLD_VERSION=%%A"
if not defined MAIN_WORLD_VERSION for /f "delims=" %%A in ('git -C "%ROOT%" show refs/heads/main:src/WorldEngine/core/WorldEngineFoundation.part.js 2^>nul ^| findstr /c:"WORLD_ENGINE_VERSION="') do set "MAIN_WORLD_VERSION=%%A"

for /f "delims=" %%A in ('git -C "%ROOT%" show refs/remotes/origin/workshop-stable:src/CreativeWorkshop/app/workshop-app.js 2^>nul ^| findstr /c:"WORKSHOP_VERSION ="') do set "STABLE_WORKSHOP_VERSION=%%A"
if not defined STABLE_WORKSHOP_VERSION for /f "delims=" %%A in ('git -C "%ROOT%" show refs/heads/workshop-stable:src/CreativeWorkshop/app/workshop-app.js 2^>nul ^| findstr /c:"WORKSHOP_VERSION ="') do set "STABLE_WORKSHOP_VERSION=%%A"

echo main：
echo   SHA       %MAIN_SHA%
echo   Workshop  %MAIN_WORKSHOP_VERSION%
echo   World     %MAIN_WORLD_VERSION%
echo.
echo workshop-stable：
echo   SHA       %STABLE_SHA%
echo   Workshop  %STABLE_WORKSHOP_VERSION%
echo.
echo 创意工坊正式 Tags：
git -C "%ROOT%" tag -l "workshop-v*" --sort=-version:refname
echo.
echo 世界推进正式 Tags：
git -C "%ROOT%" tag -l "world-engine-v*" --sort=-version:refname
echo.
echo 历史统一 Tags（仅兼容旧版本）：
git -C "%ROOT%" tag -l "V*" --sort=-version:refname
echo.
goto :AFTER

:RUN_WORKSHOP_PUBLISH
cls
echo ============================================================
echo                  创意工坊正式发布
echo ============================================================
echo.
node "%WORKSHOP_PUBLISHER%" %*
set "RESULT=%errorlevel%"
echo.
if "%RESULT%"=="0" (
  echo [完成] 创意工坊正式发布流程已结束。
) else (
  echo [失败] 创意工坊没有发布，错误码：%RESULT%
)
exit /b %RESULT%

:RUN_WORLD_PUBLISH
cls
echo ============================================================
echo                  世界推进正式发布
echo ============================================================
echo.
node "%WORLD_PUBLISHER%" %*
set "RESULT=%errorlevel%"
echo.
if "%RESULT%"=="0" (
  echo [完成] 世界推进正式发布流程已结束。
) else (
  echo [失败] 世界推进没有发布，错误码：%RESULT%
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
  echo [完成] 服务器操作已成功结束。
) else (
  echo [失败] 服务器操作没有完成，错误码：%RESULT%
)
exit /b %RESULT%

:AFTER
echo.
choice /c RQ /n /m "[R] 返回主菜单    [Q] 关闭工具："
if errorlevel 2 goto :EOF
goto :MENU
