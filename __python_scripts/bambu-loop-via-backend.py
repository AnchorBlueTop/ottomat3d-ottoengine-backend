import time
import requests # To make HTTP requests to the backend API
import json     # For handling JSON request bodies

# --- Configuration ---
# TODO: USER - Update these values as per your setup
BACKEND_BASE_URL = "http://localhost:3000/api" # Your backend API base URL

# IDs of devices PRE-REGISTERED in the backend via Postman or other means
PRINTER_ID = 1
OTTOEJECT_ID = 1 # As registered in the backend (e.g., using IP 192.168.68.74)

# Default registration data for devices if they don't exist
DEFAULT_PRINTER_REGISTRATION_DATA = {
    "name": "My_P1P_AutoReg", # Or your preferred default name
    "brand": "Bambu Lab",
    "model": "P1P",
    "type": "FDM", # For v0.1, backend doesn't use this for PrinterStateManager init query, uses brand
    "ip_address": "192.168.68.58", # TODO: USER - Ensure this is your P1P's IP
    "access_code": "14358945",   # TODO: USER - Ensure this is your P1P's access code
    "serial_number": "01S00C371700385", # TODO: USER - Ensure this is your P1P's serial
    # build_volume can be added here if desired for registration
    # "build_volume": {"width_mm": 256, "depth_mm": 256, "height_mm": 256}
}

DEFAULT_OTTOEJECT_REGISTRATION_DATA = {
    "device_name": "OttoEject_AutoReg", # Or your preferred default name
    "ip_address": "192.168.68.74" # TODO: USER - Ensure this is your OttoEject's IP
    # For v0.1, gantry_size_mm and storage_rack are not part of registration body
}

# Filenames (must be on the printer's SD card for v0.1)
FILENAME_1 = 'PrintTestCubex1_V3.gcode.3mf' # Make sure this matches your test file
FILENAME_2 = 'PrintTestCubex2_V1.gcode.3mf' # Example
FILENAME_3 = 'PrintTestCubex4_V1.gcode.3mf' # Example

# Define print jobs
# 'store_slot_number' and 'grab_slot_number' refer to the number in your Klipper macros
# (e.g., STORE_TO_SLOT_3, GRAB_FROM_SLOT_1)
PRINT_JOBS = {
    "1": {
        "id": 1,
        "filename": FILENAME_1,
        "ottoeject_params": {
            "store_slot_number": 3, # For STORE_TO_SLOT_3
            "grab_slot_number": 2   # For GRAB_FROM_SLOT_2 (for next plate)
        }
    },
    "2": {
        "id": 2,
        "filename": FILENAME_2,
        "ottoeject_params": {
            "store_slot_number": 4,
            "grab_slot_number": 1
        }
    },
    "3": {
        "id": 3,
        "filename": FILENAME_3,
        "ottoeject_params": {
            "store_slot_number": 5,
            # No grab_slot_number if it's the last job and not loading another plate
        }
    }
}

# --- Helper Functions for Logging ---
def log_info(message):
    print(f"[INFO] {time.strftime('%Y-%m-%d %H:%M:%S')} - {message}")

def log_warn(message):
    print(f"[WARN] {time.strftime('%Y-%m-%d %H:%M:%S')} - {message}")

def log_error(message):
    print(f"[ERROR] {time.strftime('%Y-%m-%d %H:%M:%S')} - {message}")

# --- Helper Functions for API Interaction ---

def get_api_data(url, endpoint_name="Endpoint"):
    """Generic GET request helper."""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status() 
        return response.json()
    except requests.exceptions.RequestException as e:
        log_error(f"Error getting data from {endpoint_name} ({url}): {e}")
        return None

def post_api_data(url, payload, endpoint_name="Endpoint", request_timeout=15):
    """Generic POST request helper."""
    is_ottoeject_macro = "ottoeject" in url and "macros" in url # Flag to identify ottoeject macro calls

    try:
        log_info(f"Sending POST to {endpoint_name} ({url}) with payload: {json.dumps(payload)[:200]}...") # Log truncated payload
        response = requests.post(url, json=payload, timeout=request_timeout)
        
        # For OttoEject macros, even a 502 might mean the command was sent if the backend relays a timeout message
        if is_ottoeject_macro and response.status_code == 502:
            try:
                error_json = response.json()
                if error_json.get("message", "").lower().count("timeout") or \
                   error_json.get("message", "").lower().count("econnaborted"):
                    log_warn(f"Backend reported 502 for OttoEject macro '{payload.get('macro')}', likely due to device ack timeout: {error_json.get('message')}")
                    log_warn("Assuming macro was dispatched. Will proceed to poll status.")
                    return {"status": "accepted_presumed_timeout", "message": error_json.get("message")}
            except ValueError: # Not JSON
                log_error(f"Received 502 for OttoEject macro but response was not valid JSON: {response.text}")
            # If not a recognized timeout message within the 502, re-raise to treat as normal error
            response.raise_for_status() # Re-raise for other 502s or if not JSON

        response.raise_for_status() # Raise an exception for other HTTP errors (4xx, other 5xx)
        
        log_info(f"{endpoint_name} command POST successful. Backend response: {response.json().get('message', response.text)}")
        return response.json()
        
    except requests.exceptions.Timeout: # This is a timeout from Python's request to the backend
        if is_ottoeject_macro:
            log_warn(f"Python requests.post timed out sending OttoEject macro '{payload.get('macro')}' to backend ({url}).")
            log_warn("Assuming macro was dispatched by backend before timeout. Will proceed to poll status.")
            return {"status": "accepted_python_timeout", "message": "Python request to backend timed out, assuming command sent."}
        else: # For other endpoints, a timeout is a clearer failure
            log_error(f"Timeout sending POST to {endpoint_name} ({url})")
            return None
            
    except requests.exceptions.RequestException as e:
        log_error(f"Error sending POST to {endpoint_name} ({url}): {e}")
        if e.response is not None:
            log_error(f"Response status: {e.response.status_code}, content: {e.response.text}")
        return None


def get_printer_status(printer_id):
    """Polls the backend for the printer's status."""
    return get_api_data(f"{BACKEND_BASE_URL}/printers/{printer_id}/status", "Printer Status")

def get_ottoeject_status(ottoeject_id):
    """Polls the backend for the OttoEject's status."""
    return get_api_data(f"{BACKEND_BASE_URL}/ottoeject/{ottoeject_id}/status", "Ottoeject Status")

def send_printer_command_start_print(printer_id, filename_on_printer, print_options=None):
    """Sends a start print command to the printer via the backend."""
    payload = {"filename": filename_on_printer}
    if print_options:
        payload.update(print_options)
    return post_api_data(f"{BACKEND_BASE_URL}/printers/{printer_id}/start-print", payload, "Start Print")

def send_printer_gcode(printer_id, gcode_command):
    """Sends a G-code command to the printer via the backend."""
    payload = {"gcode": gcode_command}
    return post_api_data(f"{BACKEND_BASE_URL}/printers/{printer_id}/send-gcode", payload, "Send G-code")

def execute_ottoeject_macro(ottoeject_id, macro_name, params=None):
    """Executes a macro on the OttoEject via the backend."""
    payload = {"macro": macro_name}
    if params:
        payload["params"] = params
    
    # OttoEject macros can be long for the device to ACK to backend, so Python's timeout to backend is 45s.
    # Backend has its own timeout to Moonraker (e.g., 30s).
    response_data = post_api_data(
        f"{BACKEND_BASE_URL}/ottoeject/{ottoeject_id}/macros", 
        payload, 
        f"Ottoeject Macro '{macro_name}'", 
        request_timeout=45 # Python timeout for call to backend
    )

    if response_data:
        # Check if it was a successful dispatch (2xx from backend)
        # OR if it was a recognized timeout scenario where we assume dispatch
        if response_data.get("message","").lower().count("sent") or \
           response_data.get("status","") in ["accepted_presumed_timeout", "accepted_python_timeout"]:
            log_info(f"OttoEject macro '{macro_name}' considered dispatched (backend msg: '{response_data.get('message')}'). Proceeding to poll.")
            return True # Indicates command was dispatched (or presumed dispatched)
        else:
            log_error(f"Dispatch of OttoEject macro '{macro_name}' failed or backend returned unexpected error. Response: {response_data}")
            return False
    else:
        # post_api_data returned None, indicating a more definite error during the API call itself
        log_error(f"API call for OttoEject macro '{macro_name}' failed critically.")
        return False


def wait_for_ottoeject_idle(ottoeject_id, poll_interval=3, timeout_seconds=180):
    log_info(f"Waiting for OttoEject ID {ottoeject_id} to become ONLINE...")
    start_time = time.time()
    while True:
        if time.time() - start_time > timeout_seconds:
            log_error(f"Timeout waiting for OttoEject ID {ottoeject_id} to become ONLINE.")
            return False
        
        status_data = get_ottoeject_status(ottoeject_id)
        if status_data:
            current_device_status = status_data.get("status", "UNKNOWN").upper()
            log_info(f"Ottoeject ID {ottoeject_id} current status from backend: {current_device_status}")
            if current_device_status == "ONLINE":
                log_info(f"Ottoeject ID {ottoeject_id} is ONLINE.")
                return True
        else:
            log_info(f"Could not get OttoEject ID {ottoeject_id} status via backend, retrying...")
        
        time.sleep(poll_interval)

def get_printer_details(printer_id):
    """Gets full details of a printer if it exists."""
    url = f"{BACKEND_BASE_URL}/printers/{printer_id}"
    log_info(f"Attempting to GET printer details for ID {printer_id} from {url}")
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 404:
            log_info(f"Printer ID {printer_id} not found (404).")
            return None # Explicitly return None for not found
        response.raise_for_status() # Raise an exception for other HTTP errors
        return response.json()
    except requests.exceptions.RequestException as e:
        log_error(f"Error getting printer details for ID {printer_id}: {e}")
        return None # Treat other errors as "not available" for this check

def register_printer(printer_data):
    """Registers a new printer via the backend."""
    url = f"{BACKEND_BASE_URL}/printers/"
    log_info(f"Attempting to register printer: {printer_data.get('name')}")
    return post_api_data(url, printer_data, "Register Printer")

def get_ottoeject_details(ottoeject_id):
    """Gets full details of an OttoEject if it exists."""
    url = f"{BACKEND_BASE_URL}/ottoeject/{ottoeject_id}"
    log_info(f"Attempting to GET OttoEject details for ID {ottoeject_id} from {url}")
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 404:
            log_info(f"Ottoeject ID {ottoeject_id} not found (404).")
            return None
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        log_error(f"Error getting OttoEject details for ID {ottoeject_id}: {e}")
        return None

def register_ottoeject(ottoeject_data):
    """Registers a new OttoEject via the backend."""
    url = f"{BACKEND_BASE_URL}/ottoeject/"
    log_info(f"Attempting to register OttoEject: {ottoeject_data.get('device_name')}")
    return post_api_data(url, ottoeject_data, "Register OttoEject")

def wait_for_printer_idle(printer_id, poll_interval=2, timeout_seconds=60):
    """Waits for the printer to become 'IDLE' by polling its status via the backend."""
    log_info(f"Waiting for printer ID {printer_id} to become IDLE...")
    start_time = time.time()
    while True:
        if time.time() - start_time > timeout_seconds:
            log_error(f"Timeout waiting for printer ID {printer_id} to become IDLE.")
            return False
        
        status_data = get_printer_status(printer_id)
        if status_data:
            main_status = status_data.get("status", "UNKNOWN").upper()
            current_stage = status_data.get("current_stage", "N/A")
            log_info(f"Printer ID {printer_id} current status: {main_status}, stage: {current_stage}")
            if main_status == "IDLE":
                log_info(f"Printer ID {printer_id} is IDLE.")
                return True
        else:
            log_info(f"Could not get printer ID {printer_id} status, retrying...")
        
        time.sleep(poll_interval)

# --- Main Workflow Functions ---

def initial_device_check(printer_id_to_check, ottoeject_id_to_check):
    log_info("--- Initial Device Setup and Check ---")
    printer_ok = False
    ottoeject_ok = False

    # --- Printer Check & Registration ---
    log_info(f"Checking for Printer ID {printer_id_to_check}...")
    printer_details = get_printer_details(printer_id_to_check) # Tries GET /api/printers/:id
    
    if printer_details: # Printer exists in backend DB
        log_info(f"Printer ID {printer_id_to_check} found in backend: {printer_details.get('name')}")
        p_status_data = get_printer_status(printer_id_to_check) # Polls GET /api/printers/:id/status
        if p_status_data and p_status_data.get("status"):
            p_main_status = p_status_data.get("status").upper()
            log_info(f"Current status of pre-existing Printer ID {printer_id_to_check}: {p_main_status} (Stage: {p_status_data.get('current_stage')})")
            if p_main_status in ["IDLE", "FINISH"]: # IDLE or FINISH are acceptable starting states
                printer_ok = True
                log_info(f"Printer ID {printer_id_to_check} is in an acceptable state: {p_main_status}")
            elif p_main_status in ["OFFLINE", "UNKNOWN"]:
                 log_error(f"Pre-existing Printer ID {printer_id_to_check} is {p_main_status}. Cannot proceed.")
                 # printer_ok remains False
            else: # E.g., RUNNING, PAUSED, specific active stage
                log_error(f"Pre-existing Printer ID {printer_id_to_check} is busy. Status: {p_main_status}, Stage: {p_status_data.get('current_stage')}. Manual intervention needed.")
                # printer_ok remains False
        else:
            log_error(f"Found Printer ID {printer_id_to_check} in backend, but could not get its live status. Assuming not ready.")
            # printer_ok remains False
    else: # Printer not found in backend, attempt to register
        log_info(f"Printer ID {printer_id_to_check} not found in backend. Attempting to register default printer...")
        reg_response = register_printer(DEFAULT_PRINTER_REGISTRATION_DATA)
        if reg_response and reg_response.get("id"):
            log_info(f"Default printer registered successfully via backend. Response: {reg_response}")
            log_info("Pausing for ~5 seconds for backend to initialize printer connection and for printer to report initial status...")
            time.sleep(5) # Increased pause to allow PrinterStateManager to connect fully and get first data
            
            p_status_data_after_reg = get_printer_status(printer_id_to_check)
            if p_status_data_after_reg and p_status_data_after_reg.get("status"):
                p_main_status_after_reg = p_status_data_after_reg.get("status").upper()
                log_info(f"Status of newly registered Printer ID {printer_id_to_check}: {p_main_status_after_reg} (Stage: {p_status_data_after_reg.get('current_stage')})")
                # For a newly registered printer, IDLE or FINISH is great.
                # OFFLINE/UNKNOWN might occur if connection is still pending or if printer is genuinely off.
                # The first call to start_print_and_wait will then more rigorously check before printing.
                if p_main_status_after_reg in ["IDLE", "FINISH", "OFFLINE", "UNKNOWN"]:
                    log_info(f"Newly registered printer status ({p_main_status_after_reg}) is acceptable for initial check. Further checks before printing.")
                    printer_ok = True
                else: # e.g. RUNNING immediately after registration - very unlikely but covers edge cases
                    log_error(f"Newly registered printer in unexpected state: {p_main_status_after_reg}. Check printer and backend logs.")
                    # printer_ok remains False
            else:
                log_error(f"Registered printer, but subsequent status check failed to get data. Assuming not ready.")
                # printer_ok remains False
        else:
            log_error(f"Failed to register default printer. Response: {reg_response}")
            # printer_ok remains False

    # --- OttoEject Check & Registration ---
    log_info(f"Checking for OttoEject ID {ottoeject_id_to_check}...")
    ottoeject_details = get_ottoeject_details(ottoeject_id_to_check)
    if ottoeject_details:
        log_info(f"Ottoeject ID {ottoeject_id_to_check} found: {ottoeject_details.get('device_name')}")
        if wait_for_ottoeject_idle(ottoeject_id_to_check):
            ottoeject_ok = True
    else:
        log_info(f"Ottoeject ID {ottoeject_id_to_check} not found. Attempting to register default OttoEject...")
        reg_response = register_ottoeject(DEFAULT_OTTOEJECT_REGISTRATION_DATA)
        if reg_response and reg_response.get("id"):
            log_info(f"Default OttoEject registered successfully. Response: {reg_response}")
            time.sleep(3) 
            if wait_for_ottoeject_idle(ottoeject_id_to_check):
                ottoeject_ok = True
        else:
            log_error(f"Failed to register default OttoEject. Response: {reg_response}")
    
    if not (printer_ok and ottoeject_ok):
        log_error(f"Initial device setup/check failed. Printer OK: {printer_ok}, OttoEject OK: {ottoeject_ok}. Exiting.")
        exit()
    log_info(f"--- Initial Device Setup and Check Passed (Printer OK: {printer_ok}, OttoEject OK: {ottoeject_ok}) ---")


def start_print_and_wait(printer_id, filename):
    log_info(f"--- Starting Print Job: {filename} ---")
    # Optional: Add print options if your backend/API supports them for start-print
    # print_options = {"useAms": False, "bed_leveling": True} 
    # if not send_printer_command_start_print(printer_id, filename, print_options):
    start_print_response = send_printer_command_start_print(printer_id, filename)
    if not start_print_response or not start_print_response.get("message", "").lower().count("sent"): # Check if 'sent' is in message
        log_error(f"Failed to initiate print for {filename} or command not accepted by backend. Response: {start_print_response}")
        return False

    log_info(f"Print for {filename} initiated via backend. Monitoring for completion...")
    time.sleep(10) 
    consecutive_idle_checks_low_progress = 0

    while True:
        status_data = get_printer_status(printer_id)
        if not status_data:
            log_error("Failed to get printer status during print. Will retry.")
            time.sleep(15)
            continue

        main_status = status_data.get("status", "UNKNOWN").upper()
        current_stage = status_data.get("current_stage", "N/A")
        progress = status_data.get("progress_percent") # Can be None/null
        remaining_time = status_data.get("remaining_time_minutes") # Can be None/null

        progress_str = f"{progress}%" if progress is not None else "N/A"
        remaining_time_str = f"{remaining_time} min" if remaining_time is not None else "N/A"
        
        log_info(f"Printer Live Status: {main_status} | Stage: {current_stage} | Progress: {progress_str} | Remaining: {remaining_time_str}")

        if main_status == "FINISH":
            log_info(f"Print job '{filename}' reported GCODE_STATE: FINISH by printer.")
            log_info("Printer has finished the G-code file. Proceeding to ejection readiness.")
            # It's good practice to ensure the printer is truly settled before ejection,
            # even if it's quick. A very short pause and one final check for IDLE can be beneficial
            # without causing a long hang if it stays in FINISH.
            # If printer goes IDLE quickly, this is fine. If it stays FINISH, we proceed.
            time.sleep(3) # Short pause
            final_status_data = get_printer_status(printer_id)
            final_main_status = final_status_data.get("status", "UNKNOWN").upper() if final_status_data else "UNKNOWN"
            
            if final_main_status == "IDLE":
                log_info(f"Printer confirmed IDLE shortly after FINISH. Ready for ejection.")
            elif final_main_status == "FINISH":
                log_info(f"Printer remains in FINISH state. Assuming safe to proceed with ejection.")
            else:
                log_warn(f"Printer state changed unexpectedly after FINISH to {final_main_status}. Proceeding with caution.")
            
            return True # Print considered complete and ready for next steps

        elif main_status == "IDLE":
            # If it becomes IDLE, check progress. If 100%, it's done.
            if progress is not None and progress >= 99: # Using >= 99 for safety
                 log_info(f"Print job '{filename}' is {progress}% and IDLE. Assuming complete.")
                 return True
            # If it's IDLE with low progress for too long, it might be an issue.
            elif progress is not None and progress < 10:
                consecutive_idle_checks_low_progress += 1
                if consecutive_idle_checks_low_progress > 6: # About 30-60 seconds of idle with no progress
                     log_error(f"Printer remained IDLE with low progress ({progress_str}) for '{filename}'. Aborting job.")
                     return False
                log_warn(f"Printer IDLE, progress {progress_str}. Check {consecutive_idle_checks_low_progress}/6 before assuming error.")
            else: # IDLE but progress is significant but not 100, or progress is None
                log_info(f"Printer IDLE, progress {progress_str}. Waiting for state change or completion signal.")
                # This case might need more nuanced handling or longer observation if it's legitimately paused post-print before 'FINISH' state.
                # For now, relies on FINISH state or 100% + IDLE.

        elif main_status in ["PAUSED", "FAILED"]:
            log_error(f"Print job '{filename}' is in critical state: {main_status}. Stage: {current_stage}. Halting automation.")
            return False 
        
        if main_status != "IDLE" or (progress is not None and progress < 10):
            consecutive_idle_checks_low_progress = 0 # Reset if not suspicious IDLE
            
        poll_delay = 30 
        if remaining_time is not None:
            if remaining_time > 10: poll_delay = 60
            elif remaining_time > 2: poll_delay = 30
            elif remaining_time >= 0 : poll_delay = 10 # More frequent polling when close to end
        
        log_info(f"Checking printer status again in {poll_delay} seconds...")
        time.sleep(poll_delay)


def perform_ejection_sequence(ottoeject_id, printer_id, job_params):
    store_slot_num = job_params.get("store_slot_number")
    grab_slot_num = job_params.get("grab_slot_number")

    log_info(f"--- Starting Ejection Sequence (Store in slot {store_slot_num}) ---")

    # Optional: Position printer bed if your EJECT_FROM_P1 macro doesn't do it.
    # log_info("Positioning printer bed for ejection...")
    # if not send_printer_gcode(printer_id, "G0 Z150 F3000"): return False
    # if not wait_for_printer_idle(printer_id): return False

    if not execute_ottoeject_macro(ottoeject_id, "OTTOEJECT_HOME"): return False
    if not wait_for_ottoeject_idle(ottoeject_id): return False

    log_info("Executing EJECT_FROM_P1 macro...")
    if not execute_ottoeject_macro(ottoeject_id, "EJECT_FROM_P1"): return False
    if not wait_for_ottoeject_idle(ottoeject_id): return False
    
    if not store_slot_num:
        log_error("Store slot number not defined in job_params for Ejection Sequence.")
        return False
    store_macro_name = f"STORE_TO_SLOT_{store_slot_num}"
    log_info(f"Executing {store_macro_name} macro...")
    if not execute_ottoeject_macro(ottoeject_id, store_macro_name): return False
    if not wait_for_ottoeject_idle(ottoeject_id): return False

    if grab_slot_num:
        grab_macro_name = f"GRAB_FROM_SLOT_{grab_slot_num}"
        log_info(f"Executing {grab_macro_name} macro...")
        if not execute_ottoeject_macro(ottoeject_id, grab_macro_name): return False
        if not wait_for_ottoeject_idle(ottoeject_id): return False

        log_info("Executing LOAD_ONTO_P1 macro...")
        if not execute_ottoeject_macro(ottoeject_id, "LOAD_ONTO_P1"): return False
        if not wait_for_ottoeject_idle(ottoeject_id): return False
    else:
        log_info("No grab_slot_number specified, skipping new plate loading.")

    log_info("Executing PARK_OTTOEJECT macro...")
    if not execute_ottoeject_macro(ottoeject_id, "PARK_OTTOEJECT"): return False
    if not wait_for_ottoeject_idle(ottoeject_id): return False

    log_info("--- Ejection Sequence Completed ---")
    return True

# --- Main Execution ---
if __name__ == '__main__':
    log_info("===== OTTOMAT3D v0.1 - Python Control Script via Backend API =====")
    log_info(f"Target Printer ID: {PRINTER_ID}, OttoEject ID: {OTTOEJECT_ID}")
    log_info(f"Backend API URL: {BACKEND_BASE_URL}")

    initial_device_check(PRINTER_ID, OTTOEJECT_ID)
    
    job_count = len(PRINT_JOBS)
    completed_jobs_successfully = 0

    for job_number_str, job_details in PRINT_JOBS.items():
        log_info(f"\n>>> Processing Job ID {job_details['id']} of {job_count}: File '{job_details['filename']}' <<<")

        if start_print_and_wait(PRINTER_ID, job_details["filename"]):
            log_info(f"Print for job {job_details['id']} ('{job_details['filename']}') completed.")

            if perform_ejection_sequence(OTTOEJECT_ID, PRINTER_ID, job_details["ottoeject_params"]):
                log_info(f"Ejection sequence for job {job_details['id']} completed.")
                completed_jobs_successfully += 1
            else:
                log_error(f"Ejection sequence FAILED for job {job_details['id']}. Halting automation.")
                break 
        else:
            log_error(f"Print FAILED or did not complete for job {job_details['id']}. Halting automation.")
            break 

        if job_details['id'] < job_count:
             log_info("Cooling down and preparing for next job...")
             time.sleep(15) # Brief pause
        else:
             log_info("Final job in sequence processed.")

    log_info(f"\n===== Automation Loop Finished. Successfully completed {completed_jobs_successfully}/{job_count} jobs. =====")

    # Optional final park, though perform_ejection_sequence should leave it parked.
    # log_info("Final park check for OttoEject...")
    # execute_ottoeject_macro(OTTOEJECT_ID, "PARK_OTTOEJECT")
    # wait_for_ottoeject_idle(OTTOEJECT_ID)
    log_info("Script finished.")