"""
UI Display Module for OTTOMAT3D
Handles all user interface elements, ASCII art, and menu displays
"""

import os

# ASCII Art Logo
OTTOMAT3D_LOGO = """

 ████   ▓▓▓     
███▓▓▓▓ ▓▓▓    
███▓▓   █▓▓     ████╗  ██████╗███████╗ █████╗ ██╗     ██╗ ████╗ ██████╗█████╗  █████╗  
███▓▓   ██▓▓   ██╔══██╗╚═██╔═╝╚═██╔═╝ ██╔══██╗███╗   ███║██╔═██╗╚═██╔═╝╚═══██╗ ██╔═ ██╗  
███▓▓   ██▓▓   ██║  ██║  ██║    ██║   ██║  ██║██╔████╔██║██████║  ██║  ████╔╝  ██║   ██║  
███▓▓   ██▓▓   ██║  ██║  ██║    ██║   ██║  ██║██║╚██╔╝██║██╔═██║  ██║  ╚══ ██╗ ██║   ██║       
███▓▓   ██▓▓   ╚█████╔╝  ██║    ██║   ╚█████╔╝██║ ╚═╝ ██║██║ ██║  ██║  █████╔╝ ██████╔╝        
██████████▓▓    ╚════╝   ╚═╝    ╚═╝    ╚════╝ ╚═╝     ╚═╝╚═╝ ╚═╝  ╚═╝  ╚════╝  ╚════╝                                                                                                                                            
 ████████▓▓

"""

VERSION = "1.0.0"
COPYRIGHT_NOTICE = """                     © 2025 OTTOMAT3D Team. All Rights Reserved.
             Proprietary Software - Unauthorized Distribution Prohibited
                          For Authorized Beta Testers Only"""

def display_welcome(show_scroll_message=False):
    """Display welcome screen"""
    os.system('cls' if os.name == 'nt' else 'clear')
    print(OTTOMAT3D_LOGO)
    print(f"════════════════════════════════════════════════════════════════════════════════════════")
    print(f"                    OTTOMAT3D MASTER AUTOMATION SCRIPT v{VERSION}")
    print(f"                           Multi-Printer Automation Suite")
    print(f"════════════════════════════════════════════════════════════════════════════════════════")
    print(COPYRIGHT_NOTICE)
    print(f"════════════════════════════════════════════════════════════════════════════════════════")
    
    if show_scroll_message:
        print("                     (scroll up to see previous commands)")
    
    print()

def display_main_menu(existing_config):
    """Display the main menu with all options"""
    print("OTTOMAT3D AUTOMATION OPTIONS:")
    print("─" * 50)
    print("1. Setup a New Printer")
    print("2. Select a Different Printer")
    print("3. Start New Print Jobs")
    print("4. Start Last Print Jobs (Same Printer + Same Print Jobs)")
    print("5. Modify Existing Printer Details (IP, Serial Number, Etc...)")
    print("6. Change OttoEject IP Address")
    print("7. Test OttoEject Connection")
    print("8. Test Printer Connection")
    print("9. Move Print Bed for Calibration")
    print()
    
    if existing_config:
        print("CURRENT CONFIGURATION:")
        print("─" * 30)
        print(f"Printer: {existing_config.get('PRINTER_BRAND')} {existing_config.get('PRINTER_MODEL', '')}")
        print(f"Printer IP: {existing_config.get('PRINTER_IP')}")
        print(f"OttoEject IP: {existing_config.get('OTTOEJECT_IP')}")
        print(f"Total Jobs: {existing_config.get('TOTAL_JOBS', 0)}")
        print()

def get_menu_choice(has_existing_config):
    """Get and validate menu choice from user"""
    while True:
        choice = input("Select option (1-9): ").strip()
        if choice in ['1', '2', '3', '4', '5', '6', '7', '8', '9']:
            return choice
        print("❌ Invalid selection. Please choose 1-9.")

def display_supported_printers():
    """Display supported printer brands for selection"""
    # THIS DICTIONARY IS NOW CORRECTED AND COMPLETE
    printers = {
        "1": {
            "name": "Bambu Lab", 
            "class": "BambuLabPrinter", 
            "requirements": "LAN MODE + DEVELOPER MODE ENABLED",
            "model": "P1P/P1S/X1C (Z-bed) or A1 (Sling bed)",
            "type": "auto_detect",
            "positioning": "Z200 or Y170"
        },
        "2": {
            "name": "Prusa", 
            "class": "PrusaPrinter", 
            "requirements": "PRUSALINK ENABLED",
            "model": "MK3/MK4/Core One",
            "type": "auto_detect", 
            "positioning": "Y210/Z200"
        },
        "3": {
            "name": "FlashForge", 
            "class": "FlashForgePrinter", 
            "requirements": "LAN MODE ENABLED",
            "model": "AD5X/5M Pro",
            "type": "z_bed", 
            "positioning": "Z170"
        },
        "4": {
            "name": "Creality", 
            "class": "CrealityPrinter", 
            "requirements": "PRINTER MUST BE ROOTED",
            "model": "K1/K1C",
            "type": "z_bed", 
            "positioning": "Z200"
        },
        "5": {
            "name": "Elegoo", 
            "class": "ElegooPrinter", 
            "requirements": "",
            "model": "Centauri Carbon",
            "type": "z_bed", 
            "positioning": "ENSURE G1 Z150 at the end of your gcode file"
        },
        "6": {
            "name": "Anycubic", 
            "class": "AnycubicPrinter", 
            "requirements": "RINKHALS CUSTOM FIRMWARE REQUIRED",
            "model": "Kobra S1",
            "type": "z_bed", 
            "positioning": "Z200"
        }
    }
    
    print("SUPPORTED PRINTER BRANDS:")
    print("─" * 50)
    for key, printer in printers.items():
        print(f"{key}. {printer['name']}")
    print()
    
    return printers

def get_printer_choice():
    """Get printer selection from user"""
    printers = display_supported_printers()
    
    while True:
        choice = input("SELECT PRINTER BRAND (1-6): ").strip()
        if choice in printers:
            return printers[choice]
        print("❌ Invalid selection. Please choose 1-6.")

def display_automation_header():
    """Display automation sequence header"""
    print("\n" + "═" * 80)
    print("🚀 STARTING AUTOMATION SEQUENCE")
    print("═" * 80)

def display_automation_footer_enhanced(completed_jobs, total_jobs, config_data, was_interrupted=False):
    """Enhanced automation footer with detailed completion summary"""
    import time
    from datetime import datetime
    
    # Status determination
    if was_interrupted:
        status = "STOPPED"
        queue_status = "Emergency stopped"
    elif completed_jobs == total_jobs:
        status = "COMPLETED"
        queue_status = "Print queue completed"
    else:
        status = "SUSPENDED"
        queue_status = "Print queue suspended"
    
    # Get printer and config info
    printer_brand = config_data.get('PRINTER_BRAND', 'Unknown')
    printer_model = config_data.get('PRINTER_MODEL', '')
    printer_name = f"{printer_brand} {printer_model}".strip()
    ottoeject_ip = config_data.get('OTTOEJECT_IP', 'Unknown')
    
    # Get files printed
    files_printed = []
    printed_file = "None"
    store_location = "N/A"
    
    if completed_jobs > 0:
        for job_num in range(1, completed_jobs + 1):
            filename = config_data.get(f'JOB_{job_num}_FILENAME', f'Job_{job_num}')
            files_printed.append(filename)
            # Last completed file details
            if job_num == completed_jobs:
                printed_file = filename
                store_location = f"Slot {config_data.get(f'JOB_{job_num}_STORE_SLOT', 'Unknown')}"
    
    files_list = ", ".join(files_printed) if files_printed else "None"
    
    # Create log filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_filename = f"ottomat3d_session_{timestamp}.log"
    
    print(f"\nAutomation {status.lower()}. {completed_jobs}/{total_jobs} jobs successful.")
    print("\n" + "═" * 80)
    print(f"🏁 AUTOMATION {status}")
    print("═" * 80)
    print()
    print("📊 SESSION SUMMARY:")
    print("─" * 40)
    print(f"{queue_status}")
    print(f"Printer: {printer_name}")
    print(f"Ottoeject IP: {ottoeject_ip}")
    print(f"Files printed: {files_list}")
    print(f"Last printed file: {printed_file}")
    print(f"Store location: {store_location}")
    print()
    
    # Only ask for success confirmation if jobs were completed
    if completed_jobs > 0 and status == "COMPLETED":
        while True:
            success_input = input("Was the print job successful? (y/n): ").strip().lower()
            if success_input in ['y', 'yes']:
                print("✅ Print job marked as successful!")
                break
            elif success_input in ['n', 'no']:
                print("❌ Print job marked as failed.")
                break
            else:
                print("Please enter 'Yes' or 'No'")
    
    print()
    print(f"Thank you. Log saved: {log_filename}")
    print()
    
    try:
        input("Press any key to exit...")
    except (KeyboardInterrupt, EOFError, TimeoutError) as e:
        print(f"Input interrupted ({type(e).__name__}), exiting gracefully...")
    except Exception as input_error:
        print(f"Input error (ignoring): {input_error}")

def display_automation_footer(completed_jobs, total_jobs):
    """Original simple automation footer (kept for compatibility)"""
    print(f"\nAutomation completed. {completed_jobs}/{total_jobs} jobs successful.")
    print("\n" + "═" * 80)
    print("🏁 AUTOMATION FINISHED")
    print("═" * 80)
    
    try:
        input("Press ENTER to exit...")
    except (KeyboardInterrupt, EOFError, TimeoutError) as e:
        print(f"Input interrupted ({type(e).__name__}), exiting gracefully...")
    except Exception as input_error:
        print(f"Input error (ignoring): {input_error}")
