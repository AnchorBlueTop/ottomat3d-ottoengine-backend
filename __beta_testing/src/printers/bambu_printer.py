"""
Bambu Lab Printer Implementation for OTTOMAT3D Master Script
Handles communication with Bambu Lab printers via MQTT
"""

import time
import logging
import bambulabs_api as bl_api
from printers.printer_factory import BasePrinter, PrinterStatusTracker, calculate_poll_interval, is_completion_state, is_error_state

# SSL Warning Suppression Filter for X1C Handshake Issues
class SSLHandshakeWarningFilter(logging.Filter):
    """Filter to suppress SSL handshake failure warnings from bambulabs_api library"""
    
    def filter(self, record):
        # Suppress SSL handshake failure warnings that occur with X1C
        if hasattr(record, 'getMessage'):
            message = record.getMessage()
            if ('sslv3 alert handshake failure' in message.lower() or 
                'ssl: sslv3_alert_handshake_failure' in message.lower()):
                return False
        return True

# Apply the filter to the root logger to catch warnings from bambulabs_api
_ssl_filter = SSLHandshakeWarningFilter()
logging.getLogger().addFilter(_ssl_filter)

class BambuLabPrinter(BasePrinter):
    """Bambu Lab printer implementation using bambulabs_api library"""
    
    def __init__(self, config_data):
        """Initialize Bambu Lab printer"""
        super().__init__(config_data)
        
        # Bambu-specific configuration
        self.serial_number = str(config_data.get('PRINTER_SERIAL', ''))
        self.access_code = str(config_data.get('PRINTER_ACCESS_CODE', ''))
        self.printer_model = config_data.get('PRINTER_MODEL', '')
        
        # Bambu Lab specific settings
        self.first_job_wait_seconds = 30  # Reduced from 120 as requested
        
        # Model-specific positioning settings
        if self.printer_model == 'A1':
            # A1 is a sling bed printer - use Y positioning
            self.is_sling_bed = True
            self.y_position_for_ejection = 170
            self.z_position_for_ejection = None
        else:
            # P1P, P1S, X1C are Z-bed printers
            self.is_sling_bed = False
            self.z_position_for_ejection = 200
            self.y_position_for_ejection = None
            
        self.z_move_delay_seconds = 5
        
        # MQTT connection instance and state management
        self.printer_instance = None
        self.status_tracker = PrinterStatusTracker()
        
        # Connection reuse strategy
        self._connection_healthy = False
        self._last_successful_connection = 0
        
        bed_type = "sling bed (Y-axis)" if self.is_sling_bed else "Z-bed (Z-axis)"
        self.logger.info(f"Initialized Bambu Lab {self.printer_model} printer: {self.ip_address} ({bed_type})")
    
    def test_connection(self):
        """Test connection with connection reuse strategy"""
        self.logger.info(f"Testing connection to Bambu Lab printer at {self.ip_address}...")
        
        # Check if we have a healthy existing connection
        if self._connection_healthy and self.printer_instance:
            if self._is_connection_healthy():
                try:
                    state = self.printer_instance.get_state()
                    if state and state != 'UNKNOWN':
                        self.logger.info(f"✅ Using existing connection - State: {state}")
                        return True
                except Exception as e:
                    self.logger.debug(f"Existing connection failed health check: {e}")
                    # Connection went stale, mark as unhealthy and create new one
                    self._connection_healthy = False
        
        # Create new connection if needed
        return self._establish_fresh_connection()
    
    def _is_connection_healthy(self):
        """Quick health check for existing connection"""
        if not self.printer_instance:
            return False
        
        try:
            # Try a lightweight operation to test connection
            state = self.printer_instance.get_state()
            return state is not None and state != 'UNKNOWN'
        except Exception:
            return False
    
    def _establish_fresh_connection(self):
        """Establish a new MQTT connection"""
        self.logger.info("Establishing fresh MQTT connection...")
        
        try:
            # Clean up any existing connection first
            if self.printer_instance:
                try:
                    self.printer_instance.disconnect()
                except Exception:
                    pass
                self.printer_instance = None
                # Brief pause to allow cleanup
                time.sleep(1)
            
            # Create new printer instance
            self.printer_instance = bl_api.Printer(
                self.ip_address, 
                self.access_code, 
                self.serial_number
            )
            
            # Attempt connection
            connection_response = self.printer_instance.connect()
            self.logger.info(f"Connection response: {connection_response}")
            
            # Enhanced MQTT establishment with exponential backoff
            initial_wait = 8  # Longer initial wait for MQTT
            time.sleep(initial_wait)
            
            # Test connection with improved retry logic
            retry_count = 0
            max_retries = 8  # More retries
            base_delay = 2
            
            while retry_count < max_retries:
                try:
                    state = self.printer_instance.get_state()
                    if state and state != 'UNKNOWN':
                        self.logger.info(f"✅ Successfully connected to Bambu Lab printer - State: {state}")
                        # Mark connection as healthy and record success time
                        self._connection_healthy = True
                        self._last_successful_connection = time.time()
                        return True
                except TimeoutError:
                    # Expected during connection establishment
                    pass
                except Exception as e:
                    self.logger.debug(f"Connection attempt {retry_count + 1} error: {e}")
                
                # Exponential backoff with max delay
                delay = min(base_delay * (2 ** retry_count), 15)  # Max 15s delay
                self.logger.info(f"Waiting for MQTT connection... Retry {retry_count + 1}/{max_retries} (wait {delay}s)")
                time.sleep(delay)
                retry_count += 1
            
            self.logger.error("❌ Failed to establish stable MQTT connection")
            self._connection_healthy = False
            return False
            
        except TimeoutError:
            self.logger.error("❌ Connection timeout")
            self._connection_healthy = False
            return False
        except Exception as e:
            self.logger.error(f"❌ Failed to connect to Bambu Lab printer: {e}")
            self._connection_healthy = False
            return False
    
    def get_status(self):
        """Get current printer status"""
        if not self.printer_instance:
            return None
        
        try:
            state = self.printer_instance.get_state()
            bed_temp = self.printer_instance.get_bed_temperature()
            nozzle_temp = self.printer_instance.get_nozzle_temperature()
            time_remaining = self.printer_instance.get_time()  # Returns minutes
            current_file = self.printer_instance.gcode_file()
            
            # Get print progress percentage
            progress_percent = 0.0
            try:
                # Try to get progress from mqtt_dump like the working script
                if hasattr(self.printer_instance, 'mqtt_dump'):
                    status_dump = self.printer_instance.mqtt_dump()
                    if status_dump and isinstance(status_dump, dict):
                        # Look for progress in various possible locations
                        progress_percent = self._extract_progress_from_dump(status_dump)
                
                # Fallback: try direct progress method
                if progress_percent == 0.0 and hasattr(self.printer_instance, 'get_progress'):
                    fallback_progress = self.printer_instance.get_progress()
                    if fallback_progress is not None:
                        progress_percent = fallback_progress
                        
            except TimeoutError:
                # Silently ignore timeout errors when getting progress
                pass
            except Exception as e:
                self.logger.debug(f"Could not get progress: {e}")
                progress_percent = 0.0
            
            # Try to get current state details
            current_stage = 'N/A'
            try:
                current_state_data = self.printer_instance.get_current_state()
                # Handle PrintStatus object - convert to string or try to access attributes
                if hasattr(current_state_data, 'stage'):
                    current_stage = str(current_state_data.stage)
                elif current_state_data:
                    current_stage = str(current_state_data)
            except TimeoutError:
                # Silently ignore timeout errors when getting state details
                current_state_data = None
            except Exception as e:
                self.logger.debug(f"Could not get current state details: {e}")
                current_state_data = None
            
            # Format status data
            status_data = {
                'status': state,
                'progress_percent': progress_percent,
                'bed_temperature': bed_temp,
                'nozzle_temperature': nozzle_temp,
                'remaining_time_minutes': time_remaining,
                'current_file': current_file,
                'current_stage': current_stage,
                'raw_data': current_state_data
            }
            
            return status_data
            
        except TimeoutError:
            # Silently ignore MQTT timeout errors - these are normal
            return None
        except Exception as e:
            self.logger.warning(f"Failed to get Bambu Lab printer status: {e}")
            return None
    
    def _extract_progress_from_dump(self, status_dump):
        """Extract progress percentage from MQTT status dump"""
        try:
            # Common locations where progress might be found in Bambu Lab MQTT data
            possible_locations = [
                ['print', 'mc_percent'],
                ['print', 'percent'], 
                ['mc_print', 'mc_percent'],
                ['mc_print', 'percent'],
                ['gcode_state', 'mc_percent'],
                ['mc_percent'],
                ['percent'],
                ['progress'],
                ['print_progress']
            ]
            
            for location in possible_locations:
                current = status_dump
                try:
                    for key in location:
                        if isinstance(current, dict) and key in current:
                            current = current[key]
                        else:
                            break
                    else:
                        # We successfully navigated to the value
                        if isinstance(current, (int, float)):
                            progress = float(current)
                            if 0 <= progress <= 100:
                                self.logger.debug(f"Found progress {progress}% at location: {' -> '.join(location)}")
                                return progress
                except (KeyError, TypeError):
                    continue
            
            # If no progress found, log available keys for debugging
            if isinstance(status_dump, dict):
                top_keys = list(status_dump.keys())
                self.logger.debug(f"No progress found. Available top-level keys: {top_keys}")
            
            return 0.0
            
        except Exception as e:
            self.logger.debug(f"Error extracting progress from dump: {e}")
            return 0.0
    
    def start_print(self, filename, is_first_job=False, use_ams=False):
        """Complete AMS solution with filament mapping table"""
        self.logger.info(f"Starting print: {filename} (First job: {is_first_job}, AMS: {use_ams})")
        
        if not self.printer_instance:
            self.logger.error("Printer not connected")
            return False
        
        try:
            if use_ams:
                self.logger.info("🎯 Setting up AMS for multi-material print")
                
                # STEP 1: Send AMS filament settings for each slot to create the mapping table
                if not self._setup_ams_mapping_table():
                    self.logger.error("❌ Failed to setup AMS mapping table")
                    return False
                
                # STEP 2: Start print with AMS mapping
                self.logger.info("🚀 Starting print with AMS mapping...")
                ams_mapping = [0, 1, 2, 3]  # T0→Slot1, T1→Slot2, T2→Slot3, T3→Slot4
                
                try:
                    response = self.printer_instance.start_print(
                        filename,
                        "",  # Empty string - matches Node.js approach to avoid SD card errors
                        use_ams=True,
                        ams_mapping=ams_mapping,
                        flow_calibration=True
                    )
                    self.logger.info(f"✅ AMS print started successfully!")
                    
                except TimeoutError:
                    self.logger.info("📤 AMS print command sent (timeout on response - normal)")
                except Exception as e:
                    self.logger.error(f"❌ AMS print failed: {e}")
                    return False
            else:
                # Single material print
                self.logger.info(f"📤 Starting single-material print: {filename}")
                try:
                    response = self.printer_instance.start_print(filename, "", use_ams=False)  # Empty string - matches Node.js approach
                except TimeoutError:
                    self.logger.info("Print command sent (timeout on response - normal)")
            
            # Wait and validate
            wait_time = self.first_job_wait_seconds if is_first_job else (20 if use_ams else 10)
            self.logger.info(f"⏳ Waiting {wait_time}s for initialization...")
            time.sleep(wait_time)
            
            # Check if print started
            for i in range(10):
                time.sleep(3)
                try:
                    state = self.printer_instance.get_state()
                    self.logger.info(f"State check {i+1}: {state}")
                    
                    if state in ['PRINTING', 'RUNNING', 'HEATING', 'PREPARE']:
                        self.logger.info("✅ Print started successfully!")
                        return True
                    elif state in ['ERROR', 'FAILED']:
                        self.logger.error(f"❌ Print failed: {state}")
                        return False
                        
                except Exception as e:
                    self.logger.warning(f"State check failed: {e}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Start print error: {e}")
            return False

    def _setup_ams_mapping_table(self):
        """Setup AMS filament mapping table (using placeholder values)"""
        self.logger.info("⏳ Configuring AMS mapping table...")
        
        # Import the Filament enum from bambulabs_api
        try:
            from bambulabs_api.filament_info import Filament
        except ImportError:
            self.logger.error("❌ Cannot import Filament from bambulabs_api")
            return False
        
        # Placeholder filament settings (reverting to original working config)
        ams_slots = [
            {"slot": 0, "color": "808080", "name": "PETG Gray"},    # Slot 1 = index 0
            {"slot": 1, "color": "000000", "name": "PETG Black"},   # Slot 2 = index 1  
            {"slot": 2, "color": "FF0000", "name": "PETG Red"},     # Slot 3 = index 2
            {"slot": 3, "color": "0000FF", "name": "PETG Blue"}     # Slot 4 = index 3
        ]
        
        # Send filament settings for each slot (simplified logging)
        for slot_info in ams_slots:
            slot_id = slot_info["slot"]
            color = slot_info["color"] 
            
            try:
                # Set filament for this slot
                success = self.printer_instance.set_filament_printer(
                    color=color,
                    filament=Filament.PETG,  # Use the PETG filament type
                    ams_id=0,  # First AMS unit
                    tray_id=slot_id  # The slot index
                )
                
                if not success:
                    self.logger.error(f"❌ Failed to configure AMS slot {slot_id+1}")
                    return False
                    
                # Small delay between slot configurations
                time.sleep(1)
                
            except Exception as e:
                self.logger.error(f"❌ Error configuring AMS slot {slot_id+1}: {e}")
                return False
        
        # Wait for AMS to process the mapping table
        time.sleep(5)
        
        # Verify AMS is ready (optional but good practice)
        try:
            ams_hub = self.printer_instance.ams_hub()
            if ams_hub and hasattr(ams_hub, 'ams_hub') and ams_hub.ams_hub:
                self.logger.info("✅ AMS mapping table configured successfully!")
                return True
            else:
                self.logger.warning("⚠️  AMS hub not responding, but continuing anyway...")
                return True
        except Exception as e:
            self.logger.warning(f"⚠️  Could not verify AMS status: {e}, but continuing...")
            return True
    
    def wait_for_completion(self):
        """Wait for current print to complete"""
        self.logger.info("Monitoring print for completion...")
        
        # Reset status tracker for this print
        self.status_tracker.reset()
        
        consecutive_idle_low_progress = 0
        has_started_printing = False  # Track if we've seen PRINTING state
        initial_idle_count = 0        # Count initial IDLE states before print starts
        
        while True:
            status_data = self.get_status()
            
            if not status_data:
                self.logger.error("Failed to get printer status during print")
                time.sleep(15)
                continue
            
            state = status_data['status']
            remaining_time = status_data.get('remaining_time_minutes', 0)
            
            # Log current status
            self._log_status(status_data, "Print Monitor")
            
            # Track status changes
            analysis = self.status_tracker.update(status_data)
            
            if analysis['potential_issue']:
                self.logger.warning(f"Potential issue detected: {analysis['issue_description']}")
            
            # Check for completion
            if state == "FINISH":
                self.logger.info("Print completed - printer reports FINISH state")
                
                # Give printer a moment to stabilize
                time.sleep(3)
                
                # Check final state
                final_status = self.get_status()
                if final_status:
                    final_state = final_status['status']
                    self.logger.info(f"Final printer state: {final_state}")
                
                return True
            
            # Track if printing has actually started
            if state == "PRINTING":
                has_started_printing = True
                consecutive_idle_low_progress = 0
                initial_idle_count = 0
            
            # Check for IDLE state completion (only after print has started)
            if state == "IDLE":
                progress = status_data.get('progress_percent', 0)
                remaining_time = status_data.get('remaining_time_minutes', 0)
                
                if not has_started_printing:
                    # Print hasn't started yet, this is initial IDLE state
                    initial_idle_count += 1
                    if initial_idle_count > 10:
                        self.logger.warning("Print may have failed to start - IDLE for too long")
                        return False
                    self.logger.debug(f"Initial IDLE state #{initial_idle_count} - waiting for print to start...")
                else:
                    # Print has started, now IDLE could mean completion
                    if progress >= 99:
                        self.logger.info(f"Print completed - IDLE state with {progress:.1f}% progress after printing")
                        return True
                    
                    if remaining_time is not None and remaining_time <= 0 and progress > 80:
                        self.logger.info(f"Print completed - IDLE with no remaining time and {progress:.1f}% progress")
                        return True
                    
                    # Count consecutive IDLE states after printing started
                    consecutive_idle_low_progress += 1
                    if consecutive_idle_low_progress > 5:
                        self.logger.info(f"Print likely completed - IDLE state after printing for {consecutive_idle_low_progress} checks")
                        return True
            else:
                consecutive_idle_low_progress = 0
            
            # Check for error states
            if is_error_state(state):
                self.logger.error(f"Print failed - printer in error state: {state}")
                return False
            
            # Calculate next poll interval
            poll_interval = calculate_poll_interval(remaining_time)
            
            self.logger.info(f"Next status check in {poll_interval} seconds...")
            time.sleep(poll_interval)
    
    def needs_bed_positioning(self):
        """Bambu Lab printers need bed positioning for ejection"""
        return True
    
    def position_bed_for_ejection(self):
        """Position bed for ejection (Y for sling bed models, Z for others)"""
        if not self.printer_instance:
            self.logger.error("Printer not connected")
            return False
        
        try:
            if self.is_sling_bed:
                # Sling bed (A1) - use Y positioning
                self.logger.info(f"Positioning sling bed to Y{self.y_position_for_ejection}mm for ejection...")
                gcode_command = f"G90\nG1 Y{self.y_position_for_ejection} F600"
                
                try:
                    success = self.printer_instance.gcode(gcode_command)
                except TimeoutError:
                    # Silently handle timeout - assume command sent successfully
                    success = True
                    self.logger.info(f"✅ Y-axis positioning command sent (timeout during response)")
                
                if success:
                    self.logger.info(f"✅ Y-axis positioning command sent successfully")
                    self.logger.info(f"Waiting {self.z_move_delay_seconds} seconds for movement to complete...")
                    time.sleep(self.z_move_delay_seconds)
                    return True
                else:
                    self.logger.error("❌ Failed to send Y-axis positioning command")
                    return False
            else:
                # Z-bed (P1P, P1S, X1C) - use Z positioning like the working script
                self.logger.info(f"Positioning bed to Z{self.z_position_for_ejection}mm for ejection...")
                
                # Use actual newlines like the working script, not escaped ones
                gcode_command = f"G90\nG1 Z{self.z_position_for_ejection} F600"
                
                self.logger.info(f"Sending G-code: {gcode_command.replace(chr(10), '; ')}")
                
                try:
                    success = self.printer_instance.gcode(gcode_command)
                except TimeoutError:
                    # Silently handle timeout - assume command sent successfully
                    success = True
                    self.logger.info(f"✅ Z-axis positioning command sent (timeout during response)")
                
                if success:
                    self.logger.info(f"✅ Z-axis positioning command sent successfully")
                    
                    # Wait for movement to complete like the working script
                    self.logger.info("Waiting for bed movement to complete...")
                    if self._wait_for_move_completion(timeout_seconds=20):
                        self.logger.info("✅ Bed positioning completed successfully")
                        return True
                    else:
                        self.logger.warning("⚠️ Bed movement timeout, but continuing anyway")
                        return True  # Continue anyway, movement might have worked
                else:
                    self.logger.error("❌ Failed to send Z-axis positioning command")
                    return False
                
        except TimeoutError:
            # Handle timeout at the top level
            self.logger.info("✅ Bed positioning command sent (response timed out - this is normal)")
            return True
        except Exception as e:
            self.logger.error(f"❌ Error positioning bed: {e}")
            return False
    
    def _wait_for_move_completion(self, timeout_seconds=20, poll_interval=2):
        """Wait for printer to finish movement (based on working script approach)"""
        if not self.printer_instance:
            return False
        
        self.logger.debug(f"Waiting for printer to complete movement (max {timeout_seconds}s)...")
        start_time = time.time()
        previous_status = None
        
        while True:
            if time.time() - start_time > timeout_seconds:
                self.logger.warning(f"Timeout waiting for movement completion. Last status: {previous_status}")
                return False
            
            try:
                current_status = self.printer_instance.get_state()
                if current_status != previous_status:
                    self.logger.debug(f"  Movement status: {current_status}")
                    previous_status = current_status
                
                # States that indicate movement is complete (like the working script)
                if current_status and current_status.upper() in ['IDLE', 'FINISH', 'COMPLETED', 'READY']:
                    self.logger.debug("Printer reported idle-like state - movement likely complete")
                    return True
                    
            except TimeoutError:
                # Silently ignore timeout errors during movement waiting
                pass
            except Exception as e:
                self.logger.debug(f"Error getting state during movement wait: {e}")
            
            time.sleep(poll_interval)
    
    def pause_print(self):
        """Pause current print"""
        if not self.printer_instance:
            return False
        
        try:
            # Bambu Lab API pause method
            result = self.printer_instance.pause_print()
            self.logger.info(f"Pause print result: {result}")
            return True
        except TimeoutError:
            # Silently handle timeout errors
            self.logger.info("Pause print command sent (response timed out)")
            return True
        except Exception as e:
            self.logger.error(f"Failed to pause print: {e}")
            return False
    
    def resume_print(self):
        """Resume paused print"""
        if not self.printer_instance:
            return False
        
        try:
            # Bambu Lab API resume method
            result = self.printer_instance.resume_print()
            self.logger.info(f"Resume print result: {result}")
            return True
        except TimeoutError:
            # Silently handle timeout errors
            self.logger.info("Resume print command sent (response timed out)")
            return True
        except Exception as e:
            self.logger.error(f"Failed to resume print: {e}")
            return False
    
    def stop_print(self):
        """Stop current print"""
        if not self.printer_instance:
            return False
        
        try:
            # Bambu Lab API stop method
            result = self.printer_instance.stop_print()
            self.logger.info(f"Stop print result: {result}")
            return True
        except TimeoutError:
            # Silently handle timeout errors
            self.logger.info("Stop print command sent (response timed out)")
            return True
        except Exception as e:
            self.logger.error(f"Failed to stop print: {e}")
            return False
    
    def send_gcode(self, gcode_command):
        """Send custom G-code command"""
        if not self.printer_instance:
            return False
        
        try:
            success = self.printer_instance.gcode(gcode_command)
            if success:
                self.logger.info(f"✅ G-code sent: {gcode_command}")
            else:
                self.logger.error(f"❌ Failed to send G-code: {gcode_command}")
            return success
        except TimeoutError:
            # Silently handle timeout errors from G-code commands
            self.logger.info(f"✅ G-code sent: {gcode_command} (response timed out - this is normal)")
            return True  # Assume success since command was sent
        except Exception as e:
            self.logger.error(f"Error sending G-code '{gcode_command}': {e}")
            return False
    
    def get_printer_info(self):
        """Get printer information"""
        if not self.printer_instance:
            return None
        
        try:
            return {
                'brand': 'Bambu Lab',
                'ip_address': self.ip_address,
                'serial_number': self.serial_number,
                'connection_type': 'MQTT'
            }
        except Exception as e:
            self.logger.error(f"Failed to get printer info: {e}")
            return None
    
    def disconnect(self):
        """Disconnect from printer and reset connection state"""
        if self.printer_instance:
            try:
                # Try to disconnect gracefully
                self.printer_instance.disconnect()
                self.logger.info("Disconnected from Bambu Lab printer")
                
                # Give a moment for the connection to close
                time.sleep(1)
                
            except TimeoutError:
                # Silently handle timeout during disconnect
                self.logger.info("Bambu Lab printer disconnected (timeout during disconnect)")
            except Exception as e:
                self.logger.warning(f"Error during disconnect: {e}")
            finally:
                self.printer_instance = None
                # Reset connection state
                self._connection_healthy = False
                self._last_successful_connection = 0
                self.logger.debug("Bambu Lab printer instance and connection state cleared")
    
    def __del__(self):
        """Cleanup on destruction"""
        self.disconnect()
