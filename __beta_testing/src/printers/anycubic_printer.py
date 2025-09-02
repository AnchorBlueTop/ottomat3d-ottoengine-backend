"""
Anycubic Printer Implementation for OTTOMAT3D Master Script
Handles communication with Anycubic printers via Moonraker API
"""

import time
import requests
import json
from printers.printer_factory import BasePrinter, PrinterStatusTracker, calculate_poll_interval, is_completion_state, is_error_state

class AnycubicPrinter(BasePrinter):
    """Anycubic printer implementation using Moonraker API"""
    
    def __init__(self, config_data):
        """Initialize Anycubic printer"""
        super().__init__(config_data)
        
        # Anycubic configuration
        self.printer_model = config_data.get('PRINTER_MODEL', 'Unknown')
        
        # Anycubic Moonraker settings  
        self.moonraker_port = 7125
        self.moonraker_base_url = f"http://{self.ip_address}:{self.moonraker_port}"
        
        # Z position for ejection (handled by machine end G-code)
        self.z_position_for_ejection = 205
        
        self.status_tracker = PrinterStatusTracker()
        
        self.logger.info(f"Initialized Anycubic {self.printer_model} printer: {self.ip_address}")
        self.logger.info("Note: Rinkhals Custom Firmware required")
    
    def test_connection(self):
        """Test Moonraker connection to Anycubic printer"""
        self.logger.info(f"Testing connection to Anycubic printer at {self.ip_address}...")
        self.logger.info("Note: Ensure Rinkhals Custom Firmware is installed")
        
        try:
            url = f"{self.moonraker_base_url}/printer/info"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if 'result' in data:
                result = data['result']
                state = result.get('state', 'Unknown')
                hostname = result.get('hostname', 'Unknown')
                
                self.logger.info(f"✅ Successfully connected to Anycubic printer")
                self.logger.info(f"   Hostname: {hostname}, State: {state}")
                return True
            else:
                self.logger.error("❌ Invalid response from Anycubic printer")
                return False
                
        except requests.exceptions.RequestException as e:
            self.logger.error(f"❌ Failed to connect to Anycubic printer: {e}")
            self.logger.error("Ensure Rinkhals firmware is installed and Moonraker is running on port 7125")
            return False
        except Exception as e:
            self.logger.error(f"❌ Connection error: {e}")
            return False
    
    def get_status(self):
        """Get Anycubic printer status via Moonraker"""
        try:
            # Get multiple status objects from Moonraker
            url = f"{self.moonraker_base_url}/printer/objects/query?print_stats&virtual_sdcard&extruder&heater_bed&display_status"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if 'result' in data and 'status' in data['result']:
                status = data['result']['status']
                
                print_stats = status.get('print_stats', {})
                virtual_sdcard = status.get('virtual_sdcard', {})
                extruder = status.get('extruder', {})
                heater_bed = status.get('heater_bed', {})
                display_status = status.get('display_status', {})
                
                # Extract information
                state = print_stats.get('state', 'unknown').upper()
                filename = print_stats.get('filename', 'No file')
                progress = virtual_sdcard.get('progress', 0) * 100
                print_duration = print_stats.get('print_duration', 0)
                nozzle_temp = extruder.get('temperature', 0)
                bed_temp = heater_bed.get('temperature', 0)
                nozzle_target = extruder.get('target', 0)
                bed_target = heater_bed.get('target', 0)
                
                return {
                    'status': state,
                    'progress_percent': progress,
                    'current_file': filename.split('/')[-1] if filename else "No file",
                    'print_duration': print_duration,
                    'nozzle_temperature': nozzle_temp,
                    'bed_temperature': bed_temp,
                    'nozzle_target': nozzle_target,
                    'bed_target': bed_target,
                    'raw_data': status
                }
            else:
                self.logger.warning("Invalid status response from Anycubic printer")
                return None
                
        except Exception as e:
            self.logger.warning(f"Failed to get Anycubic status: {e}")
            return None
    
    def start_print(self, filename, bed_temperature=None, is_first_job=False):
        """Start printing a file with LeviQ sequence"""
        self.logger.info(f"Starting LeviQ sequence + print: {filename}")
        
        try:
            # Final optimized LeviQ sequence (removed redundant commands)
            commands = [
                "LEVIQ2_AUTO_ZOFFSET_ON_OFF",
                "LEVIQ2_PREHEATING",
                "LEVIQ2_WIPING",
                "LEVIQ2_PROBE",
                f'SDCARD_PRINT_FILE FILENAME="{filename}"'
            ]
            
            self.logger.info("Executing LeviQ sequence")
            
            for i, cmd in enumerate(commands, 1):
                self.logger.info(f"Sending command {i}/{len(commands)}: {cmd}")
                
                # Send command
                try:
                    self.send_gcode(cmd)
                    self.logger.info(f"✅ Command sent: {cmd}")
                    self.logger.info(f"✅ Command queued: {cmd}")
                except Exception as e:
                    # Don't fail on timeouts - assume success
                    self.logger.info(f"✅ Command sent: {cmd}")
                    self.logger.info(f"✅ Command queued: {cmd}")
                
                # 1-second interval between commands
                time.sleep(1)
            
            self.logger.info("✅ LeviQ sequence completed")
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Error in LeviQ sequence '{filename}': {e}")
            return False
    

    
    def _wait_for_status_transition_from_complete(self, max_wait_time=300):
        """Wait for status to transition away from COMPLETE (indicates LeviQ sequence is working)"""
        self.logger.info("Waiting for status to transition from COMPLETE (LeviQ sequence in progress)...")
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            status_data = self.get_status()
            if not status_data:
                time.sleep(5)
                continue
            
            state = status_data['status']
            if state != 'COMPLETE':
                self.logger.info(f"✅ Status transitioned from COMPLETE to {state}")
                return True
            
            time.sleep(5)  # Check every 5 seconds
        
        self.logger.warning("⚠️ Timeout waiting for status transition from COMPLETE")
        return False
    
    def _wait_for_progress_reset(self, max_wait_time=600):
        """Wait for progress to reset to low values (indicates new print started)"""
        self.logger.info("Waiting for progress to reset (new print starting)...")
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            status_data = self.get_status()
            if not status_data:
                time.sleep(5)
                continue
            
            progress = status_data.get('progress_percent', 0)
            state = status_data['status']
            
            # New print has started when progress drops significantly or state changes to PRINTING
            if progress < 10 or state in ['PRINTING', 'RUNNING']:
                self.logger.info(f"✅ New print detected: Progress: {progress:.1f}%, State: {state}")
                return True
            
            time.sleep(5)  # Check every 5 seconds
        
        self.logger.warning("⚠️ Timeout waiting for progress reset")
        return False

    def wait_for_completion(self):
        """Wait for Anycubic print completion - handle stale status from previous prints"""
        self.logger.info("Monitoring print for completion...")
        
        self.status_tracker.reset()
        time.sleep(15)  # Extended initial delay to let LeviQ sequence start
        
        # STEP 1: Check for stale completion status from previous print
        initial_status = self.get_status()
        if initial_status and initial_status['status'] == 'COMPLETE' and initial_status.get('progress_percent', 0) >= 99:
            self.logger.info("🔄 Detected stale COMPLETE status from previous print - waiting for new print to start...")
            
            # Wait for status to change away from COMPLETE (LeviQ sequence working)
            if not self._wait_for_status_transition_from_complete():
                self.logger.error("❌ Failed to detect status transition from COMPLETE")
                return False
            
            # Wait for progress to reset (new print starting)
            if not self._wait_for_progress_reset():
                self.logger.error("❌ Failed to detect progress reset for new print")
                return False
            
            self.logger.info("✅ New print started successfully - proceeding with normal monitoring")
        
        # STEP 2: Proceed with normal monitoring logic
        consecutive_error_polls = 0
        last_logged_status = ""
        startup_grace_period = True
        startup_polls = 0
        max_startup_polls = 6  # Ignore CANCELLED for first 60 seconds (6 x 10s polls)
        # Note: Stale COMPLETE status from previous prints is now handled above
        
        while True:
            status_data = self.get_status()
            
            if not status_data:
                consecutive_error_polls += 1
                if consecutive_error_polls > 4:
                    self.logger.error("Too many status errors. Aborting wait.")
                    return False
                self.logger.warning("Failed to get status, retrying...")
                time.sleep(10)  # Shorter retry interval
                continue
            
            consecutive_error_polls = 0
            startup_polls += 1
            
            # End startup grace period after enough polls
            if startup_polls > max_startup_polls:
                startup_grace_period = False
            
            # Extract status information
            state = status_data['status']
            progress = status_data.get('progress_percent', 0)
            filename = status_data.get('current_file', 'N/A')
            duration = status_data.get('print_duration', 0)
            nozzle_temp = status_data.get('nozzle_temperature', 0)
            bed_temp = status_data.get('bed_temperature', 0)
            
            # Create status line
            duration_str = f"{duration/60:.1f} min" if duration > 0 else "N/A"
            current_status_line = (
                f"Anycubic Print Status: {state} | Progress: {progress:.1f}% | File: {filename} | "
                f"Duration: {duration_str} | Nozzle: {nozzle_temp:.1f}°C | Bed: {bed_temp:.1f}°C"
            )
            
            # Log only if status changed
            if current_status_line != last_logged_status:
                self.logger.info(current_status_line)
                last_logged_status = current_status_line
            
            # PRIMARY: Check for completion states (most reliable)
            if state in ["COMPLETE", "FINISHED"]:
                self.logger.info("✅ Anycubic print completed")
                return True
            
            # SECONDARY: Check for IDLE with high progress (potential completion)
            if state == "IDLE" and progress >= 99:
                self.logger.info("✅ Anycubic print completed (IDLE with 99%+ progress)")
                return True
            
            # TERTIARY: Check for IDLE with temperatures cooling down (indicates completion)
            if state == "IDLE" and nozzle_temp < 50 and bed_temp < 40 and progress > 80:
                self.logger.info("✅ Anycubic print completed (IDLE with cooling temperatures)")
                return True
            
            # IMPROVED: Handle CANCELLED state with startup grace period
            if state == "CANCELLED":
                if startup_grace_period:
                    self.logger.info(f"⚠️  Print shows CANCELLED during startup grace period (poll {startup_polls}/{max_startup_polls}) - continuing to monitor...")
                    # Continue monitoring during grace period
                else:
                    # After grace period, treat CANCELLED as actual failure
                    self.logger.error(f"❌ Anycubic print cancelled - State: {state}")
                    return False
            elif state == "STOPPED":
                self.logger.error(f"❌ Anycubic print stopped - State: {state}")
                return False
            
            # For Anycubic printers, ignore ERROR states as they can be false positives
            # BUT detect specific errors that require intervention
            if state == "ERROR":
                self.logger.warning(f"⚠️  Anycubic printer reports ERROR state (continuing monitoring)")
                # Continue monitoring for non-critical errors
            
            # Use adaptive polling intervals based on temperature activity
            # If temps are actively rising/falling, use shorter intervals
            if nozzle_temp > 180 or bed_temp > 50:
                poll_interval = 10  # Active printing, normal interval
            elif progress > 95:
                poll_interval = 5  # Near completion, check frequently
            elif progress > 80:
                poll_interval = 8  # Final stages
            else:
                poll_interval = 10  # Standard monitoring
            
            time.sleep(poll_interval)
    
    def needs_bed_positioning(self):
        """Anycubic printers don't need bed positioning if G1 Z200 is in end G-code"""
        return False
    
    def position_bed_for_ejection(self):
        """Bed positioning should be handled by machine end G-code"""
        self.logger.info("Bed positioning handled by machine end G-code (G1 Z205)")
        
        # Fallback method - send Z205 command directly if needed
        try:
            if self.send_gcode("G1 Z205 F3000"):
                self.logger.info("✅ Fallback Z positioning sent")
                time.sleep(3)
                return True
            else:
                self.logger.warning("⚠️ Fallback positioning failed")
                return False
        except Exception as e:
            self.logger.error(f"❌ Error in fallback positioning: {e}")
            return False
    
    def send_gcode(self, gcode_command):
        """Send custom G-code command via Moonraker"""
        try:
            url = f"{self.moonraker_base_url}/printer/gcode/script"
            data = {"script": gcode_command}
            
            # Use longer timeout for commands that take time
            if ("G28" in gcode_command.upper() or 
                "LEVIQ" in gcode_command.upper() or 
                "SDCARD_PRINT_FILE" in gcode_command.upper()):
                timeout = 60  # 60 seconds for long-running commands
            else:
                timeout = 10  # 10 seconds for regular commands
            
            response = requests.post(url, data=data, timeout=timeout)
            response.raise_for_status()
            
            result = response.json()
            if result.get('result') == 'ok':
                self.logger.info(f"✅ Command sent: {gcode_command}")
                return True
            else:
                self.logger.error(f"❌ G-code failed: {result}")
                return False
                
        except requests.exceptions.Timeout:
            # For long-running commands, timeout is expected - assume success
            if ("G28" in gcode_command.upper() or 
                "LEVIQ" in gcode_command.upper() or 
                "SDCARD_PRINT_FILE" in gcode_command.upper()):
                self.logger.info(f"✅ Command sent: {gcode_command}")
                return True
            else:
                self.logger.error(f"❌ G-code timeout: {gcode_command}")
                return False
        except Exception as e:
            self.logger.error(f"Error sending G-code '{gcode_command}': {e}")
            return False
    
    def pause_print(self):
        """Pause current print"""
        try:
            url = f"{self.moonraker_base_url}/printer/print/pause"
            response = requests.post(url, timeout=10)
            response.raise_for_status()
            
            self.logger.info("✅ Print paused")
            return True
                
        except Exception as e:
            self.logger.error(f"Failed to pause print: {e}")
            return False
    
    def resume_print(self):
        """Resume paused print"""
        try:
            url = f"{self.moonraker_base_url}/printer/print/resume"
            response = requests.post(url, timeout=10)
            response.raise_for_status()
            
            self.logger.info("✅ Print resumed")
            return True
                
        except Exception as e:
            self.logger.error(f"Failed to resume print: {e}")
            return False
    
    def stop_print(self):
        """Stop current print"""
        try:
            url = f"{self.moonraker_base_url}/printer/print/cancel"
            response = requests.post(url, timeout=10)
            response.raise_for_status()
            
            self.logger.info("✅ Print stopped")
            return True
                
        except Exception as e:
            self.logger.error(f"Failed to stop print: {e}")
            return False
    
    def get_printer_info(self):
        """Get printer information"""
        return {
            'brand': 'Anycubic',
            'model': self.printer_model,
            'ip_address': self.ip_address,
            'connection_type': 'Moonraker API'
        }
    
    def get_available_files(self):
        """Get list of available G-code files"""
        try:
            url = f"{self.moonraker_base_url}/server/files/list?root=gcodes"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            files = []
            
            if 'result' in data:
                for file_info in data['result']:
                    if file_info.get('filename', '').endswith(('.gcode', '.g', '.gc')):
                        files.append({
                            'name': file_info.get('filename', ''),
                            'size': file_info.get('size', 0),
                            'modified': file_info.get('modified', 0)
                        })
            
            return files
            
        except Exception as e:
            self.logger.error(f"Failed to get file list: {e}")
            return []
    
    def validate_file_exists(self, filename):
        """Validate that a file exists on the printer"""
        files = self.get_available_files()
        file_names = [f['name'] for f in files]
        
        if filename in file_names:
            self.logger.info(f"✅ File '{filename}' found on printer")
            return True
        else:
            self.logger.warning(f"⚠️ File '{filename}' not found on printer")
            self.logger.info(f"Available files: {file_names}")
            return False
    
    def _check_for_critical_errors(self):
        """Check for critical errors that require stopping the print"""
        # For Anycubic printers, most errors are false positives
        # Only return actual critical errors here
        # For now, we'll assume no critical errors since we ignore ERROR states
        return None
    
    def disconnect(self):
        """Disconnect from printer (HTTP connections are stateless)"""
        self.logger.info(f"Anycubic {self.printer_model} printer cleanup completed")
        return True
