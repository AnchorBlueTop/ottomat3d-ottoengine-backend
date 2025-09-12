@echo off
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: Please right-click this file and select "Run as administrator".
    pause
    exit /b 1
)
echo Adding firewall rule for Creality Printers (Port 9999)...
netsh advfirewall firewall add rule name="OTTOMAT3D - Creality WebSocket" dir=out action=allow protocol=TCP remoteport=9999 >nul
echo.
echo Creality firewall rule added successfully!
pause