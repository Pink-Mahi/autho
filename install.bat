@echo off
echo ========================================
echo Bitcoin Ownership Protocol - Installer
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org
    echo Download the LTS version and run this installer again.
    pause
    exit /b 1
)

echo [1/5] Checking Node.js version...
node --version
echo.

echo [2/5] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo.

echo [3/5] Building project...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build project
    pause
    exit /b 1
)
echo.

echo [4/5] Generating operator keys...
call npm run generate-keys
echo.

echo [5/5] Creating configuration...
if not exist .env (
    copy .env.example .env
    echo Configuration file created: .env
    echo.
    echo IMPORTANT: Edit .env file and add your Bitcoin address!
) else (
    echo Configuration file already exists.
)
echo.

echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Edit .env file and set your Bitcoin address
echo 2. Run: npm run operator
echo 3. Open: http://localhost:3000/dashboard
echo.
echo Your operator keys are saved in:
echo - operator-private-key.txt (KEEP SECRET!)
echo - operator-public-key.txt
echo - operator-address.txt
echo.
pause
