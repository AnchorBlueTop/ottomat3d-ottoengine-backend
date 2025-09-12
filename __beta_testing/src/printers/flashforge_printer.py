"""
FlashForge Printer Implementation for OTTOMAT3D Master Script
Handles communication with FlashForge printers via hybrid HTTP/TCP approach
"""

import time
import socket
import requests
import json
from printers.printer_factory import BasePrinter, PrinterStatusTracker, calculate_poll_interval, is_completion_state, is_error_state

class FlashForgePrinter(BasePrinter):
    """FlashForge printer implementation using hybrid HTTP/TCP communication"""
    
    def __init__(self, config_data):
        """Initialize FlashForge printer"""
        super().__init__(config_data)
        
        # FlashForge-specific configuration
        self.serial_number = config_data.get('PRINTER_SERIAL')
        self.check_code = config_data.get('PRINTER_CHECK_CODE')
        
        # FlashForge ports
        self.http_port = 8898
        self.tcp_port = 8899
        
        # URLs for HTTP API
        self.http_base_url = f"http://{self.ip_address}:{self.http_port}"
        self.detail_url = f"{self.http_base_url}/detail"
        self.print_gcode_url = f"{self.http_base_url}/printGcode"
        self.control_url = f"{self.http_base_url}/control"
        
        # FlashForge specific settings
        self.z_position_for_ejection = 190
        self.z_move_speed = 600
        
        # TCP commands
        self.tcp_login = "~M601 S1\n"
        self.tcp_logout = "~M602\n"
        
        self.status_tracker = PrinterStatusTracker()
        
        self.logger.info(f"Initialized FlashForge printer: {self.ip_address}")
    
    def test_connection(self):
        """Test connection to FlashForge printer"""
        self.logger.info(f"Testing connection to FlashForge printer at {self.ip_address}...")
        self.logger.info("Note: LAN Mode must be ENABLED on the printer")
        
        # Test HTTP connection first
        if not self._test_http_connection():
            return False
        
        # Test TCP connection
        if not self._test_tcp_connection():
            return False
        
        self.logger.info("✅ Successfully connected to FlashForge printer (HTTP + TCP)")
        return True
    
    def _test_http_connection(self):
        """Test HTTP API connection"""
        try:
            auth_payload = {
                "serialNumber": self.serial_number,
                "checkCode": self.check_code
            }
            
            response = requests.post(self.detail_url, json=auth_payload, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if data.get("code") == 0:
                self.logger.info("✅ HTTP API connection successful")
                return True
            else:
                self.logger.error(f"❌ HTTP API error: {data.get('message')} (Code: {data.get('code')})")
                return False
                
        except requests.exceptions.RequestException as e:
            self.logger.error(f"❌ HTTP connection failed: {e}")
            self.logger.error("Ensure LAN Mode is ENABLED on the FlashForge printer")
            return False
    
    def _test_tcp_connection(self):
        """Test TCP connection for G-code commands"""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(10)
                sock.connect((self.ip_address, self.tcp_port))
                
                # Test login
                sock.sendall(self.tcp_login.encode('ascii'))
                response = sock.recv(1024).decode('ascii', errors='ignore')
                
                if "ok" in response.lower() and "control success" in response.lower():
                    self.logger.info("✅ TCP connection successful")
                    
                    # Logout before closing
                    sock.sendall(self.tcp_logout.encode('ascii'))
                    return True
                else:
                    self.logger.error(f"❌ TCP login failed: {response}")
                    return False
                    
        except Exception as e:
            self.logger.error(f"❌ TCP connection failed: {e}")
            return False
    
    def get_status(self):
        """Get current printer status via HTTP API"""
        try:
            auth_payload = {
                "serialNumber": self.serial_number,
                "checkCode": self.check_code
            }
            
            response = requests.post(self.detail_url, json=auth_payload, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if data.get("code") == 0:
                detail = data.get("detail", {})
                
                # Extract status information
                status = detail.get("status", "unknown").lower()
                current_file = detail.get("printFileName", "")
                progress_raw = detail.get("printProgress", 0.0)  # 0.0 to 1.0
                nozzle_temp = detail.get("nozzleTemp", 0)
                nozzle_target = detail.get("nozzleTargetTemp", 0)
                bed_temp = detail.get("bedTemp", 0)
                bed_target = detail.get("bedTargetTemp", 0)
                
                # Convert progress to percentage
                progress_percent = progress_raw * 100 if progress_raw is not None else 0.0
                
                return {
                    'status': status,
                    'current_file': current_file,
                    'progress_percent': progress_percent,
                    'nozzle_temperature': nozzle_temp,
                    'nozzle_target_temperature': nozzle_target,
                    'bed_temperature': bed_temp,
                    'bed_target_temperature': bed_target,
                    'raw_data': detail
                }
            else:
                self.logger.warning(f"HTTP API error getting status: {data.get('message')}")
                return None
                
        except Exception as e:
            self.logger.warning(f"Failed to get FlashForge status: {e}")
            return None
    
    def start_print(self, filename, is_first_job=False, use_material_station=False):
        """Start printing a file via HTTP API"""
        self.logger.info(f"Starting print: {filename}")
        
        try:
            if use_material_station:
                # Material Station enabled - use new working format
                payload = {
                    "serialNumber": self.serial_number,
                    "checkCode": self.check_code,
                    "fileName": filename,
                    "levelingBeforePrint": True,  # Enable bed leveling 
                    "flowCalibration": False, 
                    "useMatlStation": True,
                    "gcodeToolCnt": 0,
                    "materialMappings": []  # Empty - let printer auto-map
                }
                self.logger.info("🎯 Setting up Material Station for multi-color print")
            else:
                # Single-color print - use exact original format
                payload = {
                    "serialNumber": self.serial_number,
                    "checkCode": self.check_code,
                    "fileName": filename,
                    "levelingBeforePrint": True,  # Enable bed leveling
                    "flowCalibration": False, 
                    "useMatlStation": False,
                    "gcodeToolCnt": 0,
                    "materialMappings": []
                }
                self.logger.info("🖨️ Starting single-color print (no Material Station)")
            
            response = requests.post(self.print_gcode_url, json=payload, timeout=20)
            response.raise_for_status()
            
            data = response.json()
            if data.get("code") == 0:
                if use_material_station:
                    self.logger.info(f"✅ Material Station print '{filename}' started successfully!")
                    self.logger.info("🎨 Multi-color printing with Material Station enabled")
                else:
                    self.logger.info(f"✅ Print '{filename}' started successfully")
                time.sleep(10)  # Give printer time to start
                return True
            else:
                self.logger.error(f"❌ Failed to start print: {data.get('message')}")
                return False
                
        except Exception as e:
            self.logger.error(f"❌ Error starting print '{filename}': {e}")
            return False
    
    def wait_for_completion(self):
        """Wait for print completion via HTTP polling"""
        self.logger.info("Monitoring print for completion...")
        
        self.status_tracker.reset()
        time.sleep(15)  # Initial delay
        
        last_logged_status = ""
        consecutive_http_errors = 0
        
        while True:
            status_data = self.get_status()
            
            if not status_data:
                consecutive_http_errors += 1
                if consecutive_http_errors > 4:
                    self.logger.error("Too many HTTP status errors. Aborting wait.")
                    return False
                self.logger.warning("Failed to get status, retrying...")
                time.sleep(15)
                continue
            
            consecutive_http_errors = 0
            
            # Extract status information
            status = status_data['status']
            filename = status_data.get('current_file', 'N/A')
            progress = status_data.get('progress_percent', 0)
            nozzle_temp = status_data.get('nozzle_temperature', 0)
            bed_temp = status_data.get('bed_temperature', 0)
            
            # Create status line
            current_status_line = (
                f"Status: {status.upper()} | File: {filename.split('/')[-1]} | "
                f"Progress: {progress:.1f}% | Nozzle: {nozzle_temp:.1f}°C | Bed: {bed_temp:.1f}°C"
            )
            
            # Log only if status changed
            if current_status_line != last_logged_status:
                self.logger.info(current_status_line)
                last_logged_status = current_status_line
            
            # Check for completion
            if status == "completed":
                self.logger.info("✅ Print completed (FlashForge reports COMPLETED)")
                return True
            
            # Check alternative completion states
            if status in ["ready", "stop"] and progress >= 99.5:
                self.logger.info(f"✅ Print likely completed (Status: {status.upper()}, Progress: {progress:.1f}%)")
                return True
            
            # Check for error states
            if status in ["error", "fault"]:
                self.logger.error(f"❌ Print failed - Status: {status.upper()}")
                return False
            
            # Calculate poll interval
            poll_interval = 30 if progress < 90 else 10 if progress < 99 else 5
            time.sleep(poll_interval)
    
    def needs_bed_positioning(self):
        """FlashForge printers need bed positioning for ejection"""
        return True
    
    def position_bed_for_ejection(self):
        """Position bed via TCP G-code commands (clear platform first, then move bed)"""
        self.logger.info(f"Preparing for bed positioning - checking printer state...")
        
        # STEP 1: Clear platform state first (FlashForge printers are locked until this is done)
        status_data = self.get_status()
        if status_data and status_data['status'] == "completed":
            self.logger.info("Printer in COMPLETED state - clearing platform first to unlock bed movement...")
            if not self.clear_platform_state():
                self.logger.error("Failed to clear platform state - cannot proceed with bed positioning")
                return False
        elif status_data and status_data['status'] == "ready":
            self.logger.info("Printer already in READY state - proceeding with bed positioning")
        else:
            current_status = status_data['status'] if status_data else 'unknown'
            self.logger.warning(f"Printer in unexpected state '{current_status}' - attempting bed positioning anyway...")
        
        # STEP 2: Now position the bed via TCP (printer should be unlocked)
        self.logger.info(f"Positioning bed to Z{self.z_position_for_ejection}mm via TCP...")
        
        gcode_sequence = [
            "~G28 Z0\n",  # Home Z axis
            "~M400\n",    # Wait for completion
            "~G90\n",     # Absolute positioning
            f"~G1 Z{self.z_position_for_ejection} F{self.z_move_speed}\n",  # Move to position
            "~M400\n"     # Wait for completion
        ]
        
        if self._send_tcp_gcode_sequence(gcode_sequence, "Z-Positioning"):
            self.logger.info(f"✅ Bed positioned successfully at Z{self.z_position_for_ejection}mm")
            return True
        else:
            self.logger.error("❌ Failed to position bed via TCP")
            return False
    
    def clear_platform_state(self):
        """Clear the 'platform needs clearing' state via HTTP API"""
        self.logger.info("Checking if platform state needs clearing...")
        
        try:
            # First check current status
            status_data = self.get_status()
            if not status_data:
                self.logger.error("Cannot get printer status to check platform state")
                return False
            
            current_status = status_data['status']
            
            # If already ready, no need to clear
            if current_status == "ready":
                self.logger.info("✅ Printer already in READY state - no platform clearing needed")
                return True
            
            # If not completed, something is unexpected
            if current_status != "completed":
                self.logger.warning(f"Printer in unexpected state '{current_status}' - attempting to clear platform anyway...")
            else:
                self.logger.info("Printer in COMPLETED state - clearing platform to unlock printer...")
            
            payload = {
                "serialNumber": self.serial_number,
                "checkCode": self.check_code,
                "payload": {
                    "cmd": "stateCtrl_cmd",
                    "args": {"action": "setClearPlatform"}
                }
            }
            
            response = requests.post(self.control_url, json=payload, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if data.get("code") == 0:
                self.logger.info("✅ Clear platform command sent")
                
                # Wait for state to change to ready
                for _ in range(7):
                    time.sleep(3)
                    status_data = self.get_status()
                    if status_data and status_data['status'] == "ready":
                        self.logger.info("✅ Printer transitioned to READY state")
                        return True
                    self.logger.info(f"Waiting for READY state, current: {status_data['status'] if status_data else 'unknown'}")
                
                self.logger.warning("Printer did not quickly transition to READY after clear platform")
                return False
            else:
                self.logger.error(f"❌ Clear platform failed: {data.get('message')}")
                return False
                
        except Exception as e:
            self.logger.error(f"❌ Error clearing platform state: {e}")
            return False
    
    def _send_tcp_gcode_sequence(self, gcode_sequence, context="G-code"):
        """Send a sequence of G-code commands via TCP"""
        self.logger.info(f"Sending {context} sequence via TCP...")
        
        tcp_socket = None
        try:
            # Connect
            tcp_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            tcp_socket.settimeout(10)
            tcp_socket.connect((self.ip_address, self.tcp_port))
            tcp_socket.settimeout(7)
            
            self.logger.info(f"TCP connected for {context}")
            
            # Login
            login_resp = self._send_receive_tcp_command(tcp_socket, self.tcp_login, "Login", 7)
            if not (login_resp and "ok" in login_resp.lower() and "control success" in login_resp.lower()):
                self.logger.warning(f"TCP login response: '{login_resp}'. Proceeding cautiously.")
            else:
                self.logger.info(f"TCP login successful for {context}")
            
            time.sleep(0.2)
            
            # Send G-code sequence
            for cmd_line in gcode_sequence:
                if not cmd_line.strip():
                    continue
                
                # Set timeout based on command type
                if "G28" in cmd_line.upper():
                    timeout = 90.0  # Homing can take time
                elif "M400" in cmd_line.upper():
                    timeout = 60.0  # Wait commands
                else:
                    timeout = 7.0   # Regular commands
                
                resp = self._send_receive_tcp_command(tcp_socket, cmd_line, f"{context}: {cmd_line.strip()}", timeout)
                
                # Check for critical commands
                is_critical = any(x in cmd_line.upper() for x in ["G0", "G1", "G28", "M400"])
                
                if is_critical and not (resp and "ok" in resp.lower()):
                    self.logger.error(f"Critical command '{cmd_line.strip()}' failed. Response: '{resp}'")
                    return False
                elif resp and "ok" in resp.lower():
                    self.logger.info(f"✅ Command '{cmd_line.strip()}' acknowledged")
                elif not is_critical:
                    self.logger.info(f"Non-critical command '{cmd_line.strip()}' sent. Response: '{resp}'")
            
            self.logger.info(f"✅ {context} sequence completed successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Error during {context} TCP sequence: {e}")
            return False
        finally:
            if tcp_socket:
                try:
                    self._send_receive_tcp_command(tcp_socket, self.tcp_logout, "Logout", 2, False)
                except:
                    pass
                finally:
                    tcp_socket.close()
                    self.logger.info(f"TCP connection closed for {context}")
    
    def _send_receive_tcp_command(self, sock, command, command_name="TCP Command", expected_ok_timeout=7.0, read_until_ok=True):
        """Send TCP command and wait for response"""
        if not sock:
            self.logger.error(f"TCP socket not valid for {command_name}")
            return None
        
        full_response = ""
        try:
            self.logger.debug(f"TCP SEND: {command.strip()}")
            sock.sendall(command.encode('ascii'))
            
            if not read_until_ok:
                return "SENT_NO_READ"
            
            start_time = time.time()
            response_buffer = bytearray()
            
            while True:
                if time.time() - start_time > expected_ok_timeout:
                    full_response = response_buffer.decode('ascii', errors='ignore').strip()
                    self.logger.warning(f"TCP timeout ({expected_ok_timeout}s) for '{command_name}'. Buffer: '{full_response[:100]}'")
                    break
                
                sock.settimeout(0.25)
                try:
                    chunk = sock.recv(1024)
                    if not chunk:
                        full_response = response_buffer.decode('ascii', errors='ignore').strip()
                        self.logger.warning(f"TCP connection closed for {command_name}. Buffer: '{full_response[:100]}'")
                        break
                    
                    response_buffer.extend(chunk)
                    decoded_so_far = response_buffer.decode('ascii', errors='ignore')
                    
                    if "\nok" in decoded_so_far.lower() or decoded_so_far.strip().endswith("ok"):
                        full_response = decoded_so_far.strip()
                        break
                    
                    if len(response_buffer) > 2048:
                        self.logger.warning("TCP buffer > 2KB. Breaking.")
                        full_response = decoded_so_far.strip()
                        break
                        
                except socket.timeout:
                    pass  # Continue polling
            
            sock.settimeout(5.0)
            self.logger.debug(f"TCP RECV ({command_name}): {full_response.replace(chr(10), ' | ').replace(chr(13), '')[:150] if full_response else '<empty>'}")
            return full_response
            
        except Exception as e:
            self.logger.error(f"TCP error for {command_name}: {e}")
            return None
    
    def send_gcode(self, gcode_command):
        """Send custom G-code command via TCP"""
        gcode_sequence = [f"~{gcode_command}\n"]
        return self._send_tcp_gcode_sequence(gcode_sequence, f"Custom G-code: {gcode_command}")
    
    def get_printer_info(self):
        """Get printer information"""
        return {
            'brand': 'FlashForge',
            'ip_address': self.ip_address,
            'serial_number': self.serial_number,
            'connection_type': 'HTTP + TCP'
        }
    
    def prepare_for_next_job(self):
        """Prepare printer for next job (clear platform state)"""
        return self.clear_platform_state()
