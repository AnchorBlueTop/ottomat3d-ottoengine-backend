"""
OTTOMAT3D Master Script - Main Entry Point
Unified automation script for multiple 3D printer brands
Refactored for better maintainability and modularity
"""

import sys
from pathlib import Path

# Add internal modules to path
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

# Import all modules
from config.config_manager import ConfigManager
from ui import (
    display_welcome, 
    display_main_menu, 
    get_menu_choice,
    get_printer_choice,
    display_automation_header,
    display_automation_footer
)
from setup import (
    get_supported_printers,
    setup_printer_connection,
    setup_ottoeject_config,
    setup_ottoeject_macros_only,
    setup_print_jobs,
    get_current_rack_state,
    validate_job_sequence,
    convert_jobs_to_config,
    modify_printer_details,
    change_ottoeject_ip,
    select_saved_printer_profile,
    get_default_macros
)
from operations import (
    start_automation_sequence,
    test_printer_connection,
    test_ottoeject_connection,
    move_bed_for_calibration
)
from integrations import upload_prusa_positioning_file
from utils.logger import setup_logger, cleanup_old_logs

def load_existing_configuration():
    """Load and display existing configuration"""
    config_manager = ConfigManager()
    if not config_manager.config_exists():
        return None
    
    # Use the new profile system
    config = config_manager.get_current_printer_config()
    return config

def setup_new_printer_only():
    """Setup a new printer without configuring jobs"""
    logger = setup_logger()
    logger.info("Setting up new printer (no jobs)...")
    
    # Select printer brand
    selected_printer = get_printer_choice()
    
    print(f"\n✅ Selected: {selected_printer['name']}")
    print(f"📋 Requirements: {selected_printer['requirements']}")
    
    # For brands that have multiple models, ask for specific model first
    if selected_printer['name'] == "Bambu Lab":
        print("\nBAMBU LAB MODEL SELECTION:")
        print("1. P1P (Z-bed - Z-axis positioning)")
        print("2. P1S (Z-bed - Z-axis positioning)")
        print("3. X1C (Z-bed - Z-axis positioning)")
        print("4. A1 (Sling bed - Y-axis positioning)")
        
        while True:
            model_choice = input("Select Bambu Lab model (1-4): ").strip()
            if model_choice == "1":
                selected_printer['specific_model'] = 'P1P'
                selected_printer['bed_type'] = 'z_bed'
                break
            elif model_choice == "2":
                selected_printer['specific_model'] = 'P1S'
                selected_printer['bed_type'] = 'z_bed'
                break
            elif model_choice == "3":
                selected_printer['specific_model'] = 'X1C'
                selected_printer['bed_type'] = 'z_bed'
                break
            elif model_choice == "4":
                selected_printer['specific_model'] = 'A1'
                selected_printer['bed_type'] = 'sling_bed'
                break
            else:
                print("❌ Invalid selection. Please choose 1-4.")
    elif selected_printer['name'] == "Prusa":
        print("\nPRUSA MODEL SELECTION:")
        print("1. MK3/MK3S/MK3S+ (Sling bed - Y-axis positioning)")
        print("2. MK4/MK4S (Sling bed - Y-axis positioning)")
        print("3. Core One (Z-bed - Z-axis positioning)")
        
        while True:
            model_choice = input("Select Prusa model (1-3): ").strip()
            if model_choice == "1":
                selected_printer['specific_model'] = 'MK3'
                selected_printer['bed_type'] = 'sling_bed'
                break
            elif model_choice == "2":
                selected_printer['specific_model'] = 'MK4'
                selected_printer['bed_type'] = 'sling_bed'
                break
            elif model_choice == "3":
                selected_printer['specific_model'] = 'Core One'
                selected_printer['bed_type'] = 'z_bed'
                break
            else:
                print("❌ Invalid selection. Please choose 1-3.")
    else:
        # For other brands, use the default model from the printer definition
        selected_printer['specific_model'] = selected_printer['model']
    
    print(f"\n✅ Selected Model: {selected_printer['specific_model']}")
    
    if selected_printer.get('bed_type') == 'sling_bed':
        print(f"🛌 Sling Bed Printer - Uses Y-axis positioning for ejection")
    elif selected_printer.get('bed_type') == 'z_bed':
        print(f"⬆️ Z-Bed Printer - Uses Z-axis positioning for ejection")
    else:
        print(f"🤖 {selected_printer['type'].title().replace('_', ' ')} Printer")
    print()
    
    # Get printer connection details FIRST (IP, serial, access code, etc.)
    config_data = setup_printer_connection(selected_printer)
    
    # NOW ask for OttoEject IP (AFTER printer details)
    print("\n🤖 OTTOEJECT CONFIGURATION:")
    print("─" * 30)
    ottoeject_ip = input("Enter OttoEject IP/Hostname (e.g., 192.168.XX.XX): ").strip()
    config_data['OTTOEJECT_IP'] = ottoeject_ip
    
    # AUTOMATICALLY generate macro names based on printer brand/model
    print("\n🤖 OTTOEJECT MACRO CONFIGURATION:")
    print("─" * 40)
    default_macros = get_default_macros(config_data['PRINTER_BRAND'], config_data['PRINTER_MODEL'])
    config_data['EJECT_MACRO'] = default_macros['EJECT_MACRO']
    config_data['LOAD_MACRO'] = default_macros['LOAD_MACRO']
    
    print(f"✅ Using default macros for {config_data['PRINTER_BRAND']} {config_data['PRINTER_MODEL']}:")
    print(f"   Eject: {config_data['EJECT_MACRO']}")
    print(f"   Load: {config_data['LOAD_MACRO']}")
    print("   (These can be changed later via 'Modify Printer Details')")
    
    # Ask for profile name AFTER we have all the details
    print("\n💾 SAVE PRINTER PROFILE:")
    print("─" * 30)
    default_name = f"{config_data['PRINTER_BRAND']} {config_data['PRINTER_MODEL']}"
    profile_name = input(f"Enter profile name (default: {default_name}): ").strip()
    if not profile_name:
        profile_name = default_name
    
    # Save printer profile
    config_manager = ConfigManager()
    success, profile_id = config_manager.save_printer_profile(config_data, profile_name)
    if success:
        print(f"✅ Printer profile '{profile_name}' saved!")
    else:
        print("❌ Failed to save printer profile")
        return None
    
    # Set as current printer (no jobs configured)
    config_data['CURRENT_PRINTER_PROFILE'] = str(profile_id)
    config_data['TOTAL_JOBS'] = 0  # No jobs configured
    
    # Auto-upload positioning files for Prusa printers
    if selected_printer['name'] == "Prusa":
        upload_prusa_positioning_file(config_data)
    
    # Show special requirements - ONLY for Creality now (Anycubic and Elegoo handled automatically)
    if selected_printer['name'] == "Creality":
        print(f"\n⚠️  IMPORTANT FOR {selected_printer['name'].upper()}:")
        print("   Add 'G1 Z230' to 'END_PRINT' macro in gcode_macro.cfg")
        printer_ip = config_data.get('PRINTER_IP', 'printer_ip')
        print(f"   at http://{printer_ip}:4408/ after rooting printer.")
        input("\nPress ENTER to acknowledge...")
    
    print(f"\n✅ Printer '{profile_name}' setup complete!")
    if selected_printer['name'] in ['Anycubic', 'Elegoo']:
        print(f"   📋 Note: {selected_printer['name']} printers use automatic G-code preprocessing")
        print("        Z positioning commands will be added automatically during automation")
    print("   You can now:")
    print("   - Test connections (Options 7-8)")
    print("   - Calibrate bed positioning (Option 9)")
    print("   - Configure print jobs (Option 3)")
    
    return config_data

def select_different_printer_only():
    """Select a different printer from saved profiles (no jobs, return to menu)"""
    logger = setup_logger()
    logger.info("Selecting different printer from saved profiles...")
    
    print("\n🔄 SELECT DIFFERENT PRINTER")
    print("─" * 35)
    
    # Load existing config to preserve OttoEject IP
    config_manager = ConfigManager()
    existing_config = config_manager.get_current_printer_config()
    existing_ottoeject_ip = existing_config.get('OTTOEJECT_IP', '') if existing_config else ''
    
    # Get printer from profiles
    printer_config = select_saved_printer_profile()
    if not printer_config:
        return None
    
    # Keep existing OttoEject IP, and use saved macros from profile
    if existing_ottoeject_ip:
        print(f"\n✅ Keeping existing OttoEject IP: {existing_ottoeject_ip}")
        printer_config['OTTOEJECT_IP'] = existing_ottoeject_ip
        
        # Check if profile has saved macros
        if 'EJECT_MACRO' in printer_config and 'LOAD_MACRO' in printer_config:
            print(f"✅ Using saved macros from profile:")
            print(f"   Eject: {printer_config['EJECT_MACRO']}")
            print(f"   Load: {printer_config['LOAD_MACRO']}")
        else:
            # Profile doesn't have macros saved, ask for them
            print("⚠️ Profile doesn't have saved macros.")
            ottoeject_macros = setup_ottoeject_macros_only()
            printer_config.update(ottoeject_macros)
    else:
        # First time setup - ask for everything
        ottoeject_config = setup_ottoeject_config()
        printer_config.update(ottoeject_config)
    
    # No jobs configured yet
    printer_config['TOTAL_JOBS'] = 0
    
    # Auto-upload positioning files for Prusa printers
    printer_brand = printer_config.get('PRINTER_BRAND', '')
    if printer_brand == "Prusa":
        upload_prusa_positioning_file(printer_config)
    
    # Show special requirements - ONLY for Creality now
    if printer_brand == "Creality":
        print(f"\n⚠️  REMINDER FOR {printer_brand.upper()}:")
        print("   Make sure you have 'G1 Z230' in 'END_PRINT' macro in gcode_macro.cfg")
        printer_ip = printer_config.get('PRINTER_IP', 'printer_ip')
        print(f"   at http://{printer_ip}:4408/ after rooting printer.")
        input("\nPress ENTER to acknowledge...")
    
    print(f"\n✅ Printer selection complete!")
    if printer_brand in ['Anycubic', 'Elegoo']:
        print(f"   📋 Note: {printer_brand} printers use automatic G-code preprocessing")
        print("        Z positioning commands will be added automatically during automation")
    print("   You can now:")
    print("   - Test connections (Options 7-8)")
    print("   - Calibrate bed positioning (Option 9)")
    print("   - Configure print jobs (Option 3)")
    
    return printer_config

def setup_new_jobs_only(existing_config):
    """Setup new jobs using existing printer and OttoEject configuration"""
    logger = setup_logger()
    logger.info("Setting up new jobs with existing printer configuration...")
    
    print("\n🔄 CONFIGURING NEW JOBS")
    print("─" * 30)
    print(f"✅ Keeping existing printer: {existing_config.get('PRINTER_BRAND')} {existing_config.get('PRINTER_MODEL', '')} at {existing_config.get('PRINTER_IP')}")
    print(f"✅ Keeping existing OttoEject: {existing_config.get('OTTOEJECT_IP')}")
    print(f"✅ Keeping existing macros: {existing_config.get('EJECT_MACRO')}, {existing_config.get('LOAD_MACRO')}")
    print()
    
    # Start with existing config
    config_data = existing_config.copy()
    
    # Remove old job configurations
    keys_to_remove = [key for key in config_data.keys() if key.startswith('JOB_')]
    for key in keys_to_remove:
        del config_data[key]
    
    # Configure new print jobs (pass printer brand and model for AMS/Material Station support)
    printer_brand = existing_config.get('PRINTER_BRAND')
    printer_model = existing_config.get('PRINTER_MODEL')
    total_jobs, jobs = setup_print_jobs(printer_brand, printer_model)
    
    # Get current rack state and validate
    current_rack_state = get_current_rack_state()
    
    if not validate_job_sequence(jobs, current_rack_state, config_data):
        return None
    
    # Convert jobs to config format
    job_config = convert_jobs_to_config(jobs, total_jobs)
    config_data.update(job_config)
    
    # Auto-upload positioning files for Prusa printers (ensure they have the latest)
    printer_brand = existing_config.get('PRINTER_BRAND', '')
    if printer_brand == "Prusa":
        upload_prusa_positioning_file(config_data)
    
    # Show special requirements - ONLY for Creality now
    if printer_brand == "Creality":
        print(f"\n⚠️  REMINDER FOR {printer_brand.upper()}:")
        print("   Make sure you have 'G1 Z230' in 'END_PRINT' macro in gcode_macro.cfg")
        printer_ip = existing_config.get('PRINTER_IP', 'printer_ip')
        print(f"   at http://{printer_ip}:4408/ after rooting printer.")
        input("\nPress ENTER to acknowledge...")
    
    return config_data

def main():
    """Main entry point"""
    # Clean up old log files (older than 2 days) before starting
    cleanup_old_logs()
    
    display_welcome()
    
    # Main menu loop
    while True:
        # Check if configuration exists
        config_manager = ConfigManager()
        existing_config = load_existing_configuration()
        
        # Display menu and get choice
        display_main_menu(existing_config)
        choice = get_menu_choice(existing_config is not None)
        
        config_data = None
        
        # Handle menu choices
        if choice == "1":  # Setup A New Printer (no jobs, return to menu)
            config_data = setup_new_printer_only()
            if not config_data:
                print("❌ Printer setup failed. Returning to main menu.")
                continue
                
        elif choice == "2":  # Select a Different Printer (no jobs, return to menu)
            config_data = select_different_printer_only()
            if not config_data:
                print("❌ Printer selection failed. Returning to main menu.")
                continue
                
        elif choice == "3":  # Use Existing Printer, Configure New Jobs  
            config_data = setup_new_jobs_only(existing_config)
            if not config_data:
                print("❌ Configuration setup failed. Returning to main menu.")
                continue
            
        elif choice == "4":  # Run Last Loop
            config_data = existing_config
                
        elif choice == "5":  # Modify Existing Printer Details
            if not existing_config:
                print("❌ No existing configuration found.")
                input("Press ENTER to continue...")
                continue
            
            config_data = modify_printer_details(existing_config.copy())
            
            # Update the active profile if using profile system
            current_profile_id = existing_config.get('CURRENT_PRINTER_PROFILE')
            if current_profile_id and config_data:
                success = config_manager.update_printer_profile(current_profile_id, config_data)
                if success:
                    print("✅ Saved profile updated with changes!")
                else:
                    print("⚠️ Profile update failed, but current config saved.")
            
            # Add helpful note about the system
            if config_data:
                print("\n💡 Note: Changes apply immediately to current configuration.")
                if current_profile_id:
                    print("   Your saved profile has also been updated.")
            
        elif choice == "6":  # Change OttoEject IP
            if not existing_config:
                print("❌ No existing configuration found.")
                input("Press ENTER to continue...")
                continue
            config_data = change_ottoeject_ip(existing_config.copy())
            
        elif choice == "7":  # Test OttoEject Connection
            if not existing_config:
                print("❌ No existing configuration found.")
                input("Press ENTER to continue...")
                continue
            test_ottoeject_connection(existing_config)
            input("Press ENTER to continue...")
            continue
            
        elif choice == "8":  # Test Printer Connection
            if not existing_config:
                print("❌ No existing configuration found.")
                input("Press ENTER to continue...")
                continue
            test_printer_connection(existing_config)
            input("Press ENTER to continue...")
            continue
            
        elif choice == "9":  # Move Print Bed for Calibration
            if not existing_config:
                print("❌ No existing configuration found.")
                input("Press ENTER to continue...")
                continue
            move_bed_for_calibration(existing_config)
            input("Press ENTER to continue...")
            continue
        
        # Save configuration if it was modified
        if config_data and choice in ["1", "2", "3", "4", "5", "6"]:
            if not config_manager.save_config(config_data):
                print("❌ Failed to save configuration.")
                input("Press ENTER to continue...")
                continue
            print("✅ Configuration saved!")
            
            # Redisplay ASCII art after configuration is saved for choices 1, 2, 3
            if choice in ["1", "2", "3"]:
                input("\nPress ENTER to continue...")
                display_welcome(show_scroll_message=True)
        
        # Only start automation for choices 3 and 4 (Start New Jobs and Start Last Jobs)
        if choice in ["3", "4"]:
            # Ask for confirmation before starting automation
            print()
            while True:
                start_queue = input("Do you want to start the print queue? (y/n): ").strip().lower()
                if start_queue in ['y', 'yes']:
                    # User wants to start automation
                    display_automation_header()
                    completed_jobs, total_jobs, was_interrupted = start_automation_sequence(config_data)
                    from ui.display import display_automation_footer_enhanced
                    display_automation_footer_enhanced(completed_jobs, total_jobs, config_data, was_interrupted)
                    # Exit after automation
                    return  # Exit main function completely
                elif start_queue in ['n', 'no']:
                    # User wants to go back to main menu
                    print("Returning to main menu...\n")
                    break
                else:
                    print("Please enter 'y' for yes or 'n' for no.")
            # Continue to main menu (don't break the main loop)
            continue
        
        # For options 1, 2, 5, 6 save and return to menu
        if choice in ["1", "2", "5", "6"]:
            if choice == "1":
                print("\n✅ Printer setup complete! Returning to main menu...")
            elif choice == "2":
                print("\n✅ Printer selection complete! Returning to main menu...")
            elif choice in ["5", "6"]:
                print("\n✅ Changes saved! Returning to main menu...")
            input("Press ENTER to continue...\n")
            continue

if __name__ == "__main__":
    main()