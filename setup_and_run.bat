@echo off
setlocal enabledelayedexpansion

REM Check if Deno is installed
where deno >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing Deno...
    powershell -Command "iwr https://deno.land/x/install/install.ps1 -useb | iex"
    set "PATH=%USERPROFILE%\.deno\bin;%PATH%"
)

REM Install Puppeteer
echo Installing Puppeteer...
deno run -A --unstable https://deno.land/x/puppeteer@16.2.0/install.ts

REM Run the script
echo Running Amazon Product Monitor script...
deno run --allow-net --allow-read --allow-write --allow-env --allow-run --unstable main.ts %*

pause