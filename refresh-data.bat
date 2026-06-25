@echo off
REM Pulls fresh data from Finale API and updates the static JSON files.
REM Run manually or via Windows Task Scheduler (daily at 6 AM recommended).
REM
REM To set up Task Scheduler:
REM   1. Open Task Scheduler (taskschd.msc)
REM   2. Create Basic Task > Name: "Pack Labs Data Refresh"
REM   3. Trigger: Daily, 6:00 AM
REM   4. Action: Start a Program
REM      Program: cmd.exe
REM      Arguments: /c "C:\Users\Daniel Kim\OneDrive\Desktop\thetruth\refresh-data.bat"
REM      Start in: C:\Users\Daniel Kim\OneDrive\Desktop\thetruth
REM   5. Finish

cd /d "%~dp0"

echo [%date% %time%] Starting Finale data refresh... >> refresh-data.log

call npm run build-data >> refresh-data.log 2>&1

if %ERRORLEVEL% EQU 0 (
  echo [%date% %time%] Data refresh succeeded >> refresh-data.log
) else (
  echo [%date% %time%] Data refresh FAILED (exit code %ERRORLEVEL%) >> refresh-data.log
)
