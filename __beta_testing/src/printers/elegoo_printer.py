"""
Elegoo Printer Implementation for OTTOMAT3D Master Script
Handles communication with Elegoo printers via WebSocket
"""

import asyncio
import websockets
import json
import time
import uuid
import socket
from printers.printer_factory import BasePrinter, PrinterStatusTracker, calculate_poll_interval, is_completion_state, is_error_state

class ElegooPrinter(BasePrinter):
    """Elegoo printer implementation using WebSocket"""
    
    def __init__(self, config_data):
        """Initialize Elegoo printer"""
        super().__init__(config_data)
        
        # Elegoo configuration
        self.printer_model = config_data.get('PRINTER_MODEL', 'Unknown')
        
        # Elegoo WebSocket settings
        self.websocket_url = f"ws://{self.ip_address}:3030/websocket"
        self.polling_interval_seconds = 10
        
        # Z position for ejection (handled by machine end G-code)
        self.z_position_for_ejection = 205
        
        self.status_tracker = PrinterStatusTracker()
        
        self.logger.info(f"Initialized Elegoo {self.printer_model} printer: {self.ip_address}")
    
    def test_connection(self):
        """Test WebSocket connection to Elegoo printer"""
        print(f"⚠️  IMPORTANT: PLEASE CLOSE ANY INSTANCE OF http://{self.ip_address} ON YOUR BROWSER")
        print("   Browser connections can interfere with WebSocket communication.")
        print()
        
        self.logger.info(f"Testing connection to Elegoo printer at {self.ip_address}...")
        
        async def test_async():
            try:
                async with websockets.connect(
                    self.websocket_url,
                    open_timeout=10,
                    ping_interval=20,
                    ping_timeout=20
                ) as websocket:
                    
                    self.logger.info("✅ Elegoo WebSocket connection established")
                    
                    # Send test status command (same as working script)
                    request_id = str(uuid.uuid4())
                    status_command = {
                        "Id": str(uuid.uuid4()),
                        "Data": {
                            "Cmd": 0,
                            "Data": {},
                            "RequestID": request_id,
                            "MainboardID": "",
                            "TimeStamp": int(time.time() * 1000),
                            "From": 1
                        }
                    }
                    
                    await websocket.send(json.dumps(status_command))
                    
                    # Wait for response - accept any response with Status field
                    try:
                        # Give more time for response and check multiple messages
                        for attempt in range(5):  # Increased attempts
                            message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                            data = json.loads(message)
                            
                            # Check for any response with Status field (more lenient)
                            if "Status" in data:
                                self.logger.info("✅ Successfully connected to Elegoo printer")
                                return True
                            elif "Data" in data or "result" in data:
                                # Got some valid response, consider connected
                                self.logger.info("✅ Successfully connected to Elegoo printer (got response)")
                                return True
                            
                        # If we get here, no proper status received
                        self.logger.error("❌ Invalid response from Elegoo printer")
                        return False
                            
                    except asyncio.TimeoutError:
                        self.logger.error("❌ No response from Elegoo printer")
                        return False
                    
            except Exception as e:
                self.logger.error(f"❌ Failed to connect to Elegoo printer: {e}")
                return False
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            return loop.run_until_complete(test_async())
        except Exception as e:
            self.logger.error(f"❌ Elegoo connection test failed: {e}")
            return False
        finally:
            try:
                loop.close()
            except Exception:
                pass
    
    def get_status(self):
        """Get Elegoo printer status via WebSocket"""
        async def get_status_async():
            try:
                async with websockets.connect(
                    self.websocket_url,
                    open_timeout=10,
                    close_timeout=5,
                    ping_interval=20,
                    ping_timeout=20
                ) as websocket:
                    
                    # Send status request
                    request_id = str(uuid.uuid4())
                    status_command = {
                        "Id": str(uuid.uuid4()),
                        "Data": {
                            "Cmd": 0,
                            "Data": {},
                            "RequestID": request_id,
                            "MainboardID": "",
                            "TimeStamp": int(time.time() * 1000),
                            "From": 1
                        }
                    }
                    
                    await websocket.send(json.dumps(status_command))
                    
                    # Wait for status response
                    message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    data = json.loads(message)
                    
                    if "Status" in data:
                        status_obj = data["Status"]
                        
                        # Extract status information
                        current_status = status_obj.get('CurrentStatus', [None])[0]
                        nozzle_temp = status_obj.get('TempOfNozzle', 0)
                        bed_temp = status_obj.get('TempOfHotbed', 0)
                        print_info = status_obj.get("PrintInfo", {})
                        print_status = print_info.get('Status', 0)
                        filename = print_info.get('Filename', 'N/A')
                        progress = print_info.get('Progress', 0)
                        current_layer = print_info.get('CurrentLayer', 0)
                        total_layers = print_info.get('TotalLayer', 0)
                        
                        # Map Elegoo status codes to readable names
                        status_names = {
                            1: "PRINTING",
                            9: "FINISHED",
                            2: "PAUSED",
                            3: "ERROR",
                            10: "STOPPED"
                        }
                        status_name = status_names.get(print_status, f"STATUS_{print_status}")
                        
                        return {
                            'status': status_name,
                            'status_code': print_status,
                            'progress_percent': progress,
                            'current_file': filename,
                            'nozzle_temperature': nozzle_temp,
                            'bed_temperature': bed_temp,
                            'current_layer': current_layer,
                            'total_layers': total_layers,
                            'raw_data': status_obj
                        }
                    else:
                        return None
                        
            except Exception as e:
                self.logger.warning(f"Failed to get Elegoo status: {e}")
                return None
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            return loop.run_until_complete(get_status_async())
        except Exception as e:
            self.logger.warning(f"Elegoo status error: {e}")
            return None
        finally:
            try:
                loop.close()
            except Exception:
                pass
    
    def start_print(self, filename, is_first_job=False):
        """Start print on Elegoo printer via WebSocket"""
        print(f"⚠️  IMPORTANT: PLEASE CLOSE ANY INSTANCE OF http://{self.ip_address} ON YOUR BROWSER")
        print("   Browser connections can interfere with WebSocket communication.")
        print()
        
        self.logger.info(f"Starting print: {filename}")
        
        async def start_print_async():
            try:
                async with websockets.connect(
                    self.websocket_url,
                    open_timeout=10,
                    ping_interval=20,
                    ping_timeout=20
                ) as websocket:
                    
                    request_id = str(uuid.uuid4())
                    start_print_payload = {
                        "Id": str(uuid.uuid4()),
                        "Data": {
                            "Cmd": 128,
                            "Data": {
                                "Filename": f"/local/{filename}",
                                "StartLayer": 0,
                                "Calibration_switch": "1",  # Enable calibration like working script
                                "PrintPlatformType": "0",
                                "Tlp_Switch": "0"
                            },
                            "RequestID": request_id,
                            "MainboardID": "",
                            "TimeStamp": int(time.time() * 1000),
                            "From": 1
                        }
                    }
                    
                    self.logger.info(f"Sending start print command for '{filename}'...")
                    await websocket.send(json.dumps(start_print_payload))
                    
                    self.logger.info("✅ Print command sent to Elegoo printer")
                    return True
                    
            except Exception as e:
                self.logger.error(f"❌ Failed to start Elegoo print: {e}")
                return False
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            return loop.run_until_complete(start_print_async())
        except Exception as e:
            self.logger.error(f"❌ Elegoo start print error: {e}")
            return False
        finally:
            try:
                loop.close()
            except Exception:
                pass
    
    def wait_for_completion(self):
        """Wait for Elegoo print completion"""
        self.logger.info("Monitoring print for completion...")
        
        async def wait_async():
            time.sleep(15)  # Initial delay
            
            while True:
                try:
                    async with websockets.connect(
                        self.websocket_url,
                        open_timeout=10,
                        ping_interval=20,
                        ping_timeout=20
                    ) as websocket:
                        
                        last_poll_time = 0
                        
                        while True:
                            # Send periodic status requests
                            if time.time() - last_poll_time >= self.polling_interval_seconds:
                                status_req_id = str(uuid.uuid4())
                                status_req_payload = {
                                    "Id": str(uuid.uuid4()),
                                    "Data": {
                                        "Cmd": 0,
                                        "Data": {},
                                        "RequestID": status_req_id,
                                        "MainboardID": "",
                                        "TimeStamp": int(time.time() * 1000),
                                        "From": 1
                                    }
                                }
                                await websocket.send(json.dumps(status_req_payload))
                                last_poll_time = time.time()
                            
                            try:
                                message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                                data = json.loads(message)
                                
                                if "Status" in data and "sdcp/status" in data.get("Topic", ""):
                                    status_obj = data["Status"]
                                    print_info = status_obj.get("PrintInfo", {})
                                    print_status = print_info.get("Status")
                                    progress = print_info.get("Progress", 0)
                                    filename = print_info.get("Filename", "N/A")
                                    
                                    self.logger.info(f"Elegoo Print Status: {print_status} | Progress: {progress}% | File: {filename}")
                                    
                                    if print_status == 9:  # Finished
                                        self.logger.info("✅ Elegoo print completed")
                                        return True
                                    if print_status in [2, 3, 10]:  # Error states
                                        self.logger.error(f"❌ Elegoo print failed with status {print_status}")
                                        return False
                                        
                            except asyncio.TimeoutError:
                                continue
                            except json.JSONDecodeError:
                                continue
                            
                except websockets.exceptions.ConnectionClosed:
                    self.logger.info("Elegoo WebSocket closed, reconnecting...")
                    await asyncio.sleep(5)
                    continue
                except Exception as e:
                    self.logger.error(f"Elegoo monitoring error: {e}")
                    await asyncio.sleep(5)
                    continue
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            return loop.run_until_complete(wait_async())
        except Exception as e:
            self.logger.error(f"❌ Elegoo wait error: {e}")
            return False
        finally:
            try:
                loop.close()
            except Exception:
                pass
    
    def needs_bed_positioning(self):
        """Elegoo printers don't need bed positioning if G1 Z150 is in end G-code"""
        return False
    
    def position_bed_for_ejection(self):
        """Bed positioning should be handled by machine end G-code"""
        self.logger.info("Bed positioning handled by machine end G-code (G1 Z205)")
        return True
    
    def send_gcode(self, gcode_command):
        """G-code commands not supported via WebSocket for Elegoo"""
        self.logger.warning("Direct G-code not supported for Elegoo printers via WebSocket")
        return False
    
    def pause_print(self):
        """Pause print functionality not implemented for Elegoo WebSocket"""
        self.logger.warning("Pause print not implemented for Elegoo WebSocket interface")
        return False
    
    def resume_print(self):
        """Resume print functionality not implemented for Elegoo WebSocket"""
        self.logger.warning("Resume print not implemented for Elegoo WebSocket interface")
        return False
    
    def stop_print(self):
        """Stop print functionality not implemented for Elegoo WebSocket"""
        self.logger.warning("Stop print not implemented for Elegoo WebSocket interface")
        return False
    
    def get_printer_info(self):
        """Get printer information"""
        return {
            'brand': 'Elegoo',
            'model': self.printer_model,
            'ip_address': self.ip_address,
            'connection_type': 'WebSocket'
        }
    
    def upload_file(self, local_file_path, filename):
        """Upload a file to Elegoo printer via HTTP API"""
        import requests
        import hashlib
        import os
        from pathlib import Path
        
        self.logger.info(f"Uploading file {filename} to Elegoo printer...")
        
        try:
            # Read the file
            file_path = Path(local_file_path)
            if not file_path.exists():
                self.logger.error(f"File not found: {local_file_path}")
                return False
            
            with open(file_path, 'rb') as f:
                file_content = f.read()
            
            file_size = len(file_content)
            
            # Calculate MD5 hash
            md5_hash = hashlib.md5(file_content).hexdigest()
            
            # Generate UUID for upload
            import uuid
            upload_uuid = str(uuid.uuid4()).replace('-', '')
            
            # Prepare multipart form data
            boundary = f"----webkitformboundary{upload_uuid}"
            
            # Build multipart body
            body_parts = []
            
            # Add form fields
            fields = {
                'TotalSize': str(file_size),
                'Uuid': upload_uuid,
                'Offset': '0',
                'Check': '1',
                'S-File-MD5': md5_hash
            }
            
            for field_name, field_value in fields.items():
                body_parts.append(f'--{boundary}')
                body_parts.append(f'Content-Disposition: form-data; name="{field_name}"')
                body_parts.append('')
                body_parts.append(field_value)
            
            # Add file
            body_parts.append(f'--{boundary}')
            body_parts.append(f'Content-Disposition: form-data; name="File"; filename="{filename}"')
            body_parts.append('Content-Type: application/octet-stream')
            body_parts.append('')
            
            # Join text parts
            body_text = '\r\n'.join(body_parts) + '\r\n'
            
            # Create final body with file content
            body = body_text.encode('utf-8') + file_content + f'\r\n--{boundary}--\r\n'.encode('utf-8')
            
            # Upload the file
            upload_url = f"http://{self.ip_address}/uploadFile/upload"
            headers = {
                'Content-Type': f'multipart/form-data; boundary={boundary}'
            }
            
            self.logger.info(f"Uploading to {upload_url}...")
            response = requests.post(upload_url, data=body, headers=headers, timeout=30)
            
            if response.status_code == 200:
                self.logger.info(f"✅ File '{filename}' uploaded successfully")
                return True
            else:
                self.logger.error(f"❌ Upload failed: HTTP {response.status_code}")
                self.logger.error(f"Response: {response.text}")
                return False
                
        except Exception as e:
            self.logger.error(f"❌ Error uploading file: {e}")
            return False
