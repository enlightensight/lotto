@echo off
title LottoTrack Pro POS Launcher
echo ===================================================
echo        Starting LottoTrack Pro Lottery POS
echo ===================================================
echo.

cd /d "%~dp0"

:: Start Vite dev server in the background if not already active
start "LottoPOS-Server" /min cmd /c "npm run dev"

:: Wait 2 seconds for server to initialize
timeout /t 2 /nobreak >nul

:: Launch in Chrome or Edge standalone app mode
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:5173 --start-maximized
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=http://localhost:5173 --start-maximized
) else if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:5173 --start-maximized
) else (
    start http://localhost:5173
)

echo POS System is running at http://localhost:5173
echo You may close this window.
exit
