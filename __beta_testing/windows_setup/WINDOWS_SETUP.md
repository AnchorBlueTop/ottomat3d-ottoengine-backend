# OTTOMAT3D - Windows Firewall & Network Setup Guide

## Why This Is Needed

This guide covers two important setup steps for Windows users:

1.  **Bonjour Service (Recommended):** This service helps your computer reliably find devices on your network by name (e.g., `ottoeject.local`). Without it, you may need to use direct IP addresses, which can change.
2.  **Windows Firewall Rules (Required):** The Windows Defender Firewall can block the OTTOMAT3D script from communicating with your 3D printers, leading to connection errors like `[Win ERROR 10049]`. These scripts fix this by adding specific **outbound rules** to the firewall.

## How to Use

Please follow these steps in order. **Steps 2 and 3 require you to run the scripts as an Administrator.**

### Step 1 (Highly Recommended): Install Bonjour Service

This will improve network name detection for devices like the OttoEject.

1.  In this folder, find the file `BonjourPSSetup.exe`.
2.  Double-click the file to start the installation.
3.  Follow the on-screen prompts to complete the setup (typically just clicking "Next" and "Finish").

### Step 2: Run the REQUIRED Firewall Script (Everyone Must Do This)

This script is essential for the core application to function.

1.  Right-click on `1_REQUIRED_FIREWALL_RULES.bat`.
2.  Select **"Run as administrator"**.
3.  If a window pops up asking for permission, click **"Yes"**.

### Step 3: Run the Firewall Script for YOUR Printer

Now, find the `.bat` file that matches the brand of 3D printer you are using and run it.

1.  Right-click on the `.bat` file for your printer (e.g., `2_BAMBU_LAB_FIREWALL_RULE.bat`).
2.  Select **"Run as administrator"**.
3.  Click **"Yes"** to grant permission.

That's it! Your computer is now fully configured for OTTOMAT3D. You only need to do this once.

### Example

If you are using a **Prusa MK4**, you would:
1.  Install `BonjourPSSetup.exe`.
2.  Run `1_REQUIRED_FIREWALL_RULES.bat` as Administrator.
3.  Run `3_PRUSA_FIREWALL_RULE.bat` as Administrator.

&nbsp;

### Removing the Rules

If you ever need to remove these firewall rules, simply run the `REMOVE_ALL_OTTOMAT3D_RULES.bat` script as an administrator.