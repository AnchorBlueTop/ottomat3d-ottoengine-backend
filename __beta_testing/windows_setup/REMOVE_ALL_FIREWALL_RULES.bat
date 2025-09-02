@echo off
:: ============================================================================
:: OTTOMAT3D - Firewall Rule Uninstaller
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

echo Removing all OTTOMAT3D firewall rules...
echo This will not show an error if a rule does not exist.
echo.

:: Use the rule name to delete each one, suppressing errors
netsh advfirewall firewall delete rule name="OTTOMAT3D - Bundled Python" >nul 2>&1
netsh advfirewall firewall delete rule name="OTTOMAT3D - OttoEject Moonraker API" >nul 2>&1
netsh advfirewall firewall delete rule name="OTTOMAT3D - BambuLab Printers (MQTT)" >nul 2>&1
netsh advfirewall firewall delete rule name="OTTOMAT3D - BambuLab FTP" >nul 2>&1
netsh advfirewall firewall delete rule name="OTTOMAT3D - PrusaLink HTTP API" >nul 2>&1
netsh advfirewall firewall delete rule name="OTTOMAT3D - FlashForge HTTP API" >nul 2>&1
netsh advfirewall firewall delete rule name="OTTOMAT3D - FlashForge TCP" >nul 2>&1
netsh advfirewall firewall delete rule name="OTTOMAT3D - Creality WebSocket" >nul 2>&1
netsh advfirewall firewall delete rule name="OTTOMAT3D - Elegoo WebSocket" >nul 2>&1
netsh advfirewall firewall delete rule name="OTTOMAT3D - Anycubic Moonraker API" >nul 2>&1

echo.
echo ============================================================================
echo All OTTOMAT3D firewall rules have been removed.
echo ============================================================================
echo.
pause