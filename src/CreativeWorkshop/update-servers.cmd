@echo off
setlocal
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or later is required. Please install Node.js and try again.
  pause
  exit /b 1
)
node "%~dp0..\..\cloudflare\scripts\update-servers.mjs" %*
set "update_result=%errorlevel%"
echo.
pause
exit /b %update_result%
