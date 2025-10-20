# OttoEngine API Documentation

## CHANGELOG
16/10/2025 1933 - Kalpesh
    - Added api/printers/connect api to test connection without persisting
07/09/2025 1055 - Harshil
    - APIs v0.3
21/05/2025 1722 - Harshil
    - Intial set of APIs

# OTTOMAT3D - OttoEngine APIs v0.3

**Base URL:** `{{baseUrl}}` (e.g., `http://localhost:3000`)

This document outlines the API endpoints provided by the OttoEngine v0.3 including Phase 3 orchestration capabilities.

---

---

# Printers API (`/api/printers/`)

Manage 3D printers (register, update, delete, retrieve printer(s) status and details, send commands).

## Register a Printer

### POST `/api/printers/`

- **Description:** Registers a new 3D printer with the system.
- **Request Body (JSON):**

    ```json
    {
    			"name": "My_P1P",
    			"brand": "Bambu Lab",
    			"model": "P1P",
    			"type": "FDM",
    			"ip_address": "192.168.68.58",
    			"access_code": "14358945",
    			"serial_number": "01S00C371700385",
    			"build_volume": { // Optional
    					 "width_mm": 256,
    					 "depth_mm": 256,
    					 "height_mm": 256
    			 },
    		   "filament": { // Optional: Represents default/current filament to store in DB
    				   "material": "PLA",
    				   "color": "DefaultColorHex_or_Name"
    				   // Note: Only a single filament object is stored in current_filament_json for v0.1
    			 }
    }
    ```

- **Response (201 Created):**

    ```json
    {
    		 "id": 1,
    		 "name": "My_P1P",
    		 "message": "Printer registered successfully"
    }
    ```

## Test Connection (no persistence)

### POST `/api/printers/connect`

- Description: Tests connectivity/authentication to a printer without saving it in the database. Useful to verify credentials and reachability before registration.
- Request Body (JSON):
        - For Bambu Lab brand, access_code and serial_number are required.

        ```json
        {
            "brand": "Bambu Lab",
            "ip_address": "192.168.68.58",
            "access_code": "14312345",
            "serial_number": "01A00B312300123"
        }
        ```

- Successful Response (200 OK):
        ```json
        {
            "status": "ONLINE",
            "message": "Connection successful."
        }
        ```

- Error Responses:
        - 400 Bad Request: Missing required fields (brand, ip_address; also access_code and serial_number for Bambu Lab).
        - 501 Not Implemented: Brand is not supported for connect testing yet.
        - 502 Connect Failed: Communication/authentication to the device failed (message will include reason or timeout).

        Example (Not Implemented):
        ```json
        {
            "error": "Not Implemented",
            "message": "Connect not implemented for brand 'prusa'."
        }
        ```

        Example (Connect Failed):
        ```json
        {
            "error": "Connect Failed",
            "message": "Connection failed: Connect timed out after 20000ms"
        }
        ```

- Notes:
        - Debug logging can be enabled by setting environment variables before starting the backend:
            - `LOG_LEVEL=DEBUG` or `BAMBU_API_DEBUG=true` to see detailed Bambu client logs.
        - Timeouts can be tuned via:
            - `PRINTER_CONNECT_TIMEOUT_MS` (default 20000)
            - `PRINTER_PUSHALL_TIMEOUT_MS` (defaults to the connect timeout)

## Get All Printers

### GET `/api/printers/`

- **Description:** Retrieves a list of all registered printers. For v0.1, `status` and `filament` are placeholders (status is "IDLE", filament is from DB stored `current_filament_json` or default "N/A").
- **Response (200 OK):**

    ```json
    [
        {
            "id": 1,
            "name": "My_P1P",
            "status": "IDLE",
            "type": "FDM",
            "filament": {
                "material": "N/A",
                "color": "N/A"
            }
        }
        // ... more printers
    ]
    ```


## Get Printer by ID (Full Details)

### GET `/api/printers/{id}`

- **Description:** Retrieves detailed information for a specific printer, including live status, live filament (if available from printer), live temperatures, and stored configuration like build volume.
- **Response (200 OK):***(Note: `build_volume` will be `null` if not set during registration or update. `filament` shows live data if printer reports it, otherwise it shows DB stored `current_filament_json` or "N/A".)*

    ```json
    {
        "id": 1,
        "name": "My_P1P",
        "brand": "Bambu Lab",
        "model": "P1P",
        "type": "FDM",
        "status": "RUNNING",          // Live gcode_state
        "current_stage": "PRINTING",  // Live detailed operational stage
        "progress_percent": 75,       // Live print progress percentage
        "remaining_time_minutes": 30, // Live remaining print time
        "filament": {                 // Live filament data from printer, or DB fallback
            "material": "PLA",
            "color": "898989FF",      // Hex color code reported by printer
            "name": null,             // Or name if reported
            "source": "external_spool" // Or AMS slot
        },
        "build_volume": {             // From database if previously set
            "width_mm": 256,
            "depth_mm": 256,
            "height_mm": 256
        },
        "ip_address": "192.168.68.58",
        "serial_number": "01S00C371700385",
        "bed_temperature": 65.0,
        "nozzle_temperature": 220.0
    }
    ```


## Get Printer Status by ID (Focused Status)

### GET `/api/printers/{id}/status`

- **Description:** Retrieves a focused set of live operational status details for a specific printer.
- **Response (200 OK):**

    ```json
    {
        "id": 1,
        "name": "My_P1P",
        "brand": "Bambu Lab",
        "model": "P1P",
        "status": "RUNNING",       // Live gcode_state
        "current_stage": "PRINTING", // Live detailed operational stage
        "progress_percent": 75,    // Live print progress percentage
        "remaining_time_minutes": 30 // Live remaining print time
    }
    ```


## Send G-Code to Printer

### POST `/api/printers/{id}/send-gcode`

- **Description:** Sends an arbitrary G-code command (or multiple commands separated by `\\\\n`) to the specified printer. Useful for actions like positioning the bed.
- **Request Body (JSON):**

    ```json
    {
    	  "gcode": "G0 Z150 F3000\\\\nM117 Bed Ready for Ejection"
    }
    ```

- **Response (202 Accepted):**

    ```json
    {
    		 "message": "G-code sent."
    }
    ```


## Upload File to Printer

### POST `/api/printers/{id}/upload`

- **Description:** Uploads a G-code file (e.g., `.gcode`, `.gcode.3mf`) from the client to the backend server, which then transfers it to the specified printer's internal storage (e.g., SD card) via FTP/FTPS.
- **Request Body (multipart/form-data):**
    - **`file`** (File, required): The G-code file to be uploaded.
    - **`remote_filename`** (Text, optional): If provided, this name will be used for the file on the printer. If omitted, the original filename of the uploaded file will be used.

    | Key | Type | Description | Required |
    | --- | --- | --- | --- |
    | `file` | File | The G-code file to be uploaded. | Yes |
    | `remote_filename` | Text | Desired filename on the printer. If omitted, uses original filename. | No |
- **Response (200 OK - If upload to printer successful):***(Note: `filename` in the response reflects the name used on the printer. `file_size` is the size of the uploaded file. `upload_time` is the ISO timestamp when the backend successfully processed the upload to the printer.)*

    ```json
    {
      "filename": "new_printer_filename.gcode.3mf",
      "file_size": "2.50 MB",
      "upload_time": "2025-05-21T10:00:00.000Z",
      "message": "File 'new_printer_filename.gcode.3mf' uploaded successfully to printer 1."

    }
    ```

- **Error Responses:**
    - `400 Bad Request`: If no file is provided under the `file` key, or other request validation fails.
    - `404 Not Found`: If the specified printer ID is not found or not managed.
    - `502 Bad Gateway` or `503 Service Unavailable`: If there's an issue communicating with the printer (e.g., FTP connection failure, printer offline, FTP error during transfer).
    - `500 Internal Server Error`: For unexpected errors on the backend.

## Start Print (File on Printer)

### POST `/api/printers/{id}/start-print`

- **Description:** Commands the printer to start printing a file that is already present on its internal storage (e.g., SD card).
- **Request Body (JSON):**

    ```json
    {
        "filename": "PrintTestCubex1_V3.gcode.3mf"
        // Optional Bambu Lab specific parameters can be included here
        // e.g., "useAms": true, "bed_leveling": true, "flow_cali": true
    }
    ```

- **Response (202 Accepted):**

    ```json
    {
         "message": "Start print command for PrintTestCubex1_V3.gcode.3mf sent."
    }
    ```


## Pause a Printer

### POST `/api/printers/{id}/pause`

- **Description:** Pauses the current print job on the specified printer.
- **Response (202 Accepted):**

    ```json
    {
         "message": "Pause command sent to printer."
    }
    ```


## Resume a Printer

### POST `/api/printers/{id}/resume`

- **Description:** Resumes a paused print job on the specified printer.
- **Response (202 Accepted):**

    ```json
    {
         "message": "Resume command sent to printer."
    }
    ```


## Stop a Printer

### POST `/api/printers/{id}/stop`

- **Description:** Stops the current print job on the specified printer.
- **Response (202 Accepted):**

    ```json
    {
         "message": "Stop command sent to printer."
    }
    ```


## Update Printer Details

### PUT `/api/printers/{id}`

- **Description:** Updates stored details for a specific printer (e.g., name, IP, build volume, default filament).
- **Request Body (JSON):** Can include any subset of fields allowed at registration.

    ```json
    {
        "name": "My P1P (Updated)",
        "build_volume": {
            "width_mm": 256,
            "depth_mm": 256,
            "height_mm": 256
        },
        "filament": { // Updates the current_filament_json in DB
            "material": "PETG",
            "color": "TransparentRed_Hex"
        }
    }
    ```

- **Response (200 OK):** Returns the full live printer details after the update, plus a success message.

    ```json
    {
        "id": 1,
        "name": "My P1P (Updated)",
        "brand": "Bambu Lab",
        "model": "P1P",
        "type": "FDM",
        "status": "IDLE",          // Live status at time of response
        "current_stage": "IDLE",   // Live stage
        "progress_percent": 0,
        "remaining_time_minutes": 0,
        "filament": {              // Live filament, or the updated DB one if live fails
            "material": "PETG",
            "color": "TransparentRed_Hex",
            "source": "database_fallback"  // Or live source
        },
        "build_volume": {
            "width_mm": 256,
            "depth_mm": 256,
            "height_mm": 256
        },
        "ip_address": "192.168.68.58",
        "serial_number": "01S00C371700385",
        "bed_temperature": 25.0,
        "nozzle_temperature": 25.0,
        "message": "Printer updated successfully"
    }
    ```


## Delete a Printer

### DELETE `/api/printers/{id}`

- **Description:** Removes a printer registration from the system.
- **Response (200 OK):**

    ```json
    {
         "message": "Printer deleted successfully"
    }
    ```

---

# Ottoeject API (`/api/ottoeject/`)

Manage Ottoeject devices (registration, status, macro execution).

## Register an Ottoeject

### POST `/api/ottoeject/`

- **Description:** Registers a new OttoEject device. For v0.1, only `device_name` and `ip_address` are stored.
- **Request Body (JSON):**

    ```json
    {
         "device_name": "OttoEject-Mk2",
         "ip_address": "192.168.68.74"
    }
    ```

- **Response (201 Created):***(Note: `status` in response is a static "ONLINE" for creation; actual status is polled live.)*

    ```json
    {
          "id": 1,
          "device_name": "OttoEject-Mk2",
          "status": "ONLINE",
          "message": "Ottoeject registered successfully"
    }
    ```


## Get All Ottoeject Devices

### GET `/api/ottoeject/`

- **Description:** Retrieves a list of all registered OttoEject devices. For v0.1, `status` is a placeholder "ONLINE".
- **Response (200 OK):**

    ```json
    [
        {
            "id": 1,
            "device_name": "OttoEject-Mk2",
            "status": "ONLINE"
        }
        // ... more Ottoejects
    ]
    ```


## Retrieve Ottoeject by ID

### GET `/api/ottoeject/{id}`

- **Description:** Retrieves stored details for a specific OttoEject device, plus its live status.
- **Response (200 OK):**

    ```json
    {
        "id": 1,
        "device_name": "OttoEject-Mk2",
        "status": "ONLINE" // Live status (e.g., ONLINE, EJECTING, OFFLINE, ISSUE)
    }
    ```


## Retrieve Ottoeject Status by ID

### GET `/api/ottoeject/{id}/status`

- **Description:** Retrieves the live operational status of a specific OttoEject device.
- **Status Options:**
    - `ONLINE`: Device is powered on, connected, Klipper is ready.
    - `EJECTING`: Device is actively running a Klipper macro (Klipper state "Printing" or "Busy").
    - `OFFLINE`: Backend cannot communicate with the OttoEject's Moonraker API.
    - `ISSUE`: Klipper is in an "Error" or "Shutdown" state.
- **Response (200 OK):**

    ```json
    {
        "id": 1,
        "device_name": "OttoEject-Mk2",
        "status": "EJECTING" // Example live status
    }
    ```


## Update Ottoeject Details

### PUT `/api/ottoeject/{id}`

- **Description:** Updates stored details for an OttoEject (e.g., `device_name`, `ip_address`).
- **Request Body (JSON):**

    ```json
    {    "device_name": "OttoEject-Mk2-Renamed",    "ip_address": "192.168.68.75"}
    ```

- **Response (200 OK):**

    ```json
    {    "id": 1,    "device_name": "OttoEject-Mk2-Renamed",    "status": "ONLINE", // Placeholder status in this response    "message": "Ottoeject updated successfully"}
    ```


## Delete an Ottoeject

### DELETE `/api/ottoeject/{id}`

- **Description:** Removes an OttoEject registration from the system.
- **Response (200 OK):**

    ```json
    {    "message": "Ottoeject deleted successfully"}
    ```


## Execute Ottoeject Macro

### POST `/api/ottoeject/{id}/macros`

- **Description:** Sends a command to the OttoEject to execute a pre-defined Klipper G-code macro.
- **Request Body (JSON):Example (Homing)**

    ```json
    {    "macro": "OTTOEJECT_HOME"}
    ```

- **Response (202 Accepted - If macro dispatched successfully):**
Indicates the command was sent to the OttoEject. The client (e.g., Python script) should then poll `/api/ottoeject/{id}/status` to determine when the macro has finished (i.e., status returns to "ONLINE").

    ```json
    {
        "message": "Macro 'OTTOEJECT_HOME' command sent to Ottoeject 1.",
        "moonraker_response": { // Direct response from Moonraker when it accepted the command
            "result": "ok"
        }
    }
    ```

- **Response (502 Bad Gateway - If macro is long and backend times out waiting for Moonraker ACK):**

**Explanation for Timeout Response:**
The OttoEject (running Klipper/Moonraker) immediately starts executing a long macro. Moonraker might not send an HTTP "OK" back to the backend until Klipper finishes that block of G-code. If this takes longer than the backend's internal timeout to Moonraker (e.g., 30 seconds), the backend will respond with this 502 error. However, the macro is likely still running on the OttoEject. The controlling script must poll the OttoEject's status via `GET /api/ottoeject/{id}/status` to know when the physical action is complete (i.e., when status returns from "EJECTING" to "ONLINE").

```json
{
    "error": "Macro Execution Proxy Error",
    "message": "Command 'EJECT_FROM_P1' sent to Ottoeject, but acknowledgement from device timed out. External polling for completion is required. Detail: Failed to execute G-code: No response from 192.168.68.74 (ECONNABORTED)",
    "moonraker_details": null
}
```

---

# Print Jobs API (`/api/print-jobs/`)

Manage print jobs through a two-step process: file upload/parsing and job creation. Provides job lifecycle management including creation, monitoring, updating, and completion.

## Upload & Parse G-code File (Step 1)

### POST `/api/print-jobs/upload`

- **Description:** Uploads a G-code file (e.g., `.gcode`, `.gcode.3mf`) to the backend server and parses it to create a print item record. This is the first step in the print job creation process.
- **Request Body (multipart/form-data):**
    - **`file`** (File, required): The G-code file to be uploaded and parsed.

    | Key | Type | Description | Required |
    | --- | --- | --- | --- |
    | `file` | File | The G-code file to be uploaded and parsed. | Yes |
- **Response (200 OK):**

    ```json
    {
        "print_item_id": 1,
        "filename": "test_cube.gcode.3mf",
        "file_size": "2.50 MB",
        "estimated_print_time": 45, // in minutes
        "layer_count": 150,
        "filament_used": "15.5g",
        "message": "File uploaded and parsed successfully"
    }
    ```


## Create Print Job (Step 2)

### POST `/api/print-jobs/`

- **Description:** Creates a new print job using a previously uploaded print item. Associates the job with a printer, ottoeject device, and sets job parameters.
- **Request Body (JSON):**

    ```json
    {
        "print_item_id": 1,
        "printer_id": 1,
        "ottoeject_id": 1,
        "auto_start": true,
        "priority": 1
    }
    ```

- **Response (201 Created):**

    ```json
    {
        "id": 1,
        "print_item_id": 1,
        "printer_id": 1,
        "ottoeject_id": 1,
        "status": "QUEUED",
        "priority": 1,
        "auto_start": true,
        "created_at": "2025-05-21T10:00:00.000Z",
        "message": "Print job created successfully"
    }
    ```


## Get All Print Jobs

### GET `/api/print-jobs/`

- **Description:** Retrieves a list of all print jobs in the system with their current status and basic details.
- **Response (200 OK):**

    ```json
    [
        {
            "id": 1,
            "print_item_id": 1,
            "printer_id": 1,
            "ottoeject_id": 1,
            "status": "PRINTING",
            "priority": 1,
            "progress_percent": 45,
            "estimated_remaining_time": 30, // in minutes
            "created_at": "2025-05-21T10:00:00.000Z",
            "started_at": "2025-05-21T10:05:00.000Z"
        },
        {
            "id": 2,
            "print_item_id": 2,
            "printer_id": 2,
            "ottoeject_id": 1,
            "status": "QUEUED",
            "priority": 2,
            "progress_percent": 0,
            "estimated_remaining_time": null,
            "created_at": "2025-05-21T10:30:00.000Z",
            "started_at": null
        }
        // ... more print jobs
    ]
    ```


## Get Specific Print Job

### GET `/api/print-jobs/{id}`

- **Description:** Retrieves detailed information for a specific print job, including associated print item details, printer information, and current status.
- **Response (200 OK):**

    ```json
    {
        "id": 1,
        "print_item": {
            "id": 1,
            "filename": "test_cube.gcode.3mf",
            "file_size": "2.50 MB",
            "estimated_print_time": 45,
            "layer_count": 150,
            "filament_used": "15.5g"
        },
        "printer": {
            "id": 1,
            "name": "My_P1P",
            "brand": "Bambu Lab",
            "model": "P1P"
        },
        "ottoeject": {
            "id": 1,
            "device_name": "OttoEject-Mk2"
        },
        "status": "PRINTING",
        "priority": 1,
        "auto_start": true,
        "progress_percent": 45,
        "estimated_remaining_time": 30,
        "created_at": "2025-05-21T10:00:00.000Z",
        "started_at": "2025-05-21T10:05:00.000Z",
        "completed_at": null
    }
    ```


## Update Print Job

### PUT `/api/print-jobs/{id}`

- **Description:** Updates properties of an existing print job, such as priority or other configurable parameters.
- **Request Body (JSON):**

    ```json
    {
    	  "priority": 2
    }
    ```

- **Response (200 OK):**

    ```json
    {
         "id": 1,
         "priority": 2,
         "status": "QUEUED",
         "message": "Print job updated successfully"
    }
    ```


## Cancel Print Job

### DELETE `/api/print-jobs/{id}`

- **Description:** Cancels and removes a print job from the system. If the job is currently printing, it will stop the print operation.
- **Response (200 OK):**

    ```json
    {
         "message": "Print job cancelled successfully"
    }
    ```


## Complete a Print Job

### POST `/api/print-jobs/{id}/complete`

- **Description:** Marks a print job as completed. This is typically called when the print and ejection processes have finished successfully.
- **Response (200 OK):**

    ```json
    {
         "id": 1,
         "status": "COMPLETED",
         "completed_at": "2025-05-21T11:30:00.000Z",
         "message": "Print job marked as completed"
    }
    ```


---

# OttoRacks API (`/api/ottoracks/`)

Manage OttoRack storage systems for organizing completed prints. OttoRacks are modular storage units with multiple shelves for storing printed objects.

## Create Ottorack

### POST `/api/ottoracks/`

- **Description:** Creates a new OttoRack storage unit with specified configuration including number of shelves and dimensions.
- **Request Body (JSON):**

    ```json
    {
        "name": "A",
        "number_of_shelves": 10,
        "shelf_spacing_mm": 80,
        "bed_size": "256x256"
    }
    ```

- **Response (201 Created):**

    ```json
    {
        "id": 1,
        "name": "A",
        "number_of_shelves": 10,
        "shelf_spacing_mm": 80,
        "bed_size": "256x256",
        "shelves": [
            {
                "id": 1,
                "shelf_number": 1,
                "has_plate": false,
                "plate_state": null,
                "print_job_id": null
            },
            {
                "id": 2,
                "shelf_number": 2,
                "has_plate": false,
                "plate_state": null,
                "print_job_id": null
            }
            // ... all shelves
        ],
        "message": "Ottorack created successfully"
    }
    ```


## Get All Ottoracks

### GET `/api/ottoracks/`

- **Description:** Retrieves a list of all Ottorack storage units with basic information and occupancy status.
- **Response (200 OK):**

    ```json
    [
        {
            "id": 1,
            "name": "A",
            "number_of_shelves": 10,
            "shelf_spacing_mm": 80,
            "bed_size": "256x256",
            "occupied_shelves": 3,
            "available_shelves": 7
        },
        {
            "id": 2,
            "name": "B",
            "number_of_shelves": 8,
            "shelf_spacing_mm": 100,
            "bed_size": "300x300",
            "occupied_shelves": 1,
            "available_shelves": 7
        }
        // ... more ottoracks
    ]
    ```


## Get Ottorack Details by ID

### GET `/api/ottoracks/{id}`

- **Description:** Retrieves detailed information for a specific Ottorack, including the status of all individual shelves.
- **Response (200 OK):**

    ```json
    {
        "id": 1,
        "name": "A",
        "number_of_shelves": 10,
        "shelf_spacing_mm": 80,
        "bed_size": "256x256",
        "shelves": [
            {
                "id": 1,
                "shelf_number": 1,
                "has_plate": true,
                "plate_state": "with_print",
                "print_job_id": 5,
                "print_job": {
                    "id": 5,
                    "filename": "test_part.gcode.3mf",
                    "completed_at": "2025-05-21T11:30:00.000Z"
                }
            },
            {
                "id": 2,
                "shelf_number": 2,
                "has_plate": false,
                "plate_state": null,
                "print_job_id": null,
                "print_job": null
            }
            // ... all shelves
        ],
        "occupied_shelves": 3,
        "available_shelves": 7
    }
    ```


## Update Shelf State

### PUT `/api/ottoracks/{ottorack_id}/shelves/{shelf_id}`

- **Description:** Updates the plate and print state of a specific shelf in an OttoRack. Supports three states: completed print, empty plate, and no plate.
- **Request Body (JSON):**

    **For Completed Print:**
    ```json
    {
        "has_plate": true,
        "plate_state": "with_print",
        "print_job_id": 1
    }
    ```

    **For Empty Plate:**
    ```json
    {
        "has_plate": true,
        "plate_state": "empty",
        "print_job_id": null
    }
    ```

    **For No Plate:**
    ```json
    {
        "has_plate": false,
        "plate_state": null,
        "print_job_id": null
    }
    ```

- **Response (200 OK):**

    ```json
    {
        "id": 1,
        "shelf_number": 1,
        "has_plate": true,
        "plate_state": "with_print",
        "print_job_id": 1,
        "ottorack_id": 1,
        "message": "Shelf updated successfully"
    }
    ```


## Reset Shelf (Mark as Empty)

### POST `/api/ottoracks/{ottorack_id}/shelves/{shelf_id}/reset`

- **Description:** Resets a shelf to empty status, clearing any associated print job and marking it as available for new prints.
- **Response (200 OK):**

    ```json
    {
        "id": 1,
        "shelf_number": 1,
        "has_plate": false,
        "plate_state": null,
        "print_job_id": null,
        "ottorack_id": 1,
        "message": "Shelf reset successfully"
    }
    ```


---

# Phase 3: Orchestration API (`/api/orchestration/`) - Debugging & Monitoring

**Primary Purpose: Development & Production Debugging**

These endpoints provide deep insight into the Phase 3 orchestration system for debugging automated print job workflows, monitoring real-time job processing, and troubleshooting workflow execution issues. Essential for developers and operators to understand system behavior during lights-out manufacturing operations.

## Get Orchestration Status

### GET `/api/orchestration/status`

- **Description:** **[DEBUG ENDPOINT]** Retrieves comprehensive orchestration system status including job processing statistics, active workflows, memory usage, and system metrics. This endpoint exposes internal orchestrator state for debugging workflow execution issues and monitoring system health during automated operations.
- **Debugging Purpose:**
  - **Workflow Monitoring:** Track how many jobs are actively being processed by the orchestrator
  - **Performance Analysis:** Monitor job completion rates, failure rates, and average processing times
  - **System Health:** Check memory usage, uptime, and overall system stability
  - **Polling Status:** Verify that the 5-second polling system is active and functioning
  - **Troubleshooting:** Identify if job processing is enabled and if there are any stuck workflows
- **Response (200 OK):**

    ```json
    {
        "success": true,
        "data": {
            "timestamp": "2025-09-28T10:30:00.000Z",
            "phase3": {
                "orchestrator": {
                    "initialized": true,
                    "job_processing_enabled": true,
                    "polling_active": true,
                    "active_workflows": 2,
                    "statistics": {
                        "jobs_processed": 15,
                        "jobs_completed": 12,
                        "jobs_failed": 1,
                        "average_completion_time_minutes": 45
                    }
                },
                "activeJobs": 2,
                "monitoring": [
                    {
                        "jobId": 1,
                        "status": "printing",
                        "progress_percent": 75,
                        "printer_id": 1
                    }
                ]
            },
            "system": {
                "uptime": 86400,
                "memory": {
                    "used": 125829120,
                    "total": 536870912
                },
                "nodeVersion": "v18.17.0"
            }
        }
    }
    ```

## Get Active Jobs

### GET `/api/orchestration/active-jobs`

- **Description:** **[DEBUG ENDPOINT]** Retrieves detailed information about currently active print jobs being monitored by the orchestration system. This endpoint exposes the internal job monitoring state, including workflow stages, slot assignments, and real-time progress tracking.
- **Debugging Purpose:**
  - **Workflow Debugging:** See exactly which jobs are in which workflow stages (waiting, printing, ejecting, storing)
  - **Slot Assignment Tracking:** Verify that jobs have been assigned proper storage and grab slots
  - **Progress Monitoring:** Track real-time print progress and identify stuck or stalled jobs
  - **Concurrency Analysis:** Monitor how many jobs are being processed simultaneously
  - **Timing Analysis:** Check start times and duration of active workflows
  - **Orchestration State:** Understand the current orchestration status for each job (waiting, printing, ejecting, storing, completed, paused)
- **Response (200 OK):**

    ```json
    {
        "success": true,
        "data": {
            "activeJobs": 2,
            "jobs": [
                {
                    "jobId": 1,
                    "printerId": 1,
                    "status": "printing",
                    "progress_percent": 75,
                    "orchestration_status": "printing",
                    "assigned_store_slot": 3,
                    "assigned_grab_slot": 1,
                    "started_at": "2025-09-28T09:30:00.000Z"
                },
                {
                    "jobId": 2,
                    "printerId": 2,
                    "status": "queued",
                    "progress_percent": 0,
                    "orchestration_status": "waiting",
                    "assigned_store_slot": 4,
                    "assigned_grab_slot": 2,
                    "started_at": null
                }
            ]
        }
    }
    ```

## Health Check

### GET `/api/orchestration/health`

- **Description:** **[DEBUG ENDPOINT]** Performs a comprehensive health check on all Phase 3 orchestration services and dependencies. This endpoint validates that all components required for automated workflow execution are operational and responsive.
- **Debugging Purpose:**
  - **Service Validation:** Verify that orchestrator, job processing, and database services are operational
  - **Dependency Checking:** Ensure all required components for lights-out operation are available
  - **System Diagnostics:** Identify specific service failures or performance issues
  - **Uptime Monitoring:** Track how long the orchestration system has been running
  - **Production Monitoring:** Continuous health monitoring for 24/7 manufacturing operations
  - **Issue Identification:** Get specific error messages for failed components
  - **Recovery Planning:** Understand which services need attention during troubleshooting
- **Response (200 OK - Healthy):**

    ```json
    {
        "success": true,
        "data": {
            "status": "healthy",
            "timestamp": "2025-09-28T10:30:00.000Z",
            "services": {
                "orchestrator": "operational",
                "job_processing": "active",
                "database": "connected"
            },
            "uptime_seconds": 86400
        }
    }
    ```

- **Response (503 Service Unavailable - Unhealthy):**

    ```json
    {
        "success": false,
        "data": {
            "status": "unhealthy",
            "timestamp": "2025-09-28T10:30:00.000Z",
            "services": {
                "orchestrator": "operational",
                "job_processing": "failed",
                "database": "connected"
            },
            "issues": [
                "Job processing service is not responding"
            ]
        }
    }
    ```

## Restart Print Dispatch Service

### POST `/api/orchestration/restart`

- **Description:** **[DEBUG ENDPOINT]** Restarts the orchestrator job processing service to recover from errors, apply configuration changes, or reset stuck workflows. This is a critical debugging tool for production environments when automated workflows become unresponsive or need to be reset.
- **Debugging Purpose:**
  - **Error Recovery:** Restart the service when job processing becomes stuck or unresponsive
  - **Memory Cleanup:** Clear potential memory leaks or accumulated state issues
  - **Configuration Reload:** Apply new configuration changes without full system restart
  - **Workflow Reset:** Clear stuck or corrupted workflow states
  - **Interval Management:** Reset the 5-second polling intervals if they become desynchronized
  - **Production Recovery:** Quick recovery method for 24/7 manufacturing environments
  - **Development Testing:** Reset orchestrator state during development and testing
  - **Graceful Recovery:** Maintain system stability while recovering from service issues
- **Usage Notes:**
  - Service will pause for 1 second before restarting to ensure clean shutdown
  - Active jobs may be re-evaluated after restart
  - Database connections and printer connections remain intact
  - Use when orchestrator status shows issues but system health is otherwise good
- **Response (200 OK):**

    ```json
    {
        "success": true,
        "message": "Orchestrator job processing restarted successfully",
        "timestamp": "2025-09-28T10:30:00.000Z"
    }
    ```

- **Response (500 Internal Server Error):**

    ```json
    {
        "success": false,
        "error": "Failed to restart orchestrator job processing",
        "message": "Service restart timeout after 30 seconds"
    }
    ```

---
