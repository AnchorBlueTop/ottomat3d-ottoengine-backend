@echo off
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: Please right-click this file and select "Run as administrator".
    pause
    exit /b 1
)
echo Adding firewall rule for PrusaLink (Port 80)...
netsh advfirewall firewall add rule name="OTTOMAT3D - PrusaLink HTTP API" dir=out action=allow protocol=TCP remoteport=80 >nul
echo.
echo Prusa firewall rule added successfully!
pause