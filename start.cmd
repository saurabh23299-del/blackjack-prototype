@echo off
rem Starts the Blackjack prototype at http://localhost:5173 using the portable Node.js install.
set "PATH=%LOCALAPPDATA%\nodejs-portable\node-v22.23.5-win-x64;%PATH%"
cd /d "%~dp0"
if not exist node_modules call npm install
start "" http://localhost:5173
call npm run dev
