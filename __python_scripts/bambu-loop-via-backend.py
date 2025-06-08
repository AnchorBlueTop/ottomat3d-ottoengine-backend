import time
import requests # To make HTTP requests to the backend API
import json     # For handling JSON request bodies

# --- Configuration ---
# TODO: USER - Update these values as per your setup
BACKEND_BASE_URL = "http://localhost:3000/api" # Your backend API base URL

# IDs of devices PRE-REGISTERED in the backend via Postman or other means
PRINTER_ID = 1
OTTOEJECT_ID = 1 # As registered in the backend (e.g., using IP 192.168.68.79)

# Default registration data for devices if they don't exist
DEFAULT_PRINTER_REGISTRATION_DATA = {
    "name": "My_P1P_AutoReg", # Or your preferred default name
    "brand": "Bambu Lab",
    "model": "P1P",
    "type": "FDM", 
    "ip_address": "192.168.68.68", # TODO: USER - Ensure this is your P1P's IP
    "access_code": "14358945",   # TODO: USER - Ensure this is your P1P's access code
    "serial_number": "01S00C371700385", # TODO: USER - Ensure this is your P1P's serial
}

DEFAULT_OTTOEJECT_REGISTRATION_DATA = {
    "device_name": "OttoEject_AutoReg", 
    "ip_address": "192.168.68.79" # TODO: USER - Ensure this is your OttoEject's IP
}


FILENAME_1 = 'SimpleCube.gcode.3mf' # NO Z150 AT THE END OF THIS FILE.
FILENAME_2 = 'SimpleCube.gcode.3mf' 
FILENAME_3 = 'SimpleCube.gcode.3mf'

PRINT_JOBS = {
    "1": { 
        "id": 1, 
        "filename": FILENAME_1, 
        "ottoeject_params": {
            "store_slot_number": 3, 
            "grab_slot_number": 2  
        }
    },
    "2": {
        "id": 2,
        "filename": FILENAME_2,
        "ottoeject_params": {
            "store_slot_number": 4,
            "grab_slot_number": 1 
        }
    }
    # Add more jobs if needed, e.g.:
    # "3": {
    #     "id": 3,
    #     "filename": FILENAME_3,
    #     "ottoeject_params": {
    #         "store_slot_number": 5,
    #         # No grab_slot_number if it's the last job and not loading another plate
    #     }
    # }
}


# Z-axis height for ejection
Z_POSITION_FOR_EJECTION = 150
GCODE_Z_POSITION_COMMAND = f"G90\nG1 Z{Z_POSITION_FOR_EJECTION} F3000"
Z_MOVE_PROCESSING_DELAY_SECONDS = 5 # Fixed delay after sending Z-move command

# Delay for the first print job before starting active polling
FIRST_JOB_INITIAL_WAIT_SECONDS = 120 # 2 minutes

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
    is_ottoeject_macro = "ottoeject" in url and "macros" in url 

    try:
        log_info(f"Sending POST to {endpoint_name} ({url}) with payload: {json.dumps(payload)[:200]}...") 
        response = requests.post(url, json=payload, timeout=request_timeout)
        
        if is_ottoeject_macro and response.status_code == 502:
            try:
                error_json = response.json()
                if error_json.get("message", "").lower().count("timeout") or \
                   error_json.get("message", "").lower().count("econnaborted"):
                    log_warn(f"Backend reported 502 for OttoEject macro '{payload.get('macro')}', likely due to device ack timeout: {error_json.get('message')}")
                    log_warn("Assuming macro was dispatched. Will proceed to poll status.")
                    return {"status": "accepted_presumed_timeout", "message": error_json.get("message"), "status_code": response.status_code}
            except ValueError: 
                log_error(f"Received 502 for OttoEject macro but response was not valid JSON: {response.text}")
            response.raise_for_status() 

        response.raise_for_status() 
        
        try:
            response_json = response.json()
            log_info(f"{endpoint_name} command POST successful. Backend response: {response_json.get('message', response.text)}")
            if 'status_code' not in response_json: # Ensure status_code is part of the returned dict
                response_json['status_code'] = response.status_code
            return response_json
        except ValueError: 
            log_info(f"{endpoint_name} command POST successful. Backend response (non-JSON): {response.text}")
            return {"message": response.text, "status_code": response.status_code}
        
    except requests.exceptions.Timeout: 
        if is_ottoeject_macro:
            log_warn(f"Python requests.post timed out sending OttoEject macro '{payload.get('macro')}' to backend ({url}).")
            log_warn("Assuming macro was dispatched by backend before timeout. Will proceed to poll status.")
            return {"status": "accepted_python_timeout", "message": "Python request to backend timed out, assuming command sent.", "status_code": 504} # Using 504 for gateway timeout
        else: 
            log_error(f"Timeout sending POST to {endpoint_name} ({url})")
            return None
            
    except requests.exceptions.RequestException as e:
        log_error(f"Error sending POST to {endpoint_name} ({url}): {e}")
        if e.response is not None:
            log_error(f"Response status: {e.response.status_code}, content: {e.response.text}")
        return None


def get_printer_status(printer_id):
    return get_api_data(f"{BACKEND_BASE_URL}/printers/{printer_id}/status", "Printer Status")

def get_ottoeject_status(ottoeject_id):
    return get_api_data(f"{BACKEND_BASE_URL}/ottoeject/{ottoeject_id}/status", "Ottoeject Status")

def send_printer_command_start_print(printer_id, filename_on_printer, print_options=None):
    payload = {"filename": filename_on_printer}
    if print_options:
        payload.update(print_options)
    return post_api_data(f"{BACKEND_BASE_URL}/printers/{printer_id}/start-print", payload, "Start Print")

def send_printer_gcode(printer_id, gcode_command):
    payload = {"gcode": gcode_command}
    return post_api_data(f"{BACKEND_BASE_URL}/printers/{printer_id}/send-gcode", payload, "Send G-code", request_timeout=20)

def execute_ottoeject_macro(ottoeject_id, macro_name, params=None):
    payload = {"macro": macro_name}
    if params:
        payload["params"] = params
    
    response_data = post_api_data(
        f"{BACKEND_BASE_URL}/ottoeject/{ottoeject_id}/macros", 
        payload, 
        f"Ottoeject Macro '{macro_name}'", 
        request_timeout=45 
    )

    if response_data:
        if response_data.get("status_code") == 202 or \
           response_data.get("status","") in ["accepted_presumed_timeout", "accepted_python_timeout"]:
            log_info(f"OttoEject macro '{macro_name}' considered dispatched (backend status_code: {response_data.get('status_code')}, msg: '{response_data.get('message')}'). Proceeding to poll.")
            return True
        else:
            log_error(f"Dispatch of OttoEject macro '{macro_name}' failed or backend returned unexpected error. Response: {response_data}")
            return False
    else:
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
    url = f"{BACKEND_BASE_URL}/printers/{printer_id}"
    log_info(f"Attempting to GET printer details for ID {printer_id} from {url}")
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 404:
            log_info(f"Printer ID {printer_id} not found (404).")
            return None 
        response.raise_for_status() 
        return response.json()
    except requests.exceptions.RequestException as e:
        log_error(f"Error getting printer details for ID {printer_id}: {e}")
        return None

def register_printer(printer_data):
    url = f"{BACKEND_BASE_URL}/printers/"
    log_info(f"Attempting to register printer: {printer_data.get('name')}")
    return post_api_data(url, printer_data, "Register Printer")

def get_ottoeject_details(ottoeject_id):
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
    url = f"{BACKEND_BASE_URL}/ottoeject/"
    log_info(f"Attempting to register OttoEject: {ottoeject_data.get('device_name')}")
    return post_api_data(url, ottoeject_data, "Register OttoEject")

def wait_for_printer_idle(printer_id, poll_interval=2, timeout_seconds=60):
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

    log_info(f"Checking for Printer ID {printer_id_to_check}...")
    printer_details = get_printer_details(printer_id_to_check) 
    
    if printer_details: 
        log_info(f"Printer ID {printer_id_to_check} found in backend: {printer_details.get('name')}")
        p_status_data = get_printer_status(printer_id_to_check) 
        if p_status_data and p_status_data.get("status"):
            p_main_status = p_status_data.get("status").upper()
            log_info(f"Current status of pre-existing Printer ID {printer_id_to_check}: {p_main_status} (Stage: {p_status_data.get('current_stage')})")
            if p_main_status in ["IDLE", "FINISH"]: 
                printer_ok = True
                log_info(f"Printer ID {printer_id_to_check} is in an acceptable state: {p_main_status}")
            elif p_main_status in ["OFFLINE", "UNKNOWN"]:
                 log_error(f"Pre-existing Printer ID {printer_id_to_check} is {p_main_status}. Cannot proceed.")
            else: 
                log_error(f"Pre-existing Printer ID {printer_id_to_check} is busy. Status: {p_main_status}, Stage: {p_status_data.get('current_stage')}. Manual intervention needed.")
        else:
            log_error(f"Found Printer ID {printer_id_to_check} in backend, but could not get its live status. Assuming not ready.")
    else: 
        log_info(f"Printer ID {printer_id_to_check} not found in backend. Attempting to register default printer...")
        reg_response = register_printer(DEFAULT_PRINTER_REGISTRATION_DATA)
        if reg_response and reg_response.get("id"):
            log_info(f"Default printer registered successfully via backend. Response: {reg_response}")
            log_info(f"Pausing for {FIRST_JOB_INITIAL_WAIT_SECONDS / 2} seconds for backend to initialize printer connection...") # Shorter initial pause here
            time.sleep(FIRST_JOB_INITIAL_WAIT_SECONDS / 2) # Give some time for backend MQTT to connect
            
            p_status_data_after_reg = get_printer_status(printer_id_to_check)
            if p_status_data_after_reg and p_status_data_after_reg.get("status"):
                p_main_status_after_reg = p_status_data_after_reg.get("status").upper()
                log_info(f"Status of newly registered Printer ID {printer_id_to_check}: {p_main_status_after_reg} (Stage: {p_status_data_after_reg.get('current_stage')})")
                if p_main_status_after_reg in ["IDLE", "FINISH", "OFFLINE", "UNKNOWN"]: # OFFLINE/UNKNOWN are okay here, start_print_and_wait will handle it.
                    log_info(f"Newly registered printer status ({p_main_status_after_reg}) is acceptable for initial check.")
                    printer_ok = True
                else: 
                    log_error(f"Newly registered printer in unexpected state: {p_main_status_after_reg}. Check printer and backend logs.")
            else:
                log_error(f"Registered printer, but subsequent status check failed to get data. Assuming not ready.")
        else:
            log_error(f"Failed to register default printer. Response: {reg_response}")

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


def start_print_and_wait(printer_id, filename, is_first_job_in_sequence=False): # Added new parameter
    log_info(f"--- Starting Print Job: {filename} ---")
    start_print_response = send_printer_command_start_print(printer_id, filename)
    
    if not start_print_response or not (
        (start_print_response.get("message", "").lower().count("sent")) or 
        (start_print_response.get("status_code") == 202)
    ):
        log_error(f"Failed to initiate print for {filename} or command not accepted by backend. Response: {start_print_response}")
        return False

    log_info(f"Print for {filename} initiated via backend. Monitoring for completion...")
    
    # --- MODIFICATION FOR FIRST JOB ---
    if is_first_job_in_sequence:
        log_info(f"This is the first job in the sequence. Waiting {FIRST_JOB_INITIAL_WAIT_SECONDS} seconds before active polling to allow printer to clear old state and start new print.")
        time.sleep(FIRST_JOB_INITIAL_WAIT_SECONDS)
    else:
        time.sleep(10) # Standard initial delay for subsequent jobs
    # --- END MODIFICATION ---
    
    consecutive_idle_checks_low_progress = 0

    while True:
        status_data = get_printer_status(printer_id)
        if not status_data:
            log_error("Failed to get printer status during print. Will retry.")
            time.sleep(15)
            continue

        main_status = status_data.get("status", "UNKNOWN").upper()
        current_stage = status_data.get("current_stage", "N/A")
        progress = status_data.get("progress_percent") 
        remaining_time = status_data.get("remaining_time_minutes") 

        progress_str = f"{progress}%" if progress is not None else "N/A"
        remaining_time_str = f"{remaining_time} min" if remaining_time is not None else "N/A"
        
        log_info(f"Printer Live Status: {main_status} | Stage: {current_stage} | Progress: {progress_str} | Remaining: {remaining_time_str}")

        if main_status == "FINISH":
            log_info(f"Print job '{filename}' reported GCODE_STATE: FINISH by printer.")
            log_info("Printer has finished the G-code file. Proceeding to ejection readiness.")
            time.sleep(3) 
            final_status_data = get_printer_status(printer_id)
            final_main_status = final_status_data.get("status", "UNKNOWN").upper() if final_status_data else "UNKNOWN"
            
            if final_main_status == "IDLE":
                log_info(f"Printer confirmed IDLE shortly after FINISH. Ready for ejection.")
            elif final_main_status == "FINISH":
                log_info(f"Printer remains in FINISH state. Assuming safe to proceed with ejection.")
            else:
                log_warn(f"Printer state changed unexpectedly after FINISH to {final_main_status}. Proceeding with caution.")
            
            return True 

        elif main_status == "IDLE":
            # For the first job, we've already waited, so any IDLE state with high progress is likely the actual completion.
            # For subsequent jobs, this logic remains valid.
            if progress is not None and progress >= 99: 
                 log_info(f"Print job '{filename}' is {progress}% and IDLE. Assuming complete.")
                 return True
            elif progress is not None and progress < 10: # If it's IDLE with very low progress
                consecutive_idle_checks_low_progress += 1
                # If this is the first job, and it becomes IDLE with low progress *after* the initial 2-min wait,
                # it could indicate the print failed to start properly or finished extremely quickly (unlikely for real prints).
                # We might need a slightly different handling or just let the consecutive checks catch it.
                # For now, the existing consecutive_idle_checks_low_progress should handle it.
                if consecutive_idle_checks_low_progress > 6: 
                     log_error(f"Printer remained IDLE with low progress ({progress_str}) for '{filename}'. Aborting job.")
                     return False
                log_warn(f"Printer IDLE, progress {progress_str}. Check {consecutive_idle_checks_low_progress}/6 before assuming error.")
            else: # IDLE but progress is significant but not 100%, or progress is None
                log_info(f"Printer IDLE, progress {progress_str}. Waiting for state change or completion signal.")

        elif main_status in ["PAUSED", "FAILED"]:
            log_error(f"Print job '{filename}' is in critical state: {main_status}. Stage: {current_stage}. Halting automation.")
            return False 
        
        # Reset counter if printer is not in a suspicious IDLE state
        if not (main_status == "IDLE" and progress is not None and progress < 10):
            consecutive_idle_checks_low_progress = 0 
            
        poll_delay = 30 
        if remaining_time is not None:
            if remaining_time > 10: poll_delay = 60
            elif remaining_time > 2: poll_delay = 30
            elif remaining_time >= 0 : poll_delay = 10 
        
        log_info(f"Checking printer status again in {poll_delay} seconds...")
        time.sleep(poll_delay)


def perform_ejection_sequence(ottoeject_id, printer_id, job_params):
    store_slot_num = job_params.get("store_slot_number")
    grab_slot_num = job_params.get("grab_slot_number")

    log_info(f"--- Starting Ejection Sequence (Store in slot {store_slot_num}) ---")

    if not execute_ottoeject_macro(ottoeject_id, "OTTOEJECT_HOME"): return False
    if not wait_for_ottoeject_idle(ottoeject_id): return False

    log_info("Executing EJECT_FROM_P1 macro...") # Make sure P1 refers to your printer type if macro is specific
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

        log_info("Executing LOAD_ONTO_P1 macro...") # Make sure P1 refers to your printer type
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
    log_info(f"Printer Z-axis will be positioned to {Z_POSITION_FOR_EJECTION}mm before ejection.")
    log_info(f"First job will have an initial wait of {FIRST_JOB_INITIAL_WAIT_SECONDS} seconds after print start command.")

    initial_device_check(PRINTER_ID, OTTOEJECT_ID)
    
    job_count = len(PRINT_JOBS)
    completed_jobs_successfully = 0
    is_first_job_in_current_run = True # Flag for the first job in this script execution

    # Ensure PRINT_JOBS is not empty
    if not PRINT_JOBS:
        log_error("PRINT_JOBS dictionary is empty. No jobs to process. Exiting.")
        exit()

    for job_key in sorted(PRINT_JOBS.keys()): # Process jobs in defined order
        job_details = PRINT_JOBS[job_key]
        log_info(f"\n>>> Processing Job ID {job_details['id']} of {job_count} (Key: {job_key}): File '{job_details['filename']}' <<<")

        if start_print_and_wait(PRINTER_ID, job_details["filename"], is_first_job_in_sequence=is_first_job_in_current_run):
            log_info(f"Print for job {job_details['id']} ('{job_details['filename']}') completed.")

            log_info(f"Attempting to position printer Z-axis to {Z_POSITION_FOR_EJECTION}mm for job {job_details['id']}...")
            gcode_response = send_printer_gcode(PRINTER_ID, GCODE_Z_POSITION_COMMAND)
            
            if gcode_response and gcode_response.get("status_code") == 202:
                log_info(f"Z-axis positioning G-code ({GCODE_Z_POSITION_COMMAND.replace(chr(10),'; ')}) command accepted by backend for job {job_details['id']}.")
                log_info(f"Pausing for {Z_MOVE_PROCESSING_DELAY_SECONDS} seconds to allow Z-move to process before starting ejection...")
                time.sleep(Z_MOVE_PROCESSING_DELAY_SECONDS)
                
                if perform_ejection_sequence(OTTOEJECT_ID, PRINTER_ID, job_details["ottoeject_params"]):
                    log_info(f"Ejection sequence for job {job_details['id']} completed.")
                    completed_jobs_successfully += 1
                else:
                    log_error(f"Ejection sequence FAILED for job {job_details['id']} after attempting Z-positioning. Halting automation.")
                    break 
            else:
                log_error(f"Failed to send Z-axis positioning G-code for job {job_details['id']} (API call not accepted or failed). Response: {gcode_response}. Halting automation.")
                break 
            
        else:
            log_error(f"Print FAILED or did not complete for job {job_details['id']}. Halting automation.")
            break 

        is_first_job_in_current_run = False # No longer the first job after one iteration

        # Check if this was the last job in the sequence
        # To do this reliably, we need to know the key of the last job.
        # Assuming sorted(PRINT_JOBS.keys()) gives a consistent order.
        list_of_job_keys = sorted(PRINT_JOBS.keys())
        if job_key != list_of_job_keys[-1]: # If not the last job key
             log_info("Preparing for next job...")
             time.sleep(15) 
        else:
             log_info("Final job in sequence processed.")

    log_info(f"\n===== Automation Loop Finished. Successfully completed {completed_jobs_successfully}/{job_count} jobs. =====")
    log_info("Script finished.")