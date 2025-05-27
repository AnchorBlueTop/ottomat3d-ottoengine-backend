OTTOMAT3D - Python Automation Scripts Quick Start

This guide covers running the Python scripts that control the 3D printer and OTTOeject automation via the backend API.

## Prerequisites

1.  **Python 3.7+ installed.**
2.  **Backend Server Running:** Ensure the OTTOMAT3D Node.js backend server is running and accessible. Ask the backend team for its URL (e.g., http://localhost:3000).

Running the Main Automation Loop Script

The primary script is typically named `bambu_loop_via_backend_v0.1.py` or similar, located in the `python-scripts` directory.

1. Setup Python Environment (one-time per machine/clone)

   a. Navigate to the `backend/python-scripts/` directory in your terminal.

   b. Create a Python virtual environment:
      python3 -m venv venv

   c. Activate the virtual environment:
      *   macOS/Linux: `source venv/bin/activate`
      *   Windows: `.\venv\Scripts\activate`

   d. Install required Python packages:
      pip install -r requirements.txt

2. Configure the Script

   a. Open `bambu_loop_via_backend_v0.1.py` (or the current main loop script) in a text editor.

   b. **Update these critical configuration variables at the top of the script:**
      *   `BACKEND_BASE_URL`: Set to the backend API URL (e.g., `"http://localhost:3000/api"`).
      *   `PRINTER_ID`: Set to the numeric ID of your target printer (as registered in the backend).
      *   `OTTOEJECT_ID`: Set to the numeric ID of your target OTTOeject (as registered in the backend).
      *   `FILENAME_...` variables: Ensure these G-code filenames match files **present on the printer's SD card.**
      *   `PRINT_JOBS` dictionary:
          *   Verify `store_slot_number` and `grab_slot_number` for each job. These numbers are used to call Klipper macros like `STORE_TO_SLOT_3`, `GRAB_FROM_SLOT_1`. Ensure these macros exist on your OTTOeject.

   c. **Auto-Registration Data (Important if backend DB might be empty for these IDs):**
      *   Review and update `DEFAULT_PRINTER_REGISTRATION_DATA` and `DEFAULT_OTTOEJECT_REGISTRATION_DATA` with the correct IP addresses, serials, access codes, and device names for *your specific hardware*. The script will use this to try and register the devices if they aren't found by the `PRINTER_ID` or `OTTOEJECT_ID`.

3. Run the Script

   a. Ensure your Python virtual environment is activated.
   b. Navigate to the `backend/python-scripts/` directory.
   c. Execute:
      python bambu_loop_via_backend_v0.1.py

### 5. Monitor

   *   Observe the script's console output for progress and errors.
   *   The backend server console will also show API request logs.

---

**Troubleshooting Tips:**
*   If "Device not found" errors occur from the Python script: Double-check `PRINTER_ID` and `OTTOEJECT_ID` in the script match devices actually registered in the backend (confirm with backend team or via Postman GET requests to `/api/printers` and `/api/ottoeject`).
*   If macros don't run on OTTOeject: Verify macro names in the script (e.g., `EJECT_FROM_P1`, `STORE_TO_SLOT_X`) exactly match your Klipper configuration on the OTTOeject.
*   If prints don't start: Ensure G-code `FILENAME_...` values are correct and files are on the printer's SD card.
