"""
OttoEject Controller for OTTOMAT3D Master Script
Handles communication with the OttoEject mechanical arm via Moonraker API
"""

import time
import requests
from utils.logger import setup_logger, StatusLogger

class OttoEjectController:
    """Controller for OttoEject mechanical arm"""
    
    def __init__(self, ip_address, port=7125):
        """
        Initialize OttoEject controller
        
        Args:
            ip_address: IP address or hostname of OttoEject (e.g., ottoeject.local)
            port: Moonraker port (default: 7125)
        """
        self.ip_address = ip_address
        self.port = port
        self.base_url = f"http://{ip_address}:{port}"
        self.logger = setup_logger()
        self.status_logger = StatusLogger()
        
        # Timeout settings
        self.command_timeout = 30  # Timeout for sending commands (avoid proxy 504 errors)
        self.status_timeout = 5    # Timeout for status checks
        self.operation_timeout = 180  # Timeout for macro completion
        self.poll_interval = 3     # Polling interval for status checks
    
    def test_connection(self):
        """Test connection to OttoEject"""
        self.logger.info(f"Testing connection to OttoEject at {self.ip_address}...")
        
        try:
            url = f"{self.base_url}/printer/info"
            response = requests.get(url, timeout=self.status_timeout)
            response.raise_for_status()
            
            data = response.json()
            if 'result' in data:
                self.logger.info("✅ Successfully connected to OttoEject")
                return True
            else:
                self.logger.error("❌ Invalid response from OttoEject")
                return False
                
        except requests.exceptions.RequestException as e:
            self.logger.error(f"❌ Failed to connect to OttoEject: {e}")
            return False
    
    def get_status(self):
        """Get current OttoEject status"""
        try:
            url = f"{self.base_url}/printer/objects/query?idle_timeout"
            response = requests.get(url, timeout=self.status_timeout)
            response.raise_for_status()
            
            data = response.json()
            klipper_state = data.get('result', {}).get('status', {}).get('idle_timeout', {}).get('state', 'unknown')
            
            return {
                'status': klipper_state.upper(),
                'raw_data': data
            }
            
        except requests.exceptions.RequestException as e:
            self.logger.warning(f"Failed to get OttoEject status: {e}")
            return {'status': 'OFFLINE', 'raw_data': None}
    
    def wait_for_idle(self, timeout_seconds=None):
        """
        Wait for OttoEject to become idle/ready
        
        Args:
            timeout_seconds: Maximum time to wait (default: self.operation_timeout)
        
        Returns:
            bool: True if became idle, False if timeout
        """
        if timeout_seconds is None:
            timeout_seconds = self.operation_timeout
        
        self.logger.info("Waiting for OttoEject to become IDLE...")
        start_time = time.time()
        
        while time.time() - start_time < timeout_seconds:
            status_data = self.get_status()
            current_status = status_data['status']
            
            self.status_logger.log_ottoeject_status("OttoEject", status_data)
            
            if current_status in ["IDLE", "READY"]:
                self.logger.info("✅ OttoEject is IDLE")
                return True
            
            time.sleep(self.poll_interval)
        
        self.logger.error(f"❌ Timeout waiting for OttoEject to become IDLE ({timeout_seconds}s)")
        return False
    
    def execute_macro(self, macro_name, params=None):
        """
        Execute a Klipper macro on OttoEject
        
        Args:
            macro_name: Name of the macro to execute
            params: Optional dictionary of macro parameters
        
        Returns:
            bool: True if macro executed successfully, False otherwise
        """
        self.logger.info(f"Executing OttoEject macro: {macro_name}")
        
        # Build macro command
        script = macro_name
        if params:
            param_str = " ".join([f'{k.upper()}={v}' for k, v in params.items()])
            script = f"{macro_name} {param_str}"
        
        # Send macro command
        if not self._send_macro_command(script):
            return False
        
        # Wait for completion
        if not self.wait_for_idle():
            self.logger.error(f"❌ Macro '{macro_name}' did not complete within timeout")
            return False
        
        self.status_logger.log_macro_execution(macro_name, True)
        return True
    
    def _send_macro_command(self, script):
        """
        Send macro command to Moonraker
        
        Args:
            script: G-code script/macro to execute
        
        Returns:
            bool: True if command was accepted, False otherwise
        """
        try:
            url = f"{self.base_url}/printer/gcode/script"
            params = {'script': script}
            
            self.logger.debug(f"Sending command to {url}: {script}")
            response = requests.post(url, params=params, timeout=self.command_timeout)
            
            # Handle 502 errors which might indicate timeouts but successful dispatch
            if response.status_code == 502:
                self.logger.warning(
                    f"Received 502 for macro '{script}' - likely timeout but command may have been dispatched"
                )
                return True  # Assume command was sent, wait_for_idle will verify completion
            
            response.raise_for_status()
            
            # Check response
            data = response.json()
            if data.get("result") == "ok":
                self.logger.info(f"✅ Macro '{script}' accepted by Moonraker")
                return True
            else:
                self.logger.error(f"❌ Macro '{script}' rejected: {data}")
                return False
                
        except requests.exceptions.Timeout:
            # ** EXPECTED BEHAVIOR ** for long-running macros (door opening/closing, etc.)
            # Moonraker doesn't respond until macro completes, so timeout is normal
            # By using 30s timeout, we avoid proxy 504 errors and handle timeouts gracefully
            self.logger.warning(
                f"Timeout sending macro '{script}' - this is expected for long macros (door operations, etc.)"
            )
            self.logger.info("Assuming command was dispatched to Moonraker. Will poll for completion.")
            return True  # Long macros timeout on send but execute successfully
            
        except requests.exceptions.RequestException as e:
            self.logger.error(f"❌ Failed to send macro '{script}': {e}")
            return False
    
    def home(self):
        """Home the OttoEject (convenience method)"""
        return self.execute_macro("OTTOEJECT_HOME")
    
    def park(self):
        """Park the OttoEject (convenience method)"""
        return self.execute_macro("PARK_OTTOEJECT")
    
    def eject_from_printer(self, printer_macro):
        """Eject plate from printer using specified macro"""
        return self.execute_macro(printer_macro)
    
    def store_to_slot(self, slot_number):
        """Store plate to specified rack slot"""
        macro_name = f"STORE_TO_SLOT_{slot_number}"
        return self.execute_macro(macro_name)
    
    def grab_from_slot(self, slot_number):
        """Grab plate from specified rack slot"""
        macro_name = f"GRAB_FROM_SLOT_{slot_number}"
        return self.execute_macro(macro_name)
    
    def load_onto_printer(self, printer_macro):
        """Load plate onto printer using specified macro"""
        return self.execute_macro(printer_macro)
    
    def validate_macro_exists(self, macro_name):
        """
        Validate that a macro exists on the OttoEject
        
        Args:
            macro_name: Name of macro to validate
        
        Returns:
            bool: True if macro exists, False otherwise
        """
        try:
            # Get list of available macros
            url = f"{self.base_url}/printer/objects/query?gcode_macros"
            response = requests.get(url, timeout=self.status_timeout)
            response.raise_for_status()
            
            data = response.json()
            macros = data.get('result', {}).get('status', {}).get('gcode_macros', {})
            
            # Check if macro exists (case insensitive)
            macro_name_lower = macro_name.lower()
            available_macros = [name.lower() for name in macros.keys()]
            
            if macro_name_lower in available_macros:
                self.logger.info(f"✅ Macro '{macro_name}' found on OttoEject")
                return True
            else:
                self.logger.warning(f"⚠️  Macro '{macro_name}' not found on OttoEject")
                self.logger.info(f"Available macros: {list(macros.keys())}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.logger.warning(f"Could not validate macro '{macro_name}': {e}")
            return True  # Assume it exists if we can't check
    
    def get_available_macros(self):
        """Get list of available macros on OttoEject"""
        try:
            url = f"{self.base_url}/printer/objects/query?gcode_macros"
            response = requests.get(url, timeout=self.status_timeout)
            response.raise_for_status()
            
            data = response.json()
            macros = data.get('result', {}).get('status', {}).get('gcode_macros', {})
            
            return list(macros.keys())
            
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Failed to get available macros: {e}")
            return []
    
    def emergency_stop(self):
        """Emergency stop the OttoEject"""
        self.logger.warning("🚨 EMERGENCY STOP activated for OttoEject")
        try:
            url = f"{self.base_url}/printer/emergency_stop"
            response = requests.post(url, timeout=self.status_timeout)
            response.raise_for_status()
            self.logger.info("✅ Emergency stop sent to OttoEject")
            return True
        except requests.exceptions.RequestException as e:
            self.logger.error(f"❌ Failed to send emergency stop: {e}")
            return False
    
    def restart_firmware(self):
        """Restart OttoEject firmware"""
        self.logger.info("Restarting OttoEject firmware...")
        try:
            url = f"{self.base_url}/printer/firmware_restart"
            response = requests.post(url, timeout=self.status_timeout)
            response.raise_for_status()
            
            # Wait for restart
            time.sleep(10)
            
            # Test connection after restart
            if self.test_connection():
                self.logger.info("✅ OttoEject firmware restarted successfully")
                return True
            else:
                self.logger.error("❌ OttoEject not responding after firmware restart")
                return False
                
        except requests.exceptions.RequestException as e:
            self.logger.error(f"❌ Failed to restart firmware: {e}")
            return False
