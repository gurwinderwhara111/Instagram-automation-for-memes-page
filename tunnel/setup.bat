@echo off
setlocal enabledelayedexpansion

set "PORT=%~1"
if "%PORT%"=="" set "PORT=3000"

set "APP_NAME=%~2"
if "%APP_NAME%"=="" set "APP_NAME=your-app"

echo.
echo ==============================================
echo   Universal Webhook - Tunnel Connector
echo ==============================================
echo   App:   %APP_NAME%
echo   Port:  %PORT%
echo   Host:  https://bot.mymua.in
echo.

REM 1. Download cloudflared if missing
where cloudflared >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [1/3] Downloading cloudflared...
  curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -o "%TEMP%\cloudflared.exe"
  move /y "%TEMP%\cloudflared.exe" "%USERPROFILE%\cloudflared.exe" >nul
  set "PATH=%USERPROFILE%;%PATH%"
  echo   cloudflared downloaded
) else (
  echo [1/3] cloudflared already installed
)

REM 2. Read token
set /p TOKEN=<"%~dp0token.txt"

REM 3. Start tunnel with auto-restart
echo [2/3] Connecting bot.mymua.in -^> http://localhost:%PORT%...
echo Press Ctrl+C to stop.
echo.

:RESTART
cloudflared tunnel run --token %TOKEN%
echo.
echo Tunnel disconnected. Restarting in 3s...
echo Press Ctrl+C to stop.
timeout /t 3 /nobreak >nul
goto RESTART
