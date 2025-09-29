import time
import requests
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Dict, List, Optional

# --- Configuration ---
BACKEND_BASE_URL = "http://localhost:3000/api"

# Printer Configurations
PRINTERS = {
    "P1P": {
        "name": "Bambu_P1P_AutoReg",
        "brand": "Bambu Lab", 
        "model": "P1P",
        "type": "bambu",
        "ip_address": "192.168.1.100",
        "access_code": "YOUR_ACCESS_CODE",
        "serial_number": "YOUR_SERIAL_NUMBER",
        "filename": "OTTO_LOGO_P1P_PLA_V1.gcode.3mf",
        "rack_prefix": "A",
        "eject_macro": "EJECT_FROM_P1",
        "load_macro": "LOAD_ONTO_P1"
    },
    "P1S": {
        "name": "Bambu_P1S_AutoReg", 
        "brand": "Bambu Lab",
        "model": "P1S", 
        "type": "bambu",
        "ip_address": "192.168.1.101",
        "access_code": "YOUR_ACCESS_CODE",
        "serial_number": "YOUR_SERIAL_NUMBER",
        "filename": "OTTO_LOGO_P1S_PETG_V2.gcode.3mf",
        "rack_prefix": "B",
        "eject_macro": "EJECT_FROM_P_ONE_S",
        "load_macro": "LOAD_ONTO_P_ONE_S"
    }
}

# Ottoeject Configuration
OTTOEJECT_CONFIG = {
    "device_name": "LongGantry_OttoEject_AutoReg",
    "ip_address": "192.168.1.102"  # Update this with actual IP
}

# Rack Configurations
RACKS = {
    "A": {
        "name": "Rack_A_P1P", 
        "number_of_shelves": 3,
        "shelf_spacing_mm": 80,
        "bed_size": "250x250"
    },
    "B": {
        "name": "Rack_B_P1S",
        "number_of_shelves": 6, 
        "shelf_spacing_mm": 80,
        "bed_size": "250x250"
    }
}

# Global state
printer_ids = {}
ottoeject_id = None
rack_ids = {}
ejection_lock = threading.Lock()
slot_trackers = {"A": 1, "B": 1}  # Track next available slot for each rack
job_counters = {"P1P": 0, "P1S": 0}

# Z-axis position for ejection
Z_POSITION_FOR_EJECTION = 150
GCODE_Z_POSITION_COMMAND = f"G90\nG1 Z{Z_POSITION_FOR_EJECTION} F3000"
Z_MOVE_PROCESSING_DELAY_SECONDS = 5

@dataclass
class PrinterState:
    printer_type: str
    printer_id: int
    is_active: bool = True
    current_job: Optional[int] = None
    
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
            if 'status_code' not in response_json:
                response_json['status_code'] = response.status_code
            return response_json
        except ValueError:
            log_info(f"{endpoint_name} command POST successful. Backend response (non-JSON): {response.text}")
            return {"message": response.text, "status_code": response.status_code}
            
    except requests.exceptions.Timeout:
        if is_ottoeject_macro:
            log_warn(f"Python requests.post timed out sending OttoEject macro '{payload.get('macro')}' to backend ({url}).")
            log_warn("Assuming macro was dispatched by backend before timeout. Will proceed to poll status.")
            return {"status": "accepted_python_timeout", "message": "Python request to backend timed out, assuming command sent.", "status_code": 504}
        else:
            log_error(f"Timeout sending POST to {endpoint_name} ({url})")
            return None
            
    except requests.exceptions.RequestException as e:
        log_error(f"Error sending POST to {endpoint_name} ({url}): {e}")
        if e.response is not None:
            log_error(f"Response status: {e.response.status_code}, content: {e.response.text}")
        return None

# --- Device Management Functions ---
def register_printer(printer_config):
    """Register a printer with the backend."""
    url = f"{BACKEND_BASE_URL}/printers/"
    log_info(f"Registering printer: {printer_config['name']}")
    
    payload = {
        "name": printer_config["name"],
        "brand": printer_config["brand"], 
        "model": printer_config["model"],
        "type": printer_config["type"],
        "ip_address": printer_config["ip_address"],
        "access_code": printer_config["access_code"],
        "serial_number": printer_config["serial_number"]
    }
    
    response = post_api_data(url, payload, f"Register {printer_config['name']}")
    if response and response.get("id"):
        log_info(f"Printer {printer_config['name']} registered with ID: {response['id']}")
        return response["id"]
    return None

def register_ottoeject():
    """Register the ottoeject with the backend."""
    url = f"{BACKEND_BASE_URL}/ottoeject/"
    log_info(f"Registering OttoEject: {OTTOEJECT_CONFIG['device_name']}")
    
    response = post_api_data(url, OTTOEJECT_CONFIG, "Register OttoEject")
    if response and response.get("id"):
        log_info(f"OttoEject registered with ID: {response['id']}")
        return response["id"]
    return None

def create_rack(rack_name, rack_config):
    """Create a storage rack."""
    url = f"{BACKEND_BASE_URL}/ottoracks/"
    log_info(f"Creating rack: {rack_config['name']}")
    
    response = post_api_data(url, rack_config, f"Create Rack {rack_name}")
    if response and response.get("id"):
        log_info(f"Rack {rack_config['name']} created with ID: {response['id']}")
        return response["id"]
    return None

# --- Status Monitoring Functions ---
def get_printer_status(printer_id):
    return get_api_data(f"{BACKEND_BASE_URL}/printers/{printer_id}/status", "Printer Status")

def get_ottoeject_status(ottoeject_id):
    return get_api_data(f"{BACKEND_BASE_URL}/ottoeject/{ottoeject_id}/status", "OttoEject Status")

def wait_for_ottoeject_idle(ottoeject_id, poll_interval=3, timeout_seconds=180):
    """Wait for ottoeject to become ONLINE."""
    log_info(f"Waiting for OttoEject ID {ottoeject_id} to become ONLINE...")
    start_time = time.time()
    
    while True:
        if time.time() - start_time > timeout_seconds:
            log_error(f"Timeout waiting for OttoEject ID {ottoeject_id} to become ONLINE.")
            return False
        
        status_data = get_ottoeject_status(ottoeject_id)
        if status_data:
            current_device_status = status_data.get("status", "UNKNOWN").upper()
            log_info(f"OttoEject ID {ottoeject_id} current status: {current_device_status}")
            if current_device_status == "ONLINE":
                log_info(f"OttoEject ID {ottoeject_id} is ONLINE.")
                return True
        else:
            log_info(f"Could not get OttoEject ID {ottoeject_id} status, retrying...")
        
        time.sleep(poll_interval)

# --- Print Job Functions ---
def send_printer_command_start_print(printer_id, filename):
    payload = {"filename": filename}
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
        f"OttoEject Macro '{macro_name}'",
        request_timeout=45
    )
    
    if response_data:
        if response_data.get("status_code") == 202 or \
           response_data.get("status", "") in ["accepted_presumed_timeout", "accepted_python_timeout"]:
            log_info(f"OttoEject macro '{macro_name}' considered dispatched. Proceeding to poll.")
            return True
        else:
            log_error(f"Dispatch of OttoEject macro '{macro_name}' failed. Response: {response_data}")
            return False
    else:
        log_error(f"API call for OttoEject macro '{macro_name}' failed critically.")
        return False

def start_print_and_monitor(printer_state: PrinterState):
    """Start and monitor print jobs for a printer."""
    printer_type = printer_state.printer_type
    printer_jobs = PRINT_JOBS[printer_type]
    
    # Process each job in sequence
    for job_config in printer_jobs:
        job_number = job_config["job_number"]
        filename = job_config["filename"]
        
        log_info(f"--- Starting Print Job #{job_number} on {printer_type}: {filename} ---")
        
        # Start print
        start_print_response = send_printer_command_start_print(printer_state.printer_id, filename)
        
        if not start_print_response or not (
            (start_print_response.get("message", "").lower().count("sent")) or 
            (start_print_response.get("status_code") == 202)
        ):
            log_error(f"Failed to initiate print for {filename} on {printer_type}")
            printer_state.is_active = False
            return False
        
        log_info(f"Print for {filename} initiated on {printer_type}. Monitoring for completion...")
        
        # Initial delay 
        time.sleep(10)
        consecutive_idle_checks_low_progress = 0
        
        # Monitor this specific job
        job_completed = False
        while printer_state.is_active and not job_completed:
            try:
                status_data = get_printer_status(printer_state.printer_id)
                if not status_data:
                    log_error(f"Failed to get printer status for {printer_type}. Will retry.")
                    time.sleep(15)
                    continue
                
                main_status = status_data.get("status", "UNKNOWN").upper()
                current_stage = status_data.get("current_stage", "N/A")
                progress = status_data.get("progress_percent")
                remaining_time = status_data.get("remaining_time_minutes")
                
                progress_str = f"{progress}%" if progress is not None else "N/A"
                remaining_time_str = f"{remaining_time} min" if remaining_time is not None else "N/A"
                
                log_info(f"{printer_type} Job #{job_number} Status: {main_status} | Stage: {current_stage} | Progress: {progress_str} | Remaining: {remaining_time_str}")
                
                if main_status == "FINISH":
                    log_info(f"Print job #{job_number} on {printer_type} reported FINISH.")
                    time.sleep(3)
                    job_completed = True
                    
                elif main_status == "IDLE":
                    if progress is not None and progress >= 99:
                        log_info(f"Print job #{job_number} on {printer_type} is {progress}% and IDLE. Assuming complete.")
                        job_completed = True
                        
                    elif progress is not None and progress < 10:
                        consecutive_idle_checks_low_progress += 1
                        if consecutive_idle_checks_low_progress > 6:
                            log_error(f"{printer_type} remained IDLE with low progress ({progress_str}). Aborting job.")
                            printer_state.is_active = False
                            return False
                        log_warn(f"{printer_type} IDLE, progress {progress_str}. Check {consecutive_idle_checks_low_progress}/6 before assuming error.")
                    else:
                        log_info(f"{printer_type} IDLE, progress {progress_str}. Waiting for state change.")
                        
                elif main_status in ["PAUSED", "FAILED"]:
                    log_error(f"Print job #{job_number} on {printer_type} is in critical state: {main_status}. Stage: {current_stage}. Stopping this printer.")
                    printer_state.is_active = False
                    return False
                
                # Reset counter if not in suspicious IDLE state
                if not (main_status == "IDLE" and progress is not None and progress < 10):
                    consecutive_idle_checks_low_progress = 0
                    
                if not job_completed:
                    # Dynamic polling delay
                    poll_delay = 30
                    if remaining_time is not None:
                        if remaining_time > 10: poll_delay = 60
                        elif remaining_time > 2: poll_delay = 30
                        elif remaining_time >= 0: poll_delay = 10
                    
                    time.sleep(poll_delay)
                
            except Exception as e:
                log_error(f"Error monitoring {printer_type}: {e}")
                time.sleep(15)
        
        # Job completed - perform ejection sequence
        if job_completed:
            log_info(f"Print job #{job_number} on {printer_type} completed. Starting ejection sequence.")
            ejection_successful = perform_ejection_sequence(printer_state, job_config)
            
            if not ejection_successful:
                log_error(f"Ejection failed for {printer_type} job #{job_number}. Stopping this printer.")
                printer_state.is_active = False
                return False
            
            log_info(f"Ejection sequence completed for {printer_type} job #{job_number}.")
        else:
            log_error(f"Job #{job_number} on {printer_type} did not complete successfully.")
            printer_state.is_active = False
            return False
    
    # All jobs completed successfully
    log_info(f"All print jobs completed successfully on {printer_type}!")
    printer_state.is_active = False  # Mark as inactive since all jobs are done
    return True

def perform_ejection_sequence(printer_state: PrinterState):
    """Perform complete ejection sequence with coordination."""
    printer_config = PRINTERS[printer_state.printer_type]
    rack_prefix = printer_config["rack_prefix"]
    current_job = job_counters[printer_state.printer_type]
    
    # Acquire ejection lock to prevent concurrent ejections
    log_info(f"--- {printer_state.printer_type} requesting ejection lock for job #{current_job} ---")
    with ejection_lock:
        log_info(f"--- {printer_state.printer_type} acquired ejection lock for job #{current_job} ---")
        
        try:
            # Step 1: Position Z-axis for ejection
            log_info(f"Positioning {printer_state.printer_type} Z-axis to {Z_POSITION_FOR_EJECTION}mm...")
            gcode_response = send_printer_gcode(printer_state.printer_id, GCODE_Z_POSITION_COMMAND)
            
            if not gcode_response or gcode_response.get("status_code") != 202:
                log_error(f"Failed to send Z-axis positioning G-code for {printer_state.printer_type}")
                return False
                
            log_info(f"Z-axis positioning command accepted for {printer_state.printer_type}. Waiting {Z_MOVE_PROCESSING_DELAY_SECONDS}s...")
            time.sleep(Z_MOVE_PROCESSING_DELAY_SECONDS)
            
            # Step 2: Home ottoeject
            log_info(f"Homing OttoEject for {printer_state.printer_type} ejection...")
            if not execute_ottoeject_macro(ottoeject_id, "OTTOEJECT_HOME"):
                return False
            if not wait_for_ottoeject_idle(ottoeject_id):
                return False
            
            # Step 3: Eject from printer
            log_info(f"Ejecting from {printer_state.printer_type}...")
            if not execute_ottoeject_macro(ottoeject_id, printer_config["eject_macro"]):
                return False
            if not wait_for_ottoeject_idle(ottoeject_id):
                return False
            
            # Step 4: Store to rack
            current_slot = slot_trackers[rack_prefix]
            store_macro = f"STORE_TO_SLOT_{rack_prefix}_{current_slot}"
            log_info(f"Storing to {store_macro}...")
            if not execute_ottoeject_macro(ottoeject_id, store_macro):
                return False
            if not wait_for_ottoeject_idle(ottoeject_id):
                return False
            
            # Update slot tracker
            max_slots = RACKS[rack_prefix]["number_of_shelves"]
            slot_trackers[rack_prefix] = (current_slot % max_slots) + 1
            
            # Step 5: Grab new plate (use slot 1 for simplicity)
            grab_slot = 1  # Always grab from slot 1 for now
            grab_macro = f"GRAB_FROM_SLOT_{rack_prefix}_{grab_slot}"
            log_info(f"Grabbing new plate from {grab_macro}...")
            if not execute_ottoeject_macro(ottoeject_id, grab_macro):
                return False
            if not wait_for_ottoeject_idle(ottoeject_id):
                return False
            
            # Step 6: Load onto printer
            log_info(f"Loading onto {printer_state.printer_type}...")
            if not execute_ottoeject_macro(ottoeject_id, printer_config["load_macro"]):
                return False
            if not wait_for_ottoeject_idle(ottoeject_id):
                return False
            
            # Step 7: Park ottoeject
            log_info(f"Parking OttoEject...")
            if not execute_ottoeject_macro(ottoeject_id, "PARK_OTTOEJECT"):
                return False
            if not wait_for_ottoeject_idle(ottoeject_id):
                return False
            
            log_info(f"--- Ejection sequence completed for {printer_state.printer_type} job #{current_job} ---")
            return True
            
        except Exception as e:
            log_error(f"Error during ejection sequence for {printer_state.printer_type}: {e}")
            return False
        finally:
            log_info(f"--- {printer_state.printer_type} releasing ejection lock ---")

# --- Setup Functions ---
def setup_devices():
    """Register all devices and create racks."""
    global printer_ids, ottoeject_id, rack_ids
    
    log_info("=== Setting up devices ===")
    
    # Register printers
    for printer_type, config in PRINTERS.items():
        printer_id = register_printer(config)
        if printer_id:
            printer_ids[printer_type] = printer_id
        else:
            log_error(f"Failed to register {printer_type}")
            return False
    
    # Register ottoeject
    ottoeject_id = register_ottoeject()
    if not ottoeject_id:
        log_error("Failed to register OttoEject")
        return False
    
    # Create racks
    for rack_name, config in RACKS.items():
        rack_id = create_rack(rack_name, config)
        if rack_id:
            rack_ids[rack_name] = rack_id
        else:
            log_error(f"Failed to create rack {rack_name}")
            return False
    
    log_info("=== Device setup completed ===")
    return True

def main():
    """Main orchestration function."""
    log_info("===== OTTOMAT3D Dual Printer Orchestrator =====")
    log_info(f"Target Printers: P1P (ID: TBD), P1S (ID: TBD)")
    log_info(f"OttoEject: {OTTOEJECT_CONFIG['device_name']}")
    log_info(f"Backend API URL: {BACKEND_BASE_URL}")
    
    # Setup devices
    if not setup_devices():
        log_error("Device setup failed. Exiting.")
        return
    
    # Wait for MQTT connections to establish
    log_info("Waiting 7 seconds for printer MQTT connections to establish...")
    time.sleep(7)
    
    # Wait for ottoeject to be ready
    log_info("Waiting for OttoEject to be ready...")
    if not wait_for_ottoeject_idle(ottoeject_id):
        log_error("OttoEject not ready. Exiting.")
        return
    
    # Create printer state objects
    printer_states = {
        "P1P": PrinterState("P1P", printer_ids["P1P"]),
        "P1S": PrinterState("P1S", printer_ids["P1S"])
    }
    
    log_info("=== Starting dual printer operation ===")
    
    # Start monitoring both printers in separate threads
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = {}
        
        for printer_type, state in printer_states.items():
            if state.is_active:
                future = executor.submit(start_print_and_monitor, state)
                futures[future] = printer_type
                log_info(f"Started monitoring thread for {printer_type}")
        
        # Monitor threads
        while futures:
            # Check if any threads have completed
            completed_futures = []
            for future in futures:
                if future.done():
                    completed_futures.append(future)
            
            # Handle completed threads
            for future in completed_futures:
                printer_type = futures[future]
                del futures[future]
                
                try:
                    result = future.result()
                    log_info(f"{printer_type} monitoring thread completed with result: {result}")
                except Exception as e:
                    log_error(f"{printer_type} monitoring thread failed with exception: {e}")
                    printer_states[printer_type].is_active = False
                
                # Check if we should restart the thread
                if printer_states[printer_type].is_active:
                    log_info(f"Restarting monitoring thread for {printer_type}")
                    new_future = executor.submit(start_print_and_monitor, printer_states[printer_type])
                    futures[new_future] = printer_type
                else:
                    log_warn(f"{printer_type} is no longer active. Not restarting thread.")
            
            # Check if all printers are inactive
            if not any(state.is_active for state in printer_states.values()):
                log_error("All printers are inactive. Stopping orchestrator.")
                break
            
            time.sleep(5)  # Check every 5 seconds
    
    log_info("=== Dual printer orchestration completed ===")

if __name__ == '__main__':
    main()