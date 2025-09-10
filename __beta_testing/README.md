
# OTTOMAT3D Master Automation Script

On behalf of the Ottomat3D Team, thank you for participating in the OTTOEJECT beta test!

This guide will walk you through setting up and running the automation script.

### Master Script Capabilities
- **Multi-Printer Support**: Works with 6 major printer brands.
- **Fully Automated Workflow**: Print → Eject → Store → Load → Repeat.
- **Smart Queue Management**: Handle multiple print jobs sequentially.
- **Real-Time Monitoring**: Track printer status and job progress.
- **Profile System**: Save and switch between multiple printer configurations.
- **Collision-Free Operation**: Intelligent rack slot management prevents errors.
- **Cross-Platform**: Runs on Windows, macOS, and Linux.

## Getting Started

### Supported Printers
| Brand | Models | Connection | Requirements |
| :--- | :--- | :--- | :--- |
| **Bambu Lab** | A1, P1P, P1S, X1C | MQTT | LAN Mode + Developer Mode |
| **Prusa** | MK3/S/S+, MK4/S, Core One | HTTP API | PrusaLink Enabled |
| **FlashForge**| AD5X, 5M Pro | HTTP + TCP | LAN Mode Enabled |
| **Creality** | K1, K1C | WebSocket | Rooted Firmware |
| **Elegoo** | Centauri Carbon | WebSocket | Rinkhals Custom Firmware |
| **Anycubic** | Kobra S1 | Moonraker API | Rinkhals Custom Firmware |

### System Requirements
- A supported 3D printer from the list above.
- The assembled and calibrated OttoEject System.
- A build plate storage rack (1-6 slots).
- Stable network connectivity for all devices (computer, printer, and OttoEject must be on the same network).

## Installation
1.  Download the latest release for your platform:
    -   Windows: `ottomat3d-beta-test-win64.zip`
    -   macOS: `ottomat3d-beta-test-macos.zip`
2.  Extract the archive to your desired location (e.g., your Desktop).
3.  Open the folder and run the appropriate script:
    -   **Windows**: Double-click `run_ottomat3d.bat`
    -   **macOS/Linux**: Double-click `run_ottomat3d.command`

---
## HOW TO RUN THE MASTER SCRIPT - Initial Setup

When you first run the script, you will see the main menu. For your first time, you should always start with **Option 4: Setup a New Printer**.

### Main Menu Options
```
OTTOMAT3D AUTOMATION OPTIONS:
──────────────────────────────────────────────────
1. Run Last Loop (Same Printer + Same Print Jobs)
2. Use Existing Printer, Configure New Jobs
3. Select a Different Printer + New Print Jobs
4. Setup A New Printer + New Print Jobs
5. Modify Existing Printer Details (IP, Macro Names, Etc...)
6. Change OttoEject IP Address
7. Change OttoRack Slot Count
8. Test Printer Connection
9. Test OttoEject Connection
10. Move Print Bed for Calibration
```

### Option 1. Setup a New Printer (First-Time Walkthrough):
This is the most important flow for getting started.

#### 1. Select Printer Brand
You will be prompted to select your printer's brand from the list.
```
SUPPORTED PRINTER BRANDS:
──────────────────────────────────────────────────
1. Bambu Lab
2. Prusa
...and so on
```
Select the number corresponding to your brand and press Enter.

#### 2. Select Printer Model (If Applicable)
For brands like Bambu Lab, you'll need to specify the exact model. This is critical for determining the bed type (Z-bed vs. Sling bed) and loading the correct settings.
> **Example for Bambu Lab:**
> ```
> BAMBU LAB MODEL SELECTION:
> 1. P1P (Z-bed - Z-axis positioning)
> 2. P1S (Z-bed - Z-axis positioning)
> 3. X1C (Z-bed - Z-axis positioning)
> 4. A1 (Sling bed - Y-axis positioning)
> Select Bambu Lab model (1-4):
> ```

#### 3. Enter Required Printer Details
The script will now ask for the specific connection details for your printer.
> **Bambu Lab Firmware Note:** If you are on the latest firmware, you **MUST** enable both **LAN Mode** and **Developer Mode**. For older firmware, this may not be required:
> - **A1:** Firmware `<= 01.04.00.00`
> - **P1P/P1S:** Firmware `<= 01.08.01.00`
> - **X1C:** Always requires LAN Mode + Developer Mode.

> **Example for a P1P:**
> ```
> ENSURE LAN MODE + DEVELOPER MODE IS ENABLED IF FIRMWARE VERSION >= 01.08.02.00
>
> Enter Printer IP Address:      (Found in SETTINGS -> WLAN -> IP ADDRESS)
> Enter Printer Serial Number:   (Found in SETTINGS -> DEVICE -> PRINTER)
> Enter Printer Access Code:     (Found in SETTINGS -> WLAN -> ACCESS CODE)
> ```

#### 4. Configure OttoEject IP/Hostname
Enter the network address of your OttoEject Raspberry Pi.
> **Finding Your OttoEject IP Address:**
> We **highly recommend** using the direct IP address, as hostnames (like `ottoeject.local`) can be unreliable, especially on Windows.
> 1.  Open a web browser and go to your OttoEject's hostname (e.g., `ottoeject.local`).
> 2.  Click **"Machine"** in the left-hand menu.
> 3.  The IP address will be listed in the **'System Loads'** box on the top right (e.g., `Host: wlan0 (192.168.68.74)`).

#### 5. Save Your Printer Profile
Give your new configuration an easy-to-remember name. This profile is now saved and can be quickly loaded later.
> ```
> 💾 SAVE PRINTER PROFILE:
> ──────────────────────────────
> Enter profile name (default: Bambu Lab P1P): My P1P
> ```
> The macro names for each printer model are hard-coded based on our supplied `printer.cfg` files. 

---

## Other Menu Options Explained

### Option 2. Select a Different Printer:
This allows you to switch between your saved printer profiles before configuring new print jobs.
> ```
> 📋 SAVED PRINTER PROFILES:
> ──────────────────────────────────────────────────
> 1. P1P
>    Bambu Lab P1P - 192.168.68.64
> 2. K1C
>    Creality K1/K1C - 192.168.68.55
> ```

### Option 3. Start New Print Jobs:
This option keeps your current printer settings but lets you define a new list of print jobs. This is useful for starting a new batch of prints without re-entering printer details.

#### 1. Define Your Job Queue
Enter the total number of prints you want to run.
> For your first run after calibration, we recommend 2-3 short (10-minute) prints.

#### 2. Configure Each Job
For each job, you will define the file to print and the rack slots to use.
> **Example for Job 1:**
> ```
> 📋 JOB 1 CONFIGURATION:
> ─────────────────────────
> Enter filename for Job 1: FILENAME.3mf
> Enter STORE slot for Job 1 (1-6): 3  <-- This slot must be EMPTY
> Enter GRAB slot for Job 1 (1-6): 2   <-- This slot must HAVE a plate
> ```
> **Note:** The final job in your sequence will not have a "GRAB" step.

#### 3. Rack Validation
To prevent crashes, the script will ask you to confirm the current state of your storage rack. It will check from top to bottom (Slot 6 to Slot 1).
> ```
> Does slot 6 currently have a build plate? (y/n): n
>   ⬜ Slot 6: Empty
> Does slot 5 currently have a build plate? (y/n): y
>   ✅ Slot 5: Has build plate
> ```
The script simulates the entire job sequence to ensure you don't try to store a plate in an occupied slot or grab from an empty one. If everything is valid, the automation will begin.

### Option 4. Run Last Loop:
This is the quickest way to re-run a job. It immediately starts the last configured print sequence, using the same files, grab/store locations, and assuming the same initial rack state.

### Option 5. Modify Existing Printer Details:
Allows you to edit details for the currently active profile, such as IP address, serial number, etc. Please avoid changing the macro names unless you have also changed them in your `printer.cfg`.

### Option 6. Change OttoEject IP Adddress:
Change OttoEject IP Address.

### Options 7 & 8: Test Connections
Use these to quickly verify that the script can communicate with your printer and OttoEject.

### Option 9: Move Print Bed for Calibration
This feature helps you calibrate the OttoEject by moving the printer's bed to a known position.
-   For most printers (Bambu, FlashForge), it will move the bed to a recommended Z-height.
-   For **Prusa** and **Elegoo**, where direct bed movement is not supported, the script will run a very short, pre-loaded G-code file that moves the bed to the correct height and then pauses, allowing you to calibrate.
-   For **Anycubic** we add a +13mm compensation to the actual command we send to the printer, as we have found a consistent 13mm discrepency between sending direct gcode vs adding it to the end of the print file which is what the script does.

---
## Important Printer-Specific Notes

- #### Bambu Lab
  - Enable **LAN Mode** and **Developer Mode** in printer settings.
  - Note your printer's **Serial Number** and **Access Code**.

- #### Prusa
  - Enable **PrusaLink** in printer settings and note the **API Key**.
  - The script will automatically upload the necessary `Y_POS_DWELL.gcode` or `Z_POS_DWELL.gcode` files for calibration and ejection.

- #### FlashForge
  - Enable **LAN Mode** and note the **Serial Number** and **Check Code**.

- #### Creality
  - Your printer **must be rooted**. See `K1C_Root_and_Klipper_Installation_Guide.md`.

- #### Elegoo & Anycubic
  - You must install the **Rinkhals custom firmware**. See `Rinkhals_Custom_Firmware_Installation_Guide.md`.
  - For each print job, the script automatically downloads the gcode file you want to print and then it adds 'G1 Z200 F600' for Anycubic or 'G1 Z205 F600' for the Elegoo at the end of machine-end gcode of the file. This is so the print bed moves to that height at the end of the print job so that the ottoeject can grab the build plate. If these commands are already present in the file, then the script won't modify them. 

## Safety & Support

### Operational Best Practices
-   Always ensure build plates are correctly seated in the rack before starting.
-   Verify OttoEject macros are properly calibrated by running them manually from the Mainsail interface first.
-   Always test with a short, simple job sequence before running longer, overnight jobs.

## Known Issues:

### Anycubic Kobra S1:
-   Printer Percentage Stalls despite Print Progressing.

### Bambu Lab P Series:
-   Cannot connect to printer despite correct IP Address, Access Code, & Access Code. Restart Printer to Fix Issue.

### Creality K1/C:
-   Printer goes into 'PAUSED' state instead of expected 'ERROR' state. 

### ELEGOO:
-   Elegoo Centauri Carbon has not been thoroughly tested with this master script. 

### OTTOEJECT:
-   Hostname (ottoeject.local) is sometimes unreliable.
-   Can't connect to OttoEject Mainsail, restarting fixes this.

### Log Files
For detailed debugging, check the log files located in the `src/logs/` directory. Each run creates a new file with a timestamp, containing detailed status updates and error messages.