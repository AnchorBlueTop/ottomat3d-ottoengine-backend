# OttoStudio Unit Test Setup Guide

## Overview

The `unit-test-1.js` script is an automated system configuration tool that sets up a complete OttoStudio test environment. It creates all necessary entities (printers, ottoejects, racks) and configures them for automated 3D printing workflow testing.

**What it does:**
- Creates a Bambu Lab printer in the system
- Registers an OttoEject ejection device
- Creates an OttoRack storage rack with shelves
- Configures empty plates on shelves 1-3
- Uploads .gcode.3mf print files
- Creates print jobs with auto-start enabled
- Outputs colored status messages for easy debugging

## Prerequisites

1. **Backend server must be running:**
   ```bash
   npm start
   # Server should be running on http://localhost:3000
   ```

2. **Required dependencies (already installed):**
   - `axios` - For making HTTP requests
   - `form-data` - For file uploads

3. **Valid .gcode.3mf files** for testing

## Configuration

### Step 1: Edit the Configuration Object

Open `_testing/unit-test-1.js` and modify the `config` object (lines 47-71):

```javascript
const config = {
    printer: {
        name: "My_P1P",              // Your printer name
        brand: "Bambu Lab",          // Printer brand
        model: "P1P",                // Printer model
        type: "FDM",                 // Printer type
        ip_address: "192.168.68.66", // CHANGE: Your printer's IP address
        access_code: "22945061",     // CHANGE: Your printer's access code
        serial_number: "01S00C371700385" // CHANGE: Your printer's serial number
    },
    ottoeject: {
        device_name: "OttoEject-Mk1",
        ip_address: "192.168.68.65"  // CHANGE: Your OttoEject device IP
    },
    ottorack: {
        name: "Rack A",
        number_of_shelves: 6,        // Number of shelves in your rack
        shelf_spacing_mm: 80,        // Spacing between shelves
        bed_size: "256x256"          // Printer bed size
    },
    printFiles: [
        // CHANGE: Add full paths to your .gcode.3mf files
        "/Users/yourname/path/to/your/file1.gcode.3mf",
        "/Users/yourname/path/to/your/file2.gcode.3mf"
    ]
};
```

### Step 2: Update Print File Paths

**IMPORTANT:** You must change the `printFiles` array to point to your actual .gcode.3mf files:

```javascript
printFiles: [
    "/full/path/to/your/first/print.gcode.3mf",
    "/full/path/to/your/second/print.gcode.3mf"
]
```

- Use absolute file paths (not relative)
- Files must be `.gcode.3mf` format
- Files must exist on your system
- You can add more files to the array if needed

## Running the Script

### Method 1: Direct Execution
```bash
cd backend
node _testing/unit-test-1.js
```

### Method 2: Using npm (if configured)
```bash
npm run test:setup
```

### Method 3: Make it executable
```bash
chmod +x _testing/unit-test-1.js
./_testing/unit-test-1.js
```

## API Endpoints Called

The script makes the following API calls in sequence:

### 1. Create Printer
**Endpoint:** `POST /api/printers`

**Request Body:**
```json
{
  "name": "My_P1P",
  "brand": "Bambu Lab",
  "model": "P1P",
  "type": "FDM",
  "ip_address": "192.168.68.66",
  "access_code": "22945061",
  "serial_number": "01S00C371700385"
}
```

**Purpose:** Registers a new printer in the system with connection credentials.

**Success Response:** Returns printer object with `id` field.

**Note:** If printer already exists (409 conflict), script continues with assumed ID of 1.

---

### 2. Create OttoEject Device
**Endpoint:** `POST /api/ottoeject`

**Request Body:**
```json
{
  "device_name": "OttoEject-Mk1",
  "ip_address": "192.168.68.65"
}
```

**Purpose:** Registers an OttoEject ejection device for automated print removal.

**Success Response:** Returns ottoeject object with `id` field.

**Note:** If device already exists (409 conflict), script continues with assumed ID of 1.

---

### 3. Create OttoRack
**Endpoint:** `POST /api/ottoracks`

**Request Body:**
```json
{
  "name": "Rack A",
  "number_of_shelves": 6,
  "shelf_spacing_mm": 80,
  "bed_size": "256x256"
}
```

**Purpose:** Creates a storage rack with specified number of shelves and dimensions.

**Success Response:** Returns ottorack object with `id` field.

**Note:** If rack already exists (409 conflict), script continues with assumed ID of 1.

---

### 4-6. Configure Shelves (1-3)
**Endpoint:** `PUT /api/ottoracks/{ottorack_id}/shelves/{shelf_number}`

**Request Body:**
```json
{
  "has_plate": true,
  "plate_state": "empty",
  "print_job_id": null
}
```

**Purpose:** Configures shelves 1-3 with empty plates, making them ready to receive prints.

**Plate States:**
- `"empty"` - Plate is ready for a new print
- `"with_print"` - Plate has a completed print
- `null` - No plate present (clearance slot)

**Success Response:** Returns updated shelf object.

---

### 7. Upload Print File (Per File)
**Endpoint:** `POST /api/print-jobs/upload`

**Request:** `multipart/form-data` with file field

**Purpose:** Uploads a .gcode.3mf file to the backend and parses print metadata (dimensions, estimated time, etc.).

**Success Response:**
```json
{
  "print_item_id": 1,
  "filename": "OTTO_LOGO_P1P_PLA_V1.gcode.3mf",
  "max_z_height_mm": 2.16,
  "estimated_time_minutes": 15
}
```

**Note:** The script uploads each file in the `printFiles` array sequentially.

---

### 8. Create Print Job (Per File)
**Endpoint:** `POST /api/print-jobs`

**Request Body:**
```json
{
  "print_item_id": 1,
  "printer_id": 1,
  "ottoeject_id": 1,
  "auto_start": true,
  "priority": 1
}
```

**Purpose:** Creates a print job that links the uploaded file with printer, ejection device, and orchestration settings.

**Parameters:**
- `print_item_id` - ID from upload step
- `printer_id` - ID of target printer
- `ottoeject_id` - ID of ejection device
- `auto_start` - If `true`, orchestrator will automatically start this job when printer is available
- `priority` - Job priority (1 = highest)

**Success Response:**
```json
{
  "id": 1,
  "status": "waiting",
  "auto_start": true,
  "created_at": "2025-10-17T12:00:00.000Z"
}
```

**Note:** There's a 5-second delay between submitting multiple print jobs to prevent race conditions.

---

## Script Output

The script provides color-coded output:

- 🟦 **Blue/Cyan** - Step indicators
- 🟩 **Green** - Success messages
- 🟥 **Red** - Error messages
- 🟨 **Yellow** - Warning messages

### Example Output:
```
============================================================
🚀 OttoStudio Test Setup Script
============================================================

[1/9] Creating printer...
✓ Printer created with ID: 1
   Name: My_P1P (Bambu Lab P1P)

[2/9] Creating OttoEject...
✓ OttoEject created with ID: 1
   Name: OttoEject-Mk1 @ 192.168.68.65

[3/9] Creating OttoRack...
✓ OttoRack created with ID: 1
   Name: Rack A (6 shelves, 80mm spacing)

[4-6/9] Configuring shelves 1-3 with empty plates...
✓ Shelf 1: Empty plate configured
✓ Shelf 2: Empty plate configured
✓ Shelf 3: Empty plate configured

[7/9] Uploading print file 1...
✓ File uploaded, print_item_id: 1
   File: OTTO_LOGO_P1P_PLA_V1.gcode.3mf

[8/9] Creating print job 1...
✓ Print job created with ID: 1
   Status: waiting, Auto-start: Yes

[DELAY] Waiting 5 seconds before submitting second job...
✓ Delay complete, continuing...

[9/9] Uploading print file 2...
✓ File uploaded, print_item_id: 2
   File: ottologov1.gcode.3mf

[10/9] Creating print job 2...
✓ Print job created with ID: 2
   Status: waiting, Auto-start: Yes

============================================================
✅ Test Setup Complete!
============================================================

System Configuration:
  • Printer ID: 1
  • OttoEject ID: 1
  • OttoRack ID: 1
  • Print Jobs Created: 2

Next Steps:
  1. Monitor backend logs for orchestration activity
  2. Check job status: GET /api/print-jobs
  3. View orchestrator status: GET /api/orchestrator/status
  4. Monitor rack state: GET /api/ottoracks/1
```

## Monitoring After Script Execution

Once the script completes, monitor these endpoints:

### Check Print Job Status
```bash
curl http://localhost:3000/api/print-jobs
```

### Check Orchestrator Status
```bash
curl http://localhost:3000/api/orchestration/status
```

### Check Active Jobs
```bash
curl http://localhost:3000/api/orchestration/active-jobs
```

### Check Rack State
```bash
curl http://localhost:3000/api/ottoracks/1
```

### Check Orchestrator Health
```bash
curl http://localhost:3000/api/orchestration/health
```

## Troubleshooting

### File Not Found Error
```
✗ File not found: /path/to/file.gcode.3mf
⚠ Skipping this print job...
```
**Solution:** Update the file path in the `printFiles` array to point to an existing file.

---

### Printer Creation Failed
```
✗ Failed to create printer: Connection refused
```
**Solution:**
- Ensure backend server is running on port 3000
- Check printer IP address is correct and reachable
- Verify printer access code and serial number

---

### 409 Conflict Errors
```
⚠ Printer may already exist, continuing...
```
**Solution:** This is normal if entities already exist. The script will continue with assumed IDs.

---

### Jobs Not Starting
**Check:**
1. Orchestrator is running: `GET /api/orchestration/health`
2. Printer status is IDLE/FINISH/FAILED: `GET /api/printers/1`
3. Jobs have `auto_start: true`: `GET /api/print-jobs`
4. Backend logs for error messages

## Advanced Usage

### Running Multiple Times
The script handles existing entities gracefully. If you run it multiple times:
- Existing printers/devices/racks will trigger 409 conflicts (script continues)
- New print jobs will be created each time
- Check your database to avoid duplicate entities

### Customizing Number of Shelves
Modify the `number_of_shelves` in the config to match your physical rack.

### Testing Different Printers
Update the printer config with different brand/model/IP to test multi-printer support.

### Adding More Print Files
Add additional file paths to the `printFiles` array:
```javascript
printFiles: [
    "/path/to/file1.gcode.3mf",
    "/path/to/file2.gcode.3mf",
    "/path/to/file3.gcode.3mf",
    "/path/to/file4.gcode.3mf"
]
```

## Notes

- **Auto-start enabled:** Jobs created by this script will automatically start when the orchestrator finds an available printer
- **5-second delay:** Built-in delay between job submissions prevents race conditions in the orchestrator
- **Timeout:** All API calls have a 30-second timeout
- **Error handling:** Script continues on non-critical errors (like 409 conflicts)
- **Exit codes:** Script exits with code 1 on fatal errors, 0 on success

## Integration with Testing Workflow

This script is designed for:
1. **Initial system setup** - Quick bootstrap of test environment
2. **Integration testing** - Automated creation of test scenarios
3. **CI/CD pipelines** - Scriptable system configuration
4. **Development testing** - Fast iteration on orchestration features

For manual API testing, use the Postman collection at `_testing/postman/OTTOMAT3D-API-Tests.postman_collection.json`.
