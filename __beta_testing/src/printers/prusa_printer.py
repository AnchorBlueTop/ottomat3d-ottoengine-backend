"""
Prusa Printer Implementation for OTTOMAT3D Master Script
Handles communication with Prusa printers via PrusaLinkPy library
"""

import time
import PrusaLinkPy
import requests
import json
from printers.printer_factory import BasePrinter, PrinterStatusTracker, calculate_poll_interval, is_completion_state, is_error_state

class PrusaPrinter(BasePrinter):
    """Prusa printer implementation using PrusaLinkPy library"""
    
    def __init__(self, config_data):
        """Initialize Prusa printer"""
        super().__init__(config_data)
        
        # Prusa-specific configuration
        self.api_key = config_data.get('PRINTER_API_KEY')
        self.printer_model = config_data.get('PRINTER_MODEL', '')
        
        # PrusaLinkPy instance
        self.prusa_instance = None
        
        # Model-specific positioning settings
        if self.printer_model == 'Core One':
            # Core One is a Z-bed printer
            self.is_sling_bed = False
            self.z_position_for_ejection = 200
            self.y_position_for_ejection = None
            self.positioning_file = "/usb/OTTOTEMP/Z_POS_DWELL.gcode"
        else:
            # MK3/S, MK3S+, MK4/S are sling bed printers - use Y positioning  
            self.is_sling_bed = True
            self.y_position_for_ejection = 210
            self.z_position_for_ejection = None
            self.positioning_file = "/usb/OTTOTEMP/Y_POS_DWELL.gcode"
        
        self.status_tracker = PrinterStatusTracker()
        
        bed_type = "sling bed (Y-axis)" if self.is_sling_bed else "Z-bed (Z-axis)"
        self.logger.info(f"Initialized Prusa {self.printer_model} printer: {self.ip_address} ({bed_type})")
        self.logger.info("Note: PrusaLink must be enabled")
    
    def test_connection(self):
        """Test connection to Prusa printer using PrusaLinkPy"""
        self.logger.info(f"Testing connection to Prusa printer at {self.ip_address}...")
        self.logger.info("Note: Ensure PrusaLink is ENABLED")
        
        try:
            # Initialize PrusaLinkPy instance
            self.prusa_instance = PrusaLinkPy.PrusaLinkPy(self.ip_address, self.api_key)
            
            # Test API connectivity by getting version
            version_response = self.prusa_instance.get_version()
            
            if version_response and version_response.status_code == 200:
                version_data = version_response.json()
                server_version = version_data.get('server', 'Unknown')
                self.logger.info(f"✅ Successfully connected to PrusaLink server: {server_version}")
                return True
            else:
                status_code = version_response.status_code if version_response else "No Response"
                self.logger.error(f"❌ Failed to connect to PrusaLink. Status: {status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"❌ Error initializing PrusaLinkPy: {e}")
            self.logger.error("Ensure PrusaLink is enabled and API key is correct")
            return False
    
    def get_status(self):
        """Get current printer status using PrusaLinkPy"""
        if not self.prusa_instance:
            self.logger.error("Prusa instance not initialized")
            return None
            
        try:
            # Get status from PrusaLink
            status_response = self.prusa_instance.get_status()
            
            if not status_response or status_response.status_code != 200:
                self.logger.error("Failed to get status from PrusaLink")
                return None
            
            data = status_response.json()
            
            # Extract printer info
            printer_info = data.get("printer", {})
            job_info = data.get("job")
            
            # Extract printer state
            state = printer_info.get('state', 'UNKNOWN').upper()
            bed_temp = printer_info.get('temp_bed', 0)
            nozzle_temp = printer_info.get('temp_nozzle', 0)
            
            # Extract job information
            current_file = "N/A"
            progress_percent = 0
            remaining_time_minutes = None
            job_active = False
            
            if job_info:
                current_file = job_info.get('file', {}).get('name', 'N/A') if job_info.get('file') else 'N/A'
                # PrusaLink progress is already 0-100 scale
                progress_percent = job_info.get('progress', 0) or 0
                remaining_time_seconds = job_info.get('time_remaining')
                job_id = job_info.get('id')
                job_active = job_id is not None
                
                if remaining_time_seconds:
                    remaining_time_minutes = remaining_time_seconds / 60
            
            # Build status response
            status_response = {
                'status': state,
                'bed_temp': bed_temp,
                'nozzle_temp': nozzle_temp,
                'bed_target': 0,  # PrusaLink doesn't always provide targets
                'nozzle_target': 0,
                'current_file': current_file,
                'progress_percent': progress_percent,
                'remaining_time_minutes': remaining_time_minutes,
                'job_active': job_active
            }
            
            return status_response
            
        except Exception as e:
            self.logger.error(f"Error getting printer status: {e}")
            return None
    
    def start_print(self, filename, is_first_job=False):
        """Start printing a file using PrusaLinkPy"""
        if not self.prusa_instance:
            self.logger.error("Prusa instance not initialized")
            return False
            
        self.logger.info(f"Starting print: {filename}")
        
        if is_first_job and self.first_job_wait_seconds > 0:
            self.logger.info(f"First job - waiting {self.first_job_wait_seconds} seconds before starting...")
            time.sleep(self.first_job_wait_seconds)
        
        try:
            # Build file path for Prusa (assuming files are on USB)
            file_path = f"/usb/{filename}"
            
            # Start print using PrusaLinkPy
            response = self.prusa_instance.post_print_gcode(file_path)
            
            # Check for success (202 Accepted or 204 No Content)
            if response and response.status_code in [200, 202, 204]:
                self.logger.info(f"✅ Print '{filename}' started successfully")
                time.sleep(10)  # Give printer time to start
                return True
            else:
                status_code = response.status_code if response else "No Response"
                self.logger.error(f"❌ Failed to start print: HTTP {status_code}")
                if response and response.text:
                    try:
                        error_data = response.json()
                        self.logger.error(f"Error details: {error_data}")
                    except:
                        self.logger.error(f"Response: {response.text}")
                return False
                
        except Exception as e:
            self.logger.error(f"❌ Error starting print '{filename}': {e}")
            return False
    
    def wait_for_completion(self):
        """Wait for print completion using exact multifile loop logic"""
        self.logger.info("Monitoring print for completion...")
        
        time.sleep(5)  # Initial delay
        
        consecutive_error_polls = 0
        last_logged_status = ""
        initial_job_id_to_monitor = None
        
        # Try to get the ID of the job that just started
        try:
            status_data = self.get_status()
            if status_data and status_data.get('job_active'):
                # Get job ID from direct API call
                status_response = self.prusa_instance.get_status()
                if status_response and status_response.status_code == 200:
                    job_data = status_response.json().get("job")
                    if job_data and job_data.get("id") is not None:
                        initial_job_id_to_monitor = job_data.get("id")
                        self.logger.info(f"Now monitoring Job ID: {initial_job_id_to_monitor} for completion.")
        except Exception:
            self.logger.warning("Could not immediately determine job ID being monitored.")
        
        while True:
            status_data = self.get_status()
            
            if not status_data:
                consecutive_error_polls += 1
                if consecutive_error_polls > 4:
                    self.logger.error("Too many status errors. Aborting wait.")
                    return False
                self.logger.warning("Failed to get status, retrying...")
                time.sleep(15)
                continue
            
            consecutive_error_polls = 0
            
            # Extract status information
            state = status_data['status']
            progress = status_data.get('progress_percent', 0)
            filename = status_data.get('current_file', 'N/A')
            remaining_time = status_data.get('remaining_time_minutes')
            job_active = status_data.get('job_active', False)
            
            # Create status line
            time_str = f"{remaining_time:.1f} min" if remaining_time else "N/A"
            current_status_line = (
                f"State: {state} | Progress: {progress:.1f}% | File: {filename} | "
                f"Remaining: {time_str} | Job Active: {job_active}"
            )
            
            # Log only if status changed
            if current_status_line != last_logged_status:
                self.logger.info(current_status_line)
                last_logged_status = current_status_line
            
            # Get current job ID for comparison
            current_job_id = None
            try:
                status_response = self.prusa_instance.get_status()
                if status_response and status_response.status_code == 200:
                    job_data = status_response.json().get("job")
                    current_job_id = job_data.get("id") if job_data and job_data.get("id") is not None else None
            except:
                pass
            
            # Check for completion states (exact multifile loop logic)
            if state == "FINISHED":
                self.logger.info("✅ Print completed (FINISHED)")
                return True
            
            if state == "IDLE":
                # If IDLE and no job, it's done
                # If IDLE and job ID is different from what we were tracking, our job is done  
                # If IDLE and job ID is same but progress is high, it's done
                if (current_job_id is None or 
                    (initial_job_id_to_monitor is not None and current_job_id != initial_job_id_to_monitor) or
                    progress >= 99.0):
                    self.logger.info("✅ Print completed (IDLE with job context indicating completion)")
                    return True
            
            # Check for error states
            if state in ["ERROR", "ATTENTION", "STOPPED"]:
                self.logger.error(f"❌ Print failed - State: {state}")
                return False
            
            # Capture job ID if not captured before
            if current_job_id is not None and initial_job_id_to_monitor is None:
                initial_job_id_to_monitor = current_job_id
                self.logger.info(f"Now monitoring newly detected job ID: {initial_job_id_to_monitor} for completion.")
            
            # Calculate poll interval (exact multifile loop logic)
            poll_interval = 30
            if remaining_time is not None:
                remaining_time_seconds = remaining_time * 60
                if remaining_time_seconds > 600:
                    poll_interval = 60
                elif remaining_time_seconds > 120:
                    poll_interval = 30
                elif remaining_time_seconds > 0:
                    poll_interval = 15
                else:
                    poll_interval = 5
            
            time.sleep(poll_interval)
    
    def needs_bed_positioning(self):
        """Prusa printers need bed positioning for ejection"""
        return True
    
    def position_bed_for_ejection(self):
        """Position bed for ejection following exact multifile loop workflow"""
        if not self.prusa_instance:
            self.logger.error("Prusa instance not initialized")
            return False
        
        try:
            bed_axis = "Z" if not self.is_sling_bed else "Y"
            position = self.z_position_for_ejection if not self.is_sling_bed else self.y_position_for_ejection
            
            self.logger.info(f"Preparing Prusa for ejection: Starting pre-uploaded {bed_axis}-positioning script ('{self.positioning_file}')...")
            
            # Start the positioning file (exact multifile loop approach)
            response = self.prusa_instance.post_print_gcode(self.positioning_file)
            
            if not response or response.status_code not in [202, 204]:
                status_code = response.status_code if response else "No Response"
                self.logger.error(f"❌ Failed to start {bed_axis}-positioning script. Status: {status_code}")
                return False
            
            self.logger.info(f"✅ {bed_axis}-positioning script dispatched successfully")
            
            # Wait for positioning script to get to dwell part (exact multifile loop timing)
            self.logger.info("Waiting for positioning script to reach dwell...")
            time.sleep(15)  # Wait for it to home and move to position
            
            # Pause the printer during dwell to lock bed position (exact multifile loop approach)  
            self.logger.info("Pausing printer to lock bed position...")
            pause_response = self.prusa_instance.pause_print()
            
            if pause_response and pause_response.status_code in [200, 202, 204]:
                self.logger.info(f"✅ Printer paused - bed locked at {bed_axis}{position}")
                time.sleep(2)  # Brief delay after pause
                return True
            else:
                status_code = pause_response.status_code if pause_response else "No Response"
                self.logger.error(f"❌ Failed to pause printer. Status: {status_code}")
                return False
            
        except Exception as e:
            self.logger.error(f"❌ Error positioning bed: {e}")
            return False
    
    def move_bed_for_ejection(self):
        """Move bed for ejection (main script compatibility method)"""
        return self.position_bed_for_ejection()
    
    def cleanup_positioning_script(self):
        """Cleanup positioning script (main script compatibility method)"""
        return self.cleanup_after_ejection()
    
    def cleanup_after_ejection(self):
        """Stop the paused dwell job to prepare for next print"""
        if not self.prusa_instance:
            self.logger.error("Prusa instance not initialized")
            return False
        
        try:
            self.logger.info("Stopping paused positioning job...")
            
            # Stop the dwell job (exact multifile loop approach)
            stop_response = self.prusa_instance.stop_print()
            
            if stop_response and stop_response.status_code in [200, 202, 204]:
                self.logger.info("✅ Positioning job stopped - printer ready for next print")
                time.sleep(2)  # Brief delay after stop
                return True
            else:
                status_code = stop_response.status_code if stop_response else "No Response"
                self.logger.error(f"❌ Failed to stop positioning job. Status: {status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"❌ Error stopping positioning job: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from printer (cleanup method)"""
        # PrusaLinkPy doesn't require explicit disconnection
        self.logger.info("Prusa printer disconnected")
        return True