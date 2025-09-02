@echo off
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: Please right-click this file and select "Run as administrator".
    pause
    exit /b 1
)
echo Adding firewall rule for Elegoo Printers (Port 3030)...
netsh advfirewall firewall add rule name="OTTOMAT3D - Elegoo WebSocket" dir=out action=allow protocol=TCP remoteport=3030 >nul
echo.
echo Elegoo firewall rule added successfully!
pause