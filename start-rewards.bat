@echo off
echo Launching Microsoft Rewards Script...

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: npm is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if dist folder exists, otherwise build the project
if not exist "dist\" (
    echo The dist folder doesn't exist, building the project...
    call npm run build
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Build failed.
        pause
        exit /b 1
    )
)

REM Launch the script
call npm run start
if %ERRORLEVEL% neq 0 (
    echo ERROR: The script encountered an error.
    pause
    exit /b 1
)

echo Script completed successfully.
pause