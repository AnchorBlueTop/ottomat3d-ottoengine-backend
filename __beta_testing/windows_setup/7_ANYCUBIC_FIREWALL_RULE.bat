@echo off
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: Please right-click this file and select "Run as administrator".
    pause
    exit /b 1
)
echo Adding firewall rule for Anycubic Printers (Port 7125)...
netsh advfirewall firewall add rule name="OTTOMAT3D - Anycubic Moonraker API" dir=out action=allow protocol=TCP remoteport=7125 >nul
echo.
echo Anycubic firewall rule added successfully!
pause