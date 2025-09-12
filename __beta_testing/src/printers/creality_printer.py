"""
Creality Printer Implementation for OTTOMAT3D Master Script
Handles communication with Creality printers (K1C) via WebSocket
"""

import asyncio
import websockets
import json
import time
import requests
from printers.printer_factory import BasePrinter, PrinterStatusTracker, calculate_poll_interval, is_completion_state, is_error_state

class CrealityPrinter(BasePrinter):
    """Creality printer implementation using WebSocket communication"""
    
    def __init__(self, config_data):
        """Initialize Creality printer"""
        super().__init__(config_data)
        
        # Creality specific settings
        self.websocket_url = f"ws://{self.ip_address}:9999"
        self.websocket_timeout = 10
        self.ping_interval = 30
        self.ping_timeout = 30
        
        # Status tracking
        self.status_tracker = PrinterStatusTracker()
        self.full_status = {}  # Persistent status across partial updates
        
        self.logger.info(f"Initialized Creality printer: {self.ip_address}")
        self.logger.info("Note: Printer must be ROOTED for WebSocket access")
    
    def test_connection(self):
        """Test connection to Creality printer"""
        self.logger.info(f"Testing connection to Creality printer at {self.ip_address}...")
        
        async def test_async():
            try:
                async with websockets.connect(
                    self.websocket_url,
                    open_timeout=self.websocket_timeout,
                    ping_interval=self.ping_interval,
                    ping_timeout=self.ping_timeout
                ) as websocket:
                    
                    self.logger.info("✅ WebSocket connection established")
                    
                    # Send initial status request
                    await websocket.send('{"method": "get_status"}')
                    
                    # Wait for response
                    try:
                        message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                        data = json.loads(message)
                        
                        if isinstance(data, dict) and len(data) > 0:
                            self.logger.info("✅ Successfully connected to Creality printer")
                            return True
                        else:
                            self.logger.error("❌ Invalid response from printer")
                            return False
                            
                    except asyncio.TimeoutError:
                        self.logger.error("❌ No response from printer")
                        return False
                    
            except Exception as e:
                self.logger.error(f"❌ Failed to connect to Creality printer: {e}")
                self.logger.error("Ensure printer is ROOTED and WebSocket access is available")
                return False
        
        # Run async test using a managed event loop for better compatibility
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            return loop.run_until_complete(test_async())
        except Exception as e:
            self.logger.error(f"❌ Connection test failed: {e}")
            return False
        finally:
            try:
                loop.close()
            except Exception:
                pass
    
    def get_status(self):
        """Get current printer status (synchronous wrapper)"""
        async def get_status_async():
            try:
                async with websockets.connect(
                    self.websocket_url,
                    open_timeout=self.websocket_timeout,
                    close_timeout=5,
                    ping_interval=self.ping_interval,
                    ping_timeout=self.ping_timeout
                ) as websocket:
                    
                    # Send status request
                    await websocket.send('{"method": "get_status"}')
                    
                    # Wait for response
                    message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    data = json.loads(message)
                    
                    # Update persistent status
                    self.full_status.update(data)
                    
                    # Extract relevant fields
                    state_code = self.full_status.get("state", -1)
                    state_names = {
                        0: "IDLE",
                        1: "PRINTING", 
                        2: "PAUSED",
                        3: "ERROR",
                        4: "FINISHED"
                    }
                    state_name = state_names.get(state_code, f"UNKNOWN({state_code})")
                    
                    progress = self.full_status.get("printProgress", 0)
                    current_file = self.full_status.get("printFileName", "")
                    nozzle_temp = self.full_status.get("nozzleTemp", 0)
                    bed_temp = self.full_status.get("bedTemp0", 0)
                    time_left = self.full_status.get("printLeftTime", 0)
                    
                    return {
                        'status': state_name,
                        'state_code': state_code,
                        'progress_percent': progress,
                        'current_file': current_file.split('/')[-1] if current_file else "No file",
                        'nozzle_temperature': nozzle_temp,
                        'bed_temperature': bed_temp,
                        'remaining_time_minutes': time_left / 60 if time_left > 0 else None,
                        'raw_data': self.full_status.copy()
                    }
                    
            except Exception as e:
                self.logger.warning(f"Failed to get Creality status: {e}")
                return None
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            return loop.run_until_complete(get_status_async())
        except Exception as e:
            self.logger.warning(f"Status check error: {e}")
            return None
        finally:
            try:
                loop.close()
            except Exception:
                pass
    
    def start_print(self, filename, is_first_job=False):
        """Start printing a file"""
        self.logger.info(f"Starting print: {filename}")
        
        async def start_print_async():
            try:
                # Construct file path for Creality
                opgcodefile_path = f"printprt:/usr/data/printer_data/gcodes/{filename}"
                
                start_command = {
                    "method": "set",
                    "params": {
                        "opGcodeFile": opgcodefile_path
                    }
                }
                
                async with websockets.connect(
                    self.websocket_url,
                    open_timeout=self.websocket_timeout,
                    ping_interval=self.ping_interval,
                    ping_timeout=self.ping_timeout
                ) as websocket:
                    
                    self.logger.info("Connected to Creality WebSocket for print start")
                    
                    # Send print command
                    await websocket.send(json.dumps(start_command))
                    
                    # Wait for response
                    try:
                        response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                        self.logger.info("Print command sent successfully")
                    except asyncio.TimeoutError:
                        self.logger.info("Print command sent (no immediate response)")
                    
                    # Assume print started successfully
                    self.logger.info(f"✅ Assuming print started: {filename}")
                    return True
                    
            except Exception as e:
                self.logger.error(f"❌ Failed to start print: {e}")
                return False
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            return loop.run_until_complete(start_print_async())
        except Exception as e:
            self.logger.error(f"❌ Start print error: {e}")
            return False
        finally:
            try:
                loop.close()
            except Exception:
                pass
    
    def wait_for_completion(self):
        """Wait for print to complete"""
        self.logger.info("Monitoring print for completion...")
        
        async def wait_for_completion_async():
            # Initial wait for print to start
            await asyncio.sleep(10)
            
            # Reset status tracking
            self.full_status = {}
            connection_attempts = 0
            last_log_time = 0  # Track when we last logged to console
            
            while True:  # Reconnection loop
                try:
                    connection_attempts += 1
                    
                    async with websockets.connect(
                        self.websocket_url,
                        open_timeout=self.websocket_timeout,
                        close_timeout=10,
                        ping_interval=self.ping_interval,
                        ping_timeout=self.ping_timeout
                    ) as websocket:
                        
                        self.logger.info(f"Connected for monitoring (attempt #{connection_attempts})")
                        connection_attempts = 0  # Reset on successful connection
                        
                        # Send initial status request
                        try:
                            await websocket.send('{"method": "get_status"}')
                        except:
                            pass
                        
                        while True:  # Message receiving loop
                            try:
                                message = await websocket.recv()
                                
                                try:
                                    new_data = json.loads(message)
                                    
                                    # Update persistent status
                                    self.full_status.update(new_data)
                                    
                                    # Get current status values
                                    state = self.full_status.get("state", -1)
                                    current_file = self.full_status.get("printFileName", "")
                                    progress = self.full_status.get("printProgress", 0)
                                    
                                    # Show current status (only log every 10 seconds)
                                    current_time = time.time()
                                    state_names = {0: "IDLE", 1: "PRINTING", 2: "PAUSED", 3: "ERROR", 4: "FINISHED"}
                                    state_name = state_names.get(state, f"UNKNOWN({state})")
                                    filename_short = current_file.split('/')[-1] if current_file else "No file"
                                    
                                    # Only log to console every 10 seconds (but continue monitoring)
                                    if current_time - last_log_time >= 10:
                                        self.logger.info(f"Status: {state_name} | Progress: {progress}% | File: {filename_short}")
                                        last_log_time = current_time
                                    
                                    # Check for completion conditions
                                    if state == 4:  # FINISHED
                                        self.logger.info("✅ Print completed (FINISHED)")
                                        return True
                                    elif state == 3 and progress >= 99:  # ERROR + 99% = finished
                                        self.logger.info("✅ Print completed (ERROR at 99%)")
                                        return True
                                    elif state == 2 and progress >= 99:  # PAUSED + 99% = finished
                                        self.logger.info("✅ Print completed (PAUSED at 99%+ progress)")
                                        return True
                                    elif state == 0 and progress >= 99:  # IDLE + 99% = finished  
                                        self.logger.info("✅ Print completed (IDLE at 99%)")
                                        return True
                                    elif state == 0 and progress == 0 and not current_file:
                                        self.logger.error("❌ No print running - may have failed to start")
                                        return False
                                
                                except json.JSONDecodeError:
                                    pass  # Ignore JSON errors
                                except Exception as e:
                                    self.logger.error(f"Error processing message: {e}")
                            
                            except websockets.exceptions.ConnectionClosed:
                                self.logger.info("WebSocket connection closed - will reconnect")
                                break  # Break to outer reconnection loop
                            except Exception as e:
                                self.logger.info(f"Error receiving message: {e} - will reconnect")
                                break  # Break to outer reconnection loop
                                
                except Exception as e:
                    self.logger.info(f"Connection error (attempt #{connection_attempts}): {e}")
                
                # Wait before reconnecting
                wait_time = min(5, connection_attempts)
                self.logger.info(f"Retrying connection in {wait_time} seconds...")
                await asyncio.sleep(wait_time)
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            return loop.run_until_complete(wait_for_completion_async())
        except KeyboardInterrupt:
            self.logger.info("Print monitoring stopped by user")
            return False
        except Exception as e:
            self.logger.error(f"❌ Wait for completion error: {e}")
            return False
        finally:
            try:
                loop.close()
            except Exception:
                pass

    def needs_bed_positioning(self):
        """Creality printers typically don't need bed positioning"""
        return False
    
    def position_bed_for_ejection(self):
        """Not needed for Creality printers"""
        self.logger.info("Bed positioning not required for Creality printers")
        return True
    
    def send_gcode(self, gcode_command):
        """Send custom G-code command via Moonraker HTTP API"""
        try:
            # Creality printers (when rooted) run Moonraker on port 7125
            moonraker_url = f"http://{self.ip_address}:7125/printer/gcode/script"
            data = {"script": gcode_command}
            
            # Use longer timeout for homing commands (G28) as they take much longer
            if "G28" in gcode_command.upper():
                timeout = 60  # 60 seconds for homing commands
                self.logger.info(f"Sending homing command: {gcode_command} (extended timeout)")
            else:
                timeout = 10  # 10 seconds for regular commands
                self.logger.info(f"Sending G-code: {gcode_command}")
            
            response = requests.post(moonraker_url, data=data, timeout=timeout)
            response.raise_for_status()
            
            result = response.json()
            if result.get('result') == 'ok':
                self.logger.info(f"✅ G-code sent successfully: {gcode_command}")
                return True
            else:
                self.logger.error(f"❌ G-code failed: {result}")
                return False
                
        except requests.exceptions.Timeout:
            # For movement commands, timeout is expected - assume success
            if any(cmd in gcode_command.upper() for cmd in ["G28", "G0", "G1"]):
                self.logger.info(f"✅ G-code sent successfully: {gcode_command}")
                return True
            else:
                self.logger.error(f"❌ G-code timeout: {gcode_command}")
                return False
        except Exception as e:
            self.logger.error(f"Error sending G-code '{gcode_command}': {e}")
            return False
    
    def get_printer_info(self):
        """Get printer information"""
        return {
            'brand': 'Creality',
            'ip_address': self.ip_address,
            'connection_type': 'WebSocket'
        }
    
    def pause_print(self):
        """Pause current print"""
        self.logger.warning("Pause functionality not implemented for Creality printers")
        return False
    
    def resume_print(self):
        """Resume paused print"""
        self.logger.warning("Resume functionality not implemented for Creality printers")
        return False
    
    def stop_print(self):
        """Stop current print"""
        self.logger.warning("Stop functionality not implemented for Creality printers")
        return False