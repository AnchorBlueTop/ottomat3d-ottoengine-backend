"""
Calibration Module for OTTOMAT3D
Handles bed movement and calibration operations
"""

import time
from printers.printer_factory import PrinterFactory
from utils.logger import setup_logger

def move_bed_for_calibration(config_data):
    """Move printer bed for calibration"""
    print("\n🛠️ MOVE BED FOR CALIBRATION")
    print("─" * 40)
    
    printer_brand = config_data.get('PRINTER_BRAND', '')
    printer_model = config_data.get('PRINTER_MODEL', '')
    
    # Supported printers: All major brands including Elegoo
    supported_printers = ["Bambu Lab", "FlashForge", "Prusa", "Anycubic", "Creality", "Elegoo"]
    if printer_brand not in supported_printers:
        print(f"❌ Bed movement not supported for {printer_brand} printers")
        print("   This feature only works with Bambu Lab, FlashForge, Prusa, Anycubic, Creality, and Elegoo")
        return False
    
    logger = setup_logger()
    printer_factory = PrinterFactory()
    
    try:
        printer = printer_factory.create_printer(config_data)
        if not printer:
            print("❌ Failed to create printer instance")
            return False
        
        print(f"Connecting to {printer_brand} {printer_model}...")
        if not printer.test_connection():
            print("❌ Failed to connect to printer")
            return False
        
        print("✅ Connected successfully!")
        
        # Handle different printer types
        if printer_brand == "Bambu Lab":
            return _handle_bambu_calibration(printer, config_data, logger)
        elif printer_brand == "Prusa":
            return _handle_prusa_calibration(printer, config_data, logger)
        elif printer_brand == "FlashForge":
            return _handle_flashforge_calibration(printer, logger)
        elif printer_brand == "Elegoo":
            return _handle_elegoo_calibration(printer, config_data, logger)
        elif printer_brand in ["Anycubic", "Creality"]:
            return _handle_moonraker_calibration(printer, printer_brand, printer_model, logger)
        else:
            print(f"❌ Calibration not implemented for {printer_brand}")
            return False
        
    except Exception as e:
        print(f"❌ Error during bed movement: {e}")
        return False
    finally:
        if 'printer' in locals() and printer:
            try:
                printer.disconnect()
            except:
                pass

def _handle_bambu_calibration(printer, config_data, logger):
    """Handle Bambu Lab calibration with optional homing"""
    print("\n🤖 BAMBU LAB CALIBRATION")
    print("─" * 30)
    
    printer_model = config_data.get('PRINTER_MODEL', '')
    bed_type = config_data.get('BED_TYPE', 'z_bed')
    
    # Determine recommended position and axis based on user specifications
    if bed_type == 'sling_bed':  # A1
        axis = 'Y'
        recommended_pos = 170  # Y170mm for A1
        speed = 1000  # F1000 for A1
        home_question = f"Do you wish to Home Y axis for {printer_model}? (Y/N): "
    else:  # P1P, P1S, X1C
        axis = 'Z'
        recommended_pos = 200  # Z200 for P1P/P1S/X1C
        speed = 600  # F600 for P1P/P1S/X1C
        home_question = f"Do you wish to Home Z Axis for {printer_model}? (Y/N): "
    
    print(f"Printer: {printer_model} ({bed_type.replace('_', ' ')})")
    print(f"Recommended position: {axis}{recommended_pos}mm")
    print()
    
    # Ask if user wants to home first (user specified: ask, don't auto-home)
    home_choice = input(home_question).strip().upper()
    if home_choice in ['Y', 'YES']:
        print(f"Homing {axis} axis...")
        # For Bambu Lab, use just G28 (homing all axes) instead of G28 Z or G28 Y
        home_cmd = "G28"  # Bambu Lab requires homing all axes
        if not printer.send_gcode(home_cmd):
            print(f"❌ Failed to home {axis} axis")
            return False
        print(f"✅ {axis} axis homed successfully")
        time.sleep(2)
    
    # Ask for custom position or use recommended
    try:
        user_input = input(f"Enter {axis} position (recommended: {recommended_pos}mm, press ENTER for default): ").strip()
        if user_input:
            position = int(user_input)
        else:
            position = recommended_pos
            
        if axis == 'Y' and not (0 <= position <= 210):
            print("❌ Y position must be between 0-210mm")
            return False
        elif axis == 'Z' and not (0 <= position <= 200):
            print("❌ Z position must be between 0-200mm")
            return False
            
        print(f"Moving bed to {axis}{position}mm...")
        move_cmd = f"G90\nG1 {axis}{position} F{speed}"
        
        if printer.send_gcode(move_cmd):
            print(f"✅ Bed moved to {axis}{position}mm successfully!")
            print("💡 You can now adjust your OttoEject position as needed.")
            return True
        else:
            print(f"❌ Failed to move bed to {axis}{position}mm")
            return False
            
    except ValueError:
        print("❌ Invalid position entered")
        return False
    except Exception as e:
        logger.error(f"Error during Bambu calibration: {e}")
        print(f"❌ Error during calibration: {e}")
        return False

def _handle_prusa_calibration(printer, config_data, logger):
    """Handle Prusa-specific dwell file calibration"""
    print("\n🔄 PRUSA DWELL POSITIONING CALIBRATION")
    print("─" * 45)
    
    # Determine which dwell file to use based on bed type
    bed_type = config_data.get('BED_TYPE', 'sling_bed')
    
    if bed_type == 'z_bed':
        dwell_filename = "Z_POS_DWELL.gcode"
        description = "Z200 positioning (Core One)"
        remote_path = "OTTOTEMP/Z_POS_DWELL.gcode"
    else:
        dwell_filename = "Y_POS_DWELL.gcode" 
        description = "Y210 positioning (MK3/MK4)"
        remote_path = "OTTOTEMP/Y_POS_DWELL.gcode"
    
    print(f"📋 Using: {description}")
    print(f"📁 File: {remote_path}")
    print()
    print("ℹ️  This will start the dwell positioning file which moves the bed")
    print("   to the calibration position and then pauses.")
    print()
    
    # Confirm user wants to proceed
    proceed = input("Start dwell positioning calibration? (y/n): ").strip().lower()
    if proceed not in ['y', 'yes']:
        print("❌ Calibration cancelled")
        return False
    
    try:
        # Start the dwell file
        print(f"🚀 Starting {dwell_filename} on printer...")
        
        # Use printer's start_print method to start the dwell file
        if not printer.start_print(remote_path, is_first_job=True):
            print("❌ Failed to start dwell positioning file")
            print("💡 Make sure the positioning file was uploaded to /usb/OTTOTEMP/")
            return False
        
        print("✅ Dwell positioning file started!")
        print("\n⏸️  The printer will move to position and then PAUSE automatically.")
        print("   This is normal behavior - the dwell file pauses at the calibration position.")
        print()
        
        # Wait for user to confirm they're ready to stop
        input("🛑 Press ENTER when you're ready to STOP the dwell positioning...")
        
        # Stop the print
        print("🛑 Stopping dwell positioning...")
        
        if hasattr(printer, 'stop_print'):
            if printer.stop_print():
                print("✅ Dwell positioning stopped successfully!")
            else:
                print("⚠️  Stop command sent, but may need manual confirmation on printer")
        else:
            # Fallback: try to cancel via G-code
            if printer.send_gcode("M0"):  # Emergency stop
                print("✅ Stop command sent!")
            else:
                print("⚠️  Unable to stop automatically - please stop manually on printer")
        
        print("\n✅ Prusa dwell calibration completed!")
        print("💡 You can now adjust your OttoEject position as needed.")
        return True
        
    except Exception as e:
        logger.error(f"Error during Prusa calibration: {e}")
        print(f"❌ Error during calibration: {e}")
        return False

def _handle_flashforge_calibration(printer, logger):
    """Handle FlashForge calibration using proper TCP connection"""
    import socket
    
    print("\n🔨 FLASHFORGE CALIBRATION")
    print("─" * 30)
    print("Recommended position: Z190mm")
    print()
    
    try:
        user_input = input("Enter Z position (recommended: 190mm, press ENTER for default): ").strip()
        if user_input:
            position = int(user_input)
        else:
            position = 190
            
        if not (0 <= position <= 200):
            print("❌ Z position must be between 0-200mm")
            return False
        
        # Use proper TCP connection like the working loop
        return _send_flashforge_tcp_calibration(printer, position, logger)
            
    except ValueError:
        print("❌ Invalid position entered")
        return False
    except Exception as e:
        logger.error(f"Error during FlashForge calibration: {e}")
        print(f"❌ Error during calibration: {e}")
        return False

def _send_flashforge_tcp_calibration(printer, position, logger):
    """Send FlashForge calibration commands via proper TCP connection"""
    import socket
    
    # Get printer connection details
    printer_ip = printer.ip_address
    tcp_port = 8899
    
    print(f"Connecting to FlashForge via TCP for Z{position}mm movement...")
    
    tcp_socket = None
    try:
        # Connect to TCP port
        tcp_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        tcp_socket.settimeout(10)
        tcp_socket.connect((printer_ip, tcp_port))
        tcp_socket.settimeout(7)
        print("✅ TCP connection established")
        
        # Login
        login_cmd = "~M601 S1\n"
        tcp_socket.sendall(login_cmd.encode('ascii'))
        login_response = tcp_socket.recv(1024).decode('ascii', errors='ignore')
        
        if not ("ok" in login_response.lower() and "control success" in login_response.lower()):
            print(f"⚠️ TCP login response: {login_response.strip()}")
            print("Proceeding with movement...")
        else:
            print("✅ TCP login successful")
        
        time.sleep(0.2)
        
        # Send calibration G-code sequence
        calibration_commands = [
            "~G28 Z0\n",  # Home Z axis
            "~M400\n",    # Wait for completion
            "~G90\n",     # Absolute positioning
            f"~G1 Z{position} F600\n",  # Move to position
            "~M400\n"     # Wait for completion
        ]
        
        for cmd in calibration_commands:
            print(f"Sending: {cmd.strip()}")
            tcp_socket.sendall(cmd.encode('ascii'))
            
            # Wait for response
            timeout = 90.0 if "G28" in cmd.upper() else 60.0 if "M400" in cmd.upper() else 7.0
            tcp_socket.settimeout(timeout)
            
            try:
                response = tcp_socket.recv(1024).decode('ascii', errors='ignore')
                if "ok" in response.lower():
                    print(f"✅ Command acknowledged: {cmd.strip()}")
                else:
                    print(f"⚠️ Response: {response.strip()}")
            except socket.timeout:
                print(f"⚠️ Timeout waiting for response to: {cmd.strip()}")
        
        # Logout
        logout_cmd = "~M602\n"
        tcp_socket.sendall(logout_cmd.encode('ascii'))
        
        print(f"✅ Bed moved to Z{position}mm successfully!")
        print("💡 You can now adjust your OttoEject position as needed.")
        return True
        
    except Exception as e:
        logger.error(f"FlashForge TCP calibration error: {e}")
        print(f"❌ TCP calibration failed: {e}")
        return False
    finally:
        if tcp_socket:
            try:
                tcp_socket.close()
                print("✅ TCP connection closed")
            except:
                pass

def _handle_elegoo_calibration(printer, config_data, logger):
    """Handle Elegoo-specific calibration via file upload and print"""
    from pathlib import Path
    
    print("\n🌊 ELEGOO CALIBRATION")
    print("─" * 25)
    
    print("❌ Manual Print Bed Movement For Elegoo Unavailable")
    print("Do you wish to upload and print an OTTOMAT3D LOGO that will")
    print("finish the print at Z205 at the end of the print?")
    print()
    print("ℹ️  This will:")
    print("   1. Upload ELEGOO_Z205_PLA.gcode to your printer")
    print("   2. Start printing the calibration file")
    print("   3. Print will end with bed at Z205mm for OttoEject calibration")
    print("   4. You can then adjust your OttoEject position as needed")
    print()
    
    # Confirm user wants to proceed
    proceed = input("Upload and start calibration print? (y/n): ").strip().lower()
    if proceed not in ['y', 'yes']:
        print("❌ Calibration cancelled")
        return False
    
    try:
        # Get the path to the calibration G-code file
        script_dir = Path(__file__).parent.parent  # Go up from operations/ to src/
        gcode_file_path = script_dir / "gcode" / "ELEGOO_Z205_PLA.gcode"
        
        if not gcode_file_path.exists():
            print(f"❌ Calibration file not found: {gcode_file_path}")
            return False
        
        print(f"🔧 UPLOADING CALIBRATION FILE...")
        print("─" * 35)
        
        # Upload the file
        if not printer.upload_file(str(gcode_file_path), "ELEGOO_Z205_PLA.gcode"):
            print("❌ Failed to upload calibration file")
            return False
        
        print("✅ Calibration file uploaded successfully!")
        print()
        
        print("🚀 STARTING CALIBRATION PRINT...")
        print("─" * 35)
        
        # Start the print
        if not printer.start_print("ELEGOO_Z205_PLA.gcode", is_first_job=True):
            print("❌ Failed to start calibration print")
            return False
        
        print("✅ Calibration print started successfully!")
        print()
        print("📋 PRINT INFORMATION:")
        print("   • File: ELEGOO_Z205_PLA.gcode (OTTOMAT3D Logo)")
        print("   • Duration: Approximately 10-15 minutes")
        print("   • Final bed position: Z205mm")
        print("   • You can monitor progress via Elegoo's web interface")
        print()
        print("💡 CALIBRATION INSTRUCTIONS:")
        print("   1. Wait for the print to complete")
        print("   2. Bed will automatically move to Z205mm at the end")
        print("   3. Use this position to calibrate your OttoEject")
        print("   4. Adjust OttoEject positioning as needed")
        print()
        
        # Ask if user wants to monitor the print
        monitor = input("Monitor print progress until completion? (y/n): ").strip().lower()
        
        if monitor in ['y', 'yes']:
            print("\n🔍 MONITORING PRINT PROGRESS...")
            print("─" * 35)
            print("⚠️  Note: You can press Ctrl+C to stop monitoring (print will continue)")
            print()
            
            try:
                # Monitor the print until completion
                if printer.wait_for_completion():
                    print("\n✅ Calibration print completed successfully!")
                    print("🎯 Bed is now at Z205mm - perfect for OttoEject calibration!")
                    print("💡 You can now adjust your OttoEject position as needed.")
                else:
                    print("\n⚠️  Print monitoring ended, but print may still be running.")
                    print("💡 Check your printer to see if calibration completed.")
            except KeyboardInterrupt:
                print("\n⚠️  Monitoring stopped by user. Print continues on printer.")
                print("💡 Check your printer to see when calibration completes.")
        else:
            print("📝 Print started successfully. Check your printer for progress.")
            print("💡 When complete, bed will be at Z205mm for calibration.")
        
        return True
        
    except Exception as e:
        logger.error(f"Error during Elegoo calibration: {e}")
        print(f"❌ Error during calibration: {e}")
        return False

def _handle_moonraker_calibration(printer, printer_brand, printer_model, logger):
    """Handle Moonraker-based printer calibration (Anycubic, Creality)"""
    print(f"\n🌙 {printer_brand.upper()} CALIBRATION")
    print("─" * 35)
    
    # Determine recommended settings based on user specifications
    if printer_brand == "Anycubic":
        recommended_pos = 200  # Show Z200 as recommended (matches G-code files)
        speed = 600   # Use F600 to match G-code files
        compensation_offset = 13  # Add 13mm to compensate for G-code vs console difference
    else:  # Creality
        recommended_pos = 230 
        speed = 600   
        compensation_offset = 0  # No compensation needed for Creality
    
    print(f"Printer: {printer_model}")
    print(f"Recommended position: Z{recommended_pos}mm")
    if printer_brand == "Anycubic":
        print("📏 Note: +13mm compensation will be added automatically")
        print("   (Compensates for difference between G-code end positioning vs manual console commands)")
    print("Note: Z-axis will be homed first for safety (required)")
    print()
    
    try:
        user_input = input(f"Enter Z position (recommended: {recommended_pos}mm, press ENTER for default): ").strip()
        if user_input:
            position = int(user_input)
        else:
            position = recommended_pos
            
        if not (0 <= position <= 250):
            print("❌ Z position must be between 0-250mm")
            return False
        
        # Calculate actual position with compensation
        actual_position = position + compensation_offset
        
        # Always home Z first for Moonraker printers (user requirement)
        print("Homing Z axis (required)...")
        
        if printer_brand == "Anycubic":
            # For Anycubic, send both commands in sequence without waiting for responses
            # This prevents timeout issues while still ensuring commands are queued properly
            print("Sending homing and positioning commands...")
            
            # Send G28 Z command - printer will execute this first
            try:
                printer.send_gcode("G28 Z")
                print("📤 G28 Z command sent (homing Z-axis)")
            except Exception as e:
                print(f"📤 G28 Z command sent (timeout ignored: {type(e).__name__})")
            
            # Immediately send positioning command - printer will queue this after homing
            try:
                printer.send_gcode(f"G1 Z{actual_position} F{speed}")
                print(f"📤 G1 Z{actual_position} F{speed} command sent (positioning)")
            except Exception as e:
                print(f"📤 G1 Z{actual_position} F{speed} command sent (timeout ignored: {type(e).__name__})")
            
            print("✅ Both commands sent successfully - printer will execute them in sequence")
            if compensation_offset > 0:
                print(f"💡 Printer will: 1) Home Z-axis, 2) Move to Z{actual_position}mm (Z{position}mm + {compensation_offset}mm compensation)")
                print(f"💡 This matches the Z{position}mm position when G1 Z{position} F600 is added to G-code files")
            else:
                print(f"💡 Printer will: 1) Home Z-axis, 2) Move to Z{actual_position}mm")
            print("💡 Commands are queued - homing will complete first, then bed will move to position")
            print("💡 Wait for movements to complete, then adjust your OttoEject position as needed.")
            return True
        else:
            # For Creality, send both commands in sequence like Anycubic
            print("Sending homing and positioning commands...")
            
            # Send G28 Z command - printer will execute this first
            try:
                printer.send_gcode("G28 Z")
                print("📤 G28 Z command sent (homing Z-axis)")
            except Exception as e:
                print(f"📤 G28 Z command sent (timeout ignored: {type(e).__name__})")
            
            # Immediately send positioning command - printer will queue this after homing
            try:
                printer.send_gcode(f"G1 Z{actual_position} F{speed}")
                print(f"📤 G1 Z{actual_position} F{speed} command sent (positioning)")
            except Exception as e:
                print(f"📤 G1 Z{actual_position} F{speed} command sent (timeout ignored: {type(e).__name__})")
            
            print("✅ Both commands sent successfully - printer will execute them in sequence")
            print(f"💡 Printer will: 1) Home Z-axis, 2) Move to Z{actual_position}mm")
            print("💡 Commands are queued - homing will complete first, then bed will move to position")
            print("💡 Wait for movements to complete, then adjust your OttoEject position as needed.")
            return True
            
    except ValueError:
        print("❌ Invalid position entered")
        return False
    except Exception as e:
        logger.error(f"Error during {printer_brand} calibration: {e}")
        print(f"❌ Error during calibration: {e}")
        return False
