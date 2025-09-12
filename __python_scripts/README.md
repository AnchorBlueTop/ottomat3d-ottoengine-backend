# OttoEngine - Python Scripts

This directory contains Python scripts for controlling 3D printers and OTTOeject automation.

## Quick Start (Simple Scripts)

### Running ejectobot-simple.py
1. CD into this directory
2. `chmod +x ejectobot-simple.py`
3. `./ejectobot-simple.py`

### Running SingleFileLoop.py

#### On Mac:
1. **Create a Virtual Environment**: `python3 -m venv venv`
2. **Activate the Virtual Environment**: `source venv/bin/activate`
3. **Install Dependencies**: `pip install -r requirements.txt`
4. **Run**: `./SingleFileLoop.py`

#### On Windows:
1. **Create a Virtual Environment**: `python -m venv venv`
2. **Activate the Virtual Environment**: `venv\Scripts\activate`
3. **Install Dependencies**: `pip install -r requirements.txt`
4. **Run**: `python SingleFileLoop.py`

---

## Advanced: Backend API Integration

For scripts that integrate with the OTTOMAT3D Node.js backend server:

### Prerequisites
1. **Python 3.7+ installed**
2. **Backend Server Running**: Ensure the OTTOMAT3D Node.js backend server is running and accessible (e.g., http://localhost:3000)

### Setup Python Environment (one-time per machine)

1. Navigate to this directory in your terminal
2. Create a Python virtual environment: `python3 -m venv venv`
3. Activate the virtual environment:
   - **macOS/Linux**: `source venv/bin/activate`
   - **Windows**: `.\venv\Scripts\activate`
4. Install required Python packages: `pip install -r requirements.txt`

### Configure Backend API Scripts

For scripts like `bambu_loop_via_backend.py`:

1. Open the script in a text editor
2. **Update these critical configuration variables:**
   - `BACKEND_BASE_URL`: Backend API URL (e.g., `"http://localhost:3000/api"`)
   - `PRINTER_ID`: Numeric ID of your target printer (as registered in backend)
   - `OTTOEJECT_ID`: Numeric ID of your target OTTOeject (as registered in backend)
   - `FILENAME_...` variables: Ensure G-code filenames match files on printer's SD card
   - `PRINT_JOBS` dictionary: Verify `store_slot_number` and `grab_slot_number` for each job

3. **Auto-Registration Data**: Update `DEFAULT_PRINTER_REGISTRATION_DATA` and `DEFAULT_OTTOEJECT_REGISTRATION_DATA` with correct IP addresses, serials, access codes, and device names for your hardware

### Running Backend API Scripts

1. Ensure your Python virtual environment is activated
2. Navigate to this directory
3. Execute: `python bambu_loop_via_backend_v0.1.py`

### Monitoring
- Observe the script's console output for progress and errors
- The backend server console will also show API request logs

---

## Troubleshooting

**Device not found errors**: Double-check `PRINTER_ID` and `OTTOEJECT_ID` match devices registered in backend (confirm via Postman GET requests to `/api/printers` and `/api/ottoeject`)

**Macros don't run on OTTOeject**: Verify macro names in script (e.g., `EJECT_FROM_P1`, `STORE_TO_SLOT_X`) exactly match your Klipper configuration

**Prints don't start**: Ensure G-code `FILENAME_...` values are correct and files are on the printer's SD card