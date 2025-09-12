@echo off
:: ============================================================================
:: OTTOMAT3D - REQUIRED Firewall Rules
:: This rule is ESSENTIAL for the application to work.
:: ============================================================================

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ---------------------------------------------------------------------
    echo ERROR: Administrator privileges are required.
    echo Please right-click this file and select "Run as administrator".
    echo ---------------------------------------------------------------------
    pause
    exit /b 1
)

echo Adding REQUIRED firewall rules...
echo.

echo [1/2] Adding rule for the bundled Python executable...
netsh advfirewall firewall add rule name="OTTOMAT3D - Bundled Python" dir=out action=allow program="%~dp0..\src\_internal\python-3.13-win\python.exe" enable=yes >nul

echo [2/2] Adding rule for OttoEject (Moonraker Port 7125)...
netsh advfirewall firewall add rule name="OTTOMAT3D - OttoEject Moonraker API" dir=out action=allow protocol=TCP remoteport=7125 >nul

echo.
echo ============================================================================
echo The REQUIRED firewall rules have been added successfully!
echo ============================================================================
echo.
pause