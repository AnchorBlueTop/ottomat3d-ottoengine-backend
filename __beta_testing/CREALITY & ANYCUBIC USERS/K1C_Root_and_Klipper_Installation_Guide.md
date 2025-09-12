# Creality K1C Root & Klipper/Moonraker Installation Guide

## ⚠️ **IMPORTANT DISCLAIMERS**

- **Warranty Void**: Rooting your K1C will likely void your manufacturer's warranty
- **Security Risks**: Root access exposes your printer to potential security vulnerabilities  
- **Damage Risk**: Incorrect modifications can result in irreparable damage or operational failures
- **Firmware Updates**: Future firmware updates may remove root access and custom configurations
- **Backup Everything**: Always backup your configurations before firmware updates

**Proceed only if you understand and accept these risks.**

---

## 📋 **Prerequisites**

### Required Items
- **Creality K1C** with firmware V1.3.1.4 or later
- **USB Drive** (FAT32 formatted with 4096 allocation size)
- **Computer** with SSH client (Windows: MobaXterm, Mac/Linux: Terminal)
- **Stable Network Connection** 
- **Latest K1C Firmware** from [Creality Cloud](https://www.crealitycloud.com/software-firmware/firmware/flagship-series)

### Software Downloads
- **MobaXterm** (Windows): [Download Here](https://mobaxterm.mobatek.net/download.html)
- **Creality K1 Reset Utility**: [Direct Download](https://github.com/Guilouz/Creality-Helper-Script-Wiki/raw/main/downloads/Files/creality_k1_reset_utility.exe)

---

## 🔐 **Phase 1: Enable Root Access**

### Step 1: Enable Root Access on Printer
1. On K1C touchscreen: **Settings → Root account information**
2. **Read the disclaimer carefully**
3. Check the agreement box
4. **Wait exactly 30 seconds** (important!)
5. Press **OK**
6. Root access is now enabled

### Step 2: Find Your Printer's IP Address
**Method 1 - From Printer:**
1. Go to **Settings → WiFi** on your K1C
2. Note the IP address, & Password displayed

**Method 2 - From Router:**
1. Access your router's admin panel
2. Look for "Connected Devices" or "DHCP Clients"
3. Find your K1C and note its IP address
4. **Recommended**: Set a static IP for your printer

---

## 💻 **Phase 2: SSH Connection & Helper Script Installation**

### Step 1: Connect via SSH

**Windows:**
1. Open CMD
2. Type ssh root@CREALITY_IP_ADDRRESS for e.g. ssh root@192.168.68.55 and press enter
4. Type 'yes' and press enter - This saves the Creality onto the known_hosts file on your computer.
6. Enter password that showed up on the screen earlier. For us it was `creality_2023` and press enter.

**Mac/Linux (Terminal):**
```bash
ssh root@[YOUR_K1C_IP_ADDRESS]
# Enter password: creality_2023
```

### Step 3: Install Creality Helper Script
Once connected to SSH, run this command:

```bash
git clone --depth 1 https://github.com/Guilouz/Creality-Helper-Script.git /usr/data/helper-script
```

### Step 3: Launch Helper Script
```bash
sh /usr/data/helper-script/helper.sh
```

---

## 🚀 **Phase 4: Install Klipper Components**

The Helper Script will present a menu. Install these components in order:

### Step 1: Install Core Components
From the **[Install]** menu, install:
1. **Moonraker & Nginx** (Web API and reverse proxy)
2. **Fluidd** OR **Mainsail** (Web interface - choose one):
   - **Fluidd**: Access via `http://[PRINTER_IP]:4408`
   - **Mainsail**: Access via `http://[PRINTER_IP]:4409`

### Step 2: Install Additional Features (Optional)
Choose from these optional enhancements:
- **Entware** (Package manager for additional software)
- **Klipper Gcode Shell Command** (Execute system commands from G-code)
- **KAMP** (Klipper Adaptive Meshing & Purging)
- **Useful Macros** (Pre-configured helpful macros)
- **Save Z-Offset Macros** (Convenient Z-offset management)
- **M600 Support** (Filament change support)
- **Moonraker Timelapse** (Generate timelapses)
- **Camera Settings Control** (Camera configuration)
- **OctoEverywhere** (Remote access service)

### Step 3: Verify Installation
1. Open a web browser
2. Navigate to:
   - **Fluidd**: `http://[PRINTER_IP]:4408`
   - **Mainsail**: `http://[PRINTER_IP]:4409`
3. You should see the Klipper web interface
4. Check that the printer shows as "Ready"

---

## 📁 **Phase 5: Configuration & Customization**

### Understanding the File Structure
- **Klipper Config**: `/usr/data/printer_data/config/printer.cfg`
- **Macros**: `/usr/data/printer_data/config/gcode_macros.cfg`
- **Custom Configs**: `/usr/data/printer_data/config/`

### Important Configuration Notes
1. **Backup Configurations**: Always backup your `printer.cfg` and `gcode_macros.cfg` files
2. **Firmware Updates**: Future updates will delete `gcode_macros.cfg` - keep local backups
3. **Custom Macros**: Add your custom G-code macros to `gcode_macros.cfg`

### Accessing Configuration Files
**Via Web Interface:**
1. Go to your Fluidd/Mainsail interface
2. Click **Machine** tab
3. Edit configuration files directly in the browser

**Via SSH:**
```bash
nano /usr/data/printer_data/config/printer.cfg
```

---

## 🔄 **Phase 6: Post-Installation Setup**

### Step 1: Update Klipper Configuration
Your existing automation scripts suggest you might need specific configurations. Typical modifications:

```ini
# Add to printer.cfg for bed positioning (Z-bed printers)
[gcode_macro POSITION_FOR_EJECT]
gcode:
    G1 Z200 F3000  # Raise Z to 200mm for OttoEject access
    M400           # Wait for moves to complete

# WebSocket communication (for your automation scripts)
[virtual_sdcard]
path: /usr/data/printer_data/gcodes

[pause_resume]

[display_status]

[respond]
```

### Step 2: Network Configuration
For your automation setup, ensure:
- **Static IP Address** assigned to K1C
- **Port 9999** accessible for WebSocket communication (used in your scripts)
- **Moonraker API** accessible on standard ports

### Step 3: Test Automation Compatibility
Your existing `creality-multifile-loop.py` script should work with:
- WebSocket URL: `ws://[PRINTER_IP]:9999` 
- Moonraker API: `http://[PRINTER_IP]:7125`

---

## 🛡️ **Phase 7: Maintenance & Updates**

### Updating the Helper Script
The script can be updated via:
1. **Fluidd**: Settings → Software Updates
2. **Mainsail**: Machine tab
3. **SSH**: Re-run the git clone command

### Firmware Updates
⚠️ **CRITICAL**: Firmware updates will:
- Remove root access (must re-enable)
- Delete `gcode_macros.cfg` (backup first!)
- May overwrite some configurations

**Before any firmware update:**
1. Backup all configuration files
2. Note your installed Helper Script components
3. Re-run this guide after the update

### Reverting to Stock Firmware
If you need to revert:
1. Download stock firmware from Creality
2. Use SSH command: `/etc/ota_bin/local_ota_update.sh /tmp/udisk/sda1/*.img`
3. Or use the Helper Script's restore option

---

## 🔧 **Troubleshooting**

### Common Issues

**SSH Connection Refused:**
- Verify root access is enabled
- Check IP address is correct
- Ensure printer is on same network

**Helper Script Not Found:**
- Re-run the git clone command
- Check network connectivity
- Verify `/usr/data` directory exists

**Web Interface Not Loading:**
- Wait 2-3 minutes after installation
- Check correct port numbers (4408/4409)
- Restart Moonraker: `systemctl restart moonraker`

**Klipper Not Starting:**
- Check `/usr/data/printer_data/logs/klippy.log`
- Verify printer.cfg syntax
- Restart Klipper: `systemctl restart klipper`

### Log Files
- **Klipper**: `/usr/data/printer_data/logs/klippy.log`
- **Moonraker**: `/usr/data/printer_data/logs/moonraker.log`
- **System**: `/var/log/messages`

---

## 🎯 **Integration with Your Automation Setup**

Based on your existing project, this rooted K1C will integrate with:

### OttoEject Integration
Your K1C should now support the macros used in your automation:
- `EJECT_FROM_K_ONE_C_PRINTER`
- `LOAD_ONTO_K_ONE_C_PRINTER`

### Multifile Loop Compatibility  
Your `creality-multifile-loop.py` script should work with:
- WebSocket connection to port 9999
- Print job management via Moonraker API
- Status monitoring and control

### Network Configuration for Automation
Ensure your K1C has a static IP for reliable automation:
```bash
# Example static IP configuration
# Edit /etc/dhcpcd.conf (if using dhcpcd)
interface eth0
static ip_address=192.168.68.72/24
static routers=192.168.68.1
static domain_name_servers=192.168.68.1
```

---

## ✅ **Success Verification Checklist**

- [ ] Root access enabled and SSH working
- [ ] Creality Helper Script installed and running  
- [ ] Moonraker and Nginx installed
- [ ] Fluidd or Mainsail accessible via web browser
- [ ] Klipper shows "Ready" status in web interface
- [ ] Configuration files accessible and editable
- [ ] Test print completes successfully
- [ ] WebSocket connection working (port 9999)
- [ ] Moonraker API accessible (port 7125)
- [ ] Integration with your automation scripts confirmed

---

## 📚 **Additional Resources**

- **Guilouz Helper Script Wiki**: https://guilouz.github.io/Creality-Helper-Script-Wiki/
- **Klipper Documentation**: https://www.klipper3d.org/
- **Moonraker API Documentation**: https://moonraker.readthedocs.io/
- **K1 Series Community**: Reddit r/crealityk1
- **Creality Official Forum**: https://forum.creality.com/

---

**🎉 Congratulations!** Your Creality K1C is now rooted with full Klipper/Moonraker functionality. You now have complete control over your printer's firmware and can integrate it seamlessly with your OttoEject automation system.