@echo off
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: Please right-click this file and select "Run as administrator".
    pause
    exit /b 1
)
echo Adding firewall rules for FlashForge Printers (Ports 8898, 8899)...
netsh advfirewall firewall add rule name="OTTOMAT3D - FlashForge HTTP API" dir=out action=allow protocol=TCP remoteport=8898 >nul
netsh advfirewall firewall add rule name="OTTOMAT3D - FlashForge TCP" dir=out action=allow protocol=TCP remoteport=8899 >nul
echo.
echo FlashForge firewall rules added successfully!
pause