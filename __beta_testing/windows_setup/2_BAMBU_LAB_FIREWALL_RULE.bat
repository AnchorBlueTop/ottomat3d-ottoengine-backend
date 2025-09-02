@echo off
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: Please right-click this file and select "Run as administrator".
    pause
    exit /b 1
)
echo Adding firewall rules for Bambu Lab Printers (Ports 8883, 990)...
netsh advfirewall firewall add rule name="OTTOMAT3D - BambuLab Printers (MQTT)" dir=out action=allow protocol=TCP remoteport=8883 >nul
netsh advfirewall firewall add rule name="OTTOMAT3D - BambuLab FTP" dir=out action=allow protocol=TCP remoteport=990 >nul
echo.
echo Bambu Lab firewall rules added successfully!
pause