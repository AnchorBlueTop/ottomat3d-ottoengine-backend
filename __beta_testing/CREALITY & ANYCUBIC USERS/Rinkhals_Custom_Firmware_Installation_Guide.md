# Rinkhals Custom Firmware Installation Guide

## ⚠️ **CRITICAL COMPATIBILITY WARNING**

**🚨 YOUR PRINTER FIRMWARE MUST EXACTLY MATCH THE RINKHALS FIRMWARE VERSION**  
**🚨 RINKHALS VERSIONS ARE NOT BACKWARDS COMPATIBLE**  
**🚨 USING THE WRONG VERSION CAN BRICK YOUR PRINTER**

**Before proceeding, you MUST check your exact firmware version and download the corresponding Rinkhals release. There is NO universal version.**

---

## 📋 **What is Rinkhals?**

Rinkhals is a custom firmware overlay for **Anycubic Kobra series** printers that adds full **Klipper/Moonraker** functionality while preserving all stock Anycubic features. It's specifically designed for your OttoEject automation setup.

### **Why Rinkhals for Automation?**
- ✅ **Full Klipper/Moonraker API** (required for your automation scripts)
- ✅ **Keeps stock features** (touch screen, calibration, Anycubic tools)
- ✅ **WebSocket support** for remote control
- ✅ **G-code macro support** for OttoEject integration
- ✅ **Mainsail/Fluidd interfaces** for monitoring

---

## 🎯 **Supported Printers**

**Rinkhals ONLY works with these specific Anycubic Kobra models:**

| Printer Model | Your Code | Status |
|---------------|-----------|--------|
| **Anycubic Kobra S1** | KS1 | ✅ Fully Supported |
| **Anycubic Kobra 2 Pro** | K2P | ✅ Supported (see special notes) |
| **Anycubic Kobra 3** | K3 | ✅ Fully Supported |
| **Anycubic Kobra 3 V2** | K3V2 | ✅ Supported |
| **Anycubic Kobra 3 Max** | K3M | ✅ Supported |

**❌ NOT SUPPORTED**: Elegoo printers, other Anycubic models, or non-Kobra series

---

## 🔍 **Step 1: Check Your Current Firmware (CRITICAL)**

### Find Your Printer's Firmware Version
1. On your printer's touchscreen, go to **Settings**
2. Look for **About** or **System Information**
3. **Write down the EXACT firmware version** (e.g., "2.4.0.4" or "2.5.3.5")
4. **Note your printer model** exactly as displayed

### Check Your Mainboard (Kobra 2 Pro Only)
**⚠️ Special requirement for Kobra 2 Pro:**
- Only works with **Trigorilla Spe B v1.0.x** mainboard
- Firmware **3.1.4 is buggy** - you MUST downgrade to **3.1.2.3** first
- Check your mainboard version in printer settings

---

## 📥 **Step 2: Download the Correct Rinkhals Version**

### Find Your Exact Version Match
1. Go to **[Rinkhals Releases](https://github.com/jbatonnet/Rinkhals/releases)**
2. Look through releases to find one that supports **your exact printer model AND firmware version**
3. **Verify compatibility** in the release notes - look for your exact firmware version
4. Download the appropriate `.swu` file:
   - **Kobra S1**: `update-ks1.swu`
   - **Kobra 2 Pro/3/3V2**: `update-k2p-k3.swu`
   - **Kobra 3 Max**: `update-k3m.swu`

### **⚠️ COMPATIBILITY CHECK EXAMPLE**
```
✅ CORRECT: Your Kobra 3 has firmware 2.4.0.4 → Download Rinkhals release that lists "K3 2.4.0.4"
❌ WRONG: Your Kobra 3 has firmware 2.4.0.4 → Download release for "K3 2.3.9.3" (older version)
❌ WRONG: Your Kobra 3 has firmware 2.3.9.3 → Download release for "K3 2.4.0.4" (newer version)
```

### **If Your Firmware Isn't Supported**
- **DO NOT PROCEED** with installation
- Check if newer Rinkhals releases support your firmware
- Consider updating your printer firmware to a supported version
- Join [Rinkhals Discord](https://discord.gg/3mrANjpNJC) for help

---

## 💾 **Step 3: Prepare Installation Media**

### USB Drive Requirements
- **Format**: FAT32 only (MBR partition table, NOT GPT)
- **Size**: 8GB+ recommended
- **Quality**: Use a reliable USB drive (cheap drives can cause failures)

### Format Your USB Drive
1. Insert USB drive into your computer
2. **Right-click** → **Format**
3. **File System**: FAT32
4. **Allocation unit size**: Default (or 4096)
5. **Partition scheme**: MBR (not GPT)
6. Format the drive

### Create Required Directory Structure
1. In the **root** of your USB drive, create a folder named: **`aGVscF9zb3Nf`**
   - ⚠️ This folder name is case-sensitive and exact
   - ⚠️ Do NOT create any other folders
2. Copy your downloaded `.swu` file into the `aGVscF9zb3Nf` folder
3. **Rename** the file to exactly: **`update.swu`**

### Final USB Structure
```
USB Drive (Root)
└── aGVscF9zb3Nf/
    └── update.swu
```

---

## 🔧 **Step 4: Install Rinkhals**

### Pre-Installation Checklist
- [ ] Printer firmware version matches Rinkhals release exactly
- [ ] USB drive formatted as FAT32 (MBR)
- [ ] Folder named `aGVscF9zb3Nf` created in USB root
- [ ] Correct `.swu` file renamed to `update.swu` in the folder
- [ ] Printer is powered on and functioning normally

### Installation Process
1. **Power on** your printer and wait for normal startup
2. **Insert the USB drive** into the front USB port
3. **Wait for the beep** - this indicates the update process has started
4. **Watch the screen** for a progress bar (appears after ~20 seconds)

### Installation Status Indicators
**✅ SUCCESS:**
- Progress bar turns **GREEN**
- You hear **2 BEEPS**
- Printer **reboots automatically**
- After reboot, you'll see a **Rinkhals icon** in Settings

**❌ FAILURE:**
- Progress bar turns **RED**
- You hear **3 BEEPS**
- Check `aGVscF9zb3Nf/install.log` on USB drive for error details
- Printer should still work normally with stock firmware

### Post-Installation Verification
1. Check for **Rinkhals icon** in **Settings** on touchscreen
2. Open a web browser and go to: `http://[PRINTER_IP]`
3. You should see **Mainsail** interface
4. Test Moonraker API: `http://[PRINTER_IP]:7125/printer/info`

---

## 🌐 **Step 5: Configure for OttoEject Integration**

### Network Setup
1. **Set a static IP** for your printer in your router
2. **Note the IP address** for your automation scripts
3. **Test network connectivity** from your computer

### Verify Required Services
**Mainsail Interface**: `http://[PRINTER_IP]` (default port 80)  
**Moonraker API**: `http://[PRINTER_IP]:7125`  
**Klipper Status**: Should show "Ready" in Mainsail

### Integration Points for Your Automation
Based on your project files, verify these work:
- **Moonraker API calls** for print status
- **G-code macro execution** via API
- **Print job management** through Moonraker
- **WebSocket connections** (if your scripts use them)

### Required G-code Macro for Bed Positioning
Add this to your printer.cfg via Mainsail:
```ini
[gcode_macro POSITION_FOR_EJECT]
gcode:
    G1 Z205 F3000  # Raise Z to 205mm for OttoEject access
    M400           # Wait for moves to complete
```

---

## 🔄 **Step 6: Firmware Updates & Maintenance**

### **⚠️ CRITICAL: Firmware Update Warning**
- **Anycubic firmware updates** will require **new Rinkhals versions**
- **NEVER update Anycubic firmware** without checking Rinkhals compatibility first
- **Rinkhals versions are NOT backwards compatible**
- **Always backup your configuration** before any updates

### Updating Rinkhals
1. Check [Rinkhals releases](https://github.com/jbatonnet/Rinkhals/releases) for new versions
2. **Verify your new Anycubic firmware is supported**
3. Download the matching Rinkhals version
4. Follow the same installation process
5. Rinkhals can install over existing versions safely

### Backup Your Configuration
**Before any updates, backup:**
- Printer.cfg file (via Mainsail → Machine tab)
- Any custom macros you've created
- Your OttoEject integration settings

---

## 🛠️ **Troubleshooting**

### Installation Failed (Red Progress Bar)
**Possible Causes:**
- Wrong Rinkhals version for your firmware
- USB drive not formatted correctly (must be FAT32 MBR)
- Incorrect folder name (`aGVscF9zb3Nf`)
- Corrupted download of Rinkhals file

**Solutions:**
1. Check `install.log` file on USB drive for specific error
2. Verify firmware version match exactly
3. Re-format USB drive as FAT32 MBR
4. Re-download Rinkhals file
5. Try a different USB drive

### Mainsail Not Loading
**Check These:**
- Wait 2-3 minutes after installation for services to start
- Verify printer IP address
- Check network connectivity
- Try `http://[PRINTER_IP]:80` explicitly

### Klipper Not Ready
**Common Issues:**
- Configuration file errors
- Hardware connection issues
- Incorrect printer.cfg modifications

**Solutions:**
1. Check Mainsail → Machine → klippy.log for errors
2. Reset to default Rinkhals configuration
3. Avoid modifying printer.cfg unless necessary

### OttoEject Integration Issues
**Verify These:**
- Moonraker API responding: `http://[PRINTER_IP]:7125/printer/info`
- G-code macros executing properly
- Network connectivity stable
- Printer shows "Ready" status

---

## 🔄 **Uninstalling Rinkhals**

### Method 1: Touch UI Disable
1. Go to **Settings → Rinkhals** on touchscreen
2. Select **Disable Rinkhals**
3. Reboot printer

### Method 2: USB Disable File
1. Create a file named `.disable-rinkhals` (no extension)
2. Put it in the `aGVscF9zb3Nf` folder on USB drive
3. Insert USB drive and reboot printer

### Method 3: Manual Removal (Advanced)
**Via SSH access:**
1. Connect to printer via SSH
2. Delete `/useremain/rinkhals/` directory
3. Remove Rinkhals sections from startup scripts
4. Reboot printer

---

## 📚 **Additional Resources**

### Official Documentation
- **Rinkhals GitHub**: https://github.com/jbatonnet/Rinkhals
- **Rinkhals Documentation**: https://jbatonnet.github.io/Rinkhals/
- **Installation Guide**: https://jbatonnet.github.io/Rinkhals/Rinkhals/installation-and-firmware-updates/

### Community Support
- **Rinkhals Discord**: https://discord.gg/3mrANjpNJC
- **GitHub Issues**: https://github.com/jbatonnet/Rinkhals/issues

### For Your OttoEject Project
- **Moonraker API Docs**: https://moonraker.readthedocs.io/
- **Klipper Documentation**: https://www.klipper3d.org/

---

## ✅ **Success Verification Checklist**

- [ ] **Exact firmware version** verified and matching Rinkhals release
- [ ] **USB drive** properly formatted as FAT32 (MBR)
- [ ] **Installation completed** with green progress bar and 2 beeps
- [ ] **Rinkhals icon** visible in printer Settings
- [ ] **Mainsail interface** accessible at printer IP
- [ ] **Moonraker API** responding at port 7125
- [ ] **Klipper status** shows "Ready"
- [ ] **Network connectivity** stable and consistent
- [ ] **Static IP** configured for printer
- [ ] **G-code macros** working for bed positioning
- [ ] **Integration tested** with your OttoEject automation scripts

---

Your Anycubic Kobra printer now has full Klipper/Moonraker functionality via Rinkhals and is ready for integration with your OttoEject automation system. You can now use your existing automation scripts while maintaining all the stock Anycubic features you're familiar with.

**Remember**: Always verify firmware compatibility before updating either Anycubic firmware or Rinkhals!