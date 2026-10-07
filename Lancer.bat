@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Installation automatique...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  echo.
  echo Node.js est installe. Ferme cette fenetre puis relance Lancer.bat.
  pause
  exit /b
)
node scripts\launch.js
pause
