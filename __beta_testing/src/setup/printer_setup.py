"""
Printer Setup Module for OTTOMAT3D
Handles all printer configuration wizards and setup workflows
"""

from pathlib import Path
from utils.rack_manager import RackManager
from utils.logger import setup_logger
# from utils.macro_utils import get_default_macros  # Commented out - will handle macros separately

def get_default_macros(printer_brand, printer_model):
    """Get default OttoEject macro names based on printer brand and model"""
    
    # Hardcoded macro names for each specific printer model
    if printer_brand == "Bambu Lab":
        if printer_model == "P1P":
            return {
                'EJECT_MACRO': 'EJECT_FROM_BAMBULAB_P_ONE_P',
                'LOAD_MACRO': 'LOAD_ONTO_BAMBULAB_P_ONE_P'
            }
        elif printer_model == "P1S":
            return {
                'EJECT_MACRO': 'EJECT_FROM_BAMBULAB_P_ONE_S',
                'LOAD_MACRO': 'LOAD_ONTO_BAMBULAB_P_ONE_S'
            }
        elif printer_model == "X1C":
            return {
                'EJECT_MACRO': 'EJECT_FROM_BAMBULAB_X_ONE_C',
                'LOAD_MACRO': 'LOAD_ONTO_BAMBULAB_X_ONE_C'
            }
        elif printer_model == "A1":
            return {
                'EJECT_MACRO': 'EJECT_FROM_BAMBULAB_A_ONE',
                'LOAD_MACRO': 'LOAD_ONTO_BAMBULAB_A_ONE'
            }
    
    elif printer_brand == "Prusa":
        if printer_model == "MK3":
            return {
                'EJECT_MACRO': 'EJECT_FROM_PRUSA_MK_THREE',
                'LOAD_MACRO': 'LOAD_ONTO_PRUSA_MK_THREE'
            }
        elif printer_model == "MK4":
            return {
                'EJECT_MACRO': 'EJECT_FROM_PRUSA_MK_FOUR',
                'LOAD_MACRO': 'LOAD_ONTO_PRUSA_MK_FOUR'
            }
        elif printer_model == "Core One":
            return {
                'EJECT_MACRO': 'EJECT_FROM_PRUSA_CORE_ONE',
                'LOAD_MACRO': 'LOAD_ONTO_PRUSA_CORE_ONE'
            }
    
    elif printer_brand == "FlashForge":
        return {
            'EJECT_MACRO': 'EJECT_FROM_FLASHFORGE_AD_FIVE_X',
            'LOAD_MACRO': 'LOAD_ONTO_FLASHFORGE_AD_FIVE_X'
        }
    
    elif printer_brand == "Creality":
        return {
            'EJECT_MACRO': 'EJECT_FROM_CREALITY_K_ONE_C',
            'LOAD_MACRO': 'LOAD_ONTO_CREALITY_K_ONE_C'
        }
    
    elif printer_brand == "Elegoo":
        return {
            'EJECT_MACRO': 'EJECT_FROM_ELEGOO_CC',
            'LOAD_MACRO': 'LOAD_ONTO_ELEGOO_CC'
        }
    
    elif printer_brand == "Anycubic":
        return {
            'EJECT_MACRO': 'EJECT_FROM_ANYCUBIC_KOBRA_S_ONE',
            'LOAD_MACRO': 'LOAD_ONTO_ANYCUBIC_KOBRA_S_ONE'
        }
    
    # Fallback for unknown models (shouldn't happen with proper setup)
    brand_clean = printer_brand.upper().replace(' ', '_')
    model_clean = printer_model.upper().replace(' ', '_').replace('/', '_').replace('+', 'PLUS')
    return {
        'EJECT_MACRO': f'EJECT_FROM_{brand_clean}_{model_clean}',
        'LOAD_MACRO': f'LOAD_ONTO_{brand_clean}_{model_clean}'
    }

def get_supported_printers():
    """Return dictionary of supported printer brands and models"""
    return {
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

def setup_printer_connection(selected_printer):
    """Setup printer connection details based on printer type"""
    config_data = {}
    config_data['PRINTER_BRAND'] = selected_printer['name']
    config_data['PRINTER_CLASS'] = selected_printer['class']
    
    # Use the pre-selected specific model
    if 'specific_model' in selected_printer:
        config_data['PRINTER_MODEL'] = selected_printer['specific_model']
        if 'bed_type' in selected_printer:
            config_data['BED_TYPE'] = selected_printer['bed_type']
    else:
        config_data['PRINTER_MODEL'] = selected_printer['model']
    
    print("\nPRINTER CONFIGURATION:")
    print("─" * 30)
    
    if selected_printer['name'] == "Bambu Lab":
        # No need to ask for model again - use pre-selected
        if config_data['PRINTER_MODEL'] in ['P1P', 'P1S']:
            print("ENSURE LAN MODE + DEVELOPER MODE IS ENABLED IF FIRMWARE VERSION >= 01.08.02.00")
        elif config_data['PRINTER_MODEL'] in ['A1']:
            print("ENSURE DEVELOPER MODE IS ENABLED IF FIRMWARE VERSON >= 01.05.00.00")
        else: # X1-C
            print("ENSURE LAN MODE + DEVELOPER MODE IS ENABLED FOR X1C")
        
        config_data['PRINTER_IP'] = input("Enter Printer IP Address: ").strip()
        config_data['PRINTER_SERIAL'] = input("Enter Printer Serial Number: ").strip()
        config_data['PRINTER_ACCESS_CODE'] = input("Enter Printer Access Code: ").strip()
        config_data['PRINTER_MODE'] = "LAN_DEV_MODE"
        
    elif selected_printer['name'] == "FlashForge":
        print("ENSURE LAN MODE IS ENABLED")
        config_data['PRINTER_IP'] = input("Enter Printer IP Address: ").strip()
        config_data['PRINTER_SERIAL'] = input("Enter Printer Serial Number: ").strip()
        config_data['PRINTER_CHECK_CODE'] = input("Enter Printer Check Code: ").strip()
        config_data['PRINTER_MODE'] = "LAN_MODE"
        
    elif selected_printer['name'] == "Creality":
        print("ENSURE PRINTER IS ROOTED")
        config_data['PRINTER_IP'] = input("Enter Printer IP Address: ").strip()
        
    elif selected_printer['name'] == "Anycubic":
        print("ENSURE RINKHALS CUSTOM FIRMWARE IS INSTALLED")
        config_data['PRINTER_IP'] = input("Enter Printer IP Address: ").strip()
        
    elif selected_printer['name'] == "Elegoo":
        config_data['PRINTER_IP'] = input("Enter Printer IP Address: ").strip()
        
    elif selected_printer['name'] == "Prusa":
        print("ENSURE PRUSALINK IS ENABLED")
        
        # No need to ask for model again - use pre-selected
        config_data['PRINTER_IP'] = input("Enter Printer IP Address: ").strip()
        config_data['PRINTER_API_KEY'] = input("Enter PrusaLink API Key: ").strip()
    
    return config_data
    
def change_rack_slot_count(config_data):
    """Change the number of rack slots"""
    print("\n🔄 CHANGE OTTORACK SLOT COUNT")
    print("─" * 35)
    
    current_slot_count = config_data.get('RACK_SLOT_COUNT', 6)
    print(f"Current slot count: {current_slot_count}")
    
    # Check if there are existing jobs that might be affected
    total_jobs = config_data.get('TOTAL_JOBS', 0)
    if total_jobs > 0:
        print(f"\n⚠️  Warning: You have {total_jobs} configured jobs.")
        print("   Changing slot count may affect existing job configurations.")
        
        # Find the highest slot number used in current jobs
        highest_slot_used = 0
        for i in range(1, total_jobs + 1):
            store_slot = config_data.get(f'JOB_{i}_STORE_SLOT')
            grab_slot = config_data.get(f'JOB_{i}_GRAB_SLOT')
            if store_slot:
                highest_slot_used = max(highest_slot_used, store_slot)
            if grab_slot:
                highest_slot_used = max(highest_slot_used, grab_slot)
        
        if highest_slot_used > 0:
            print(f"   Highest slot number used in jobs: {highest_slot_used}")
    
    print("\nValid slot count range: 1-6")
    
    while True:
        try:
            new_slot_count = input(f"Enter new slot count (current: {current_slot_count}, press ENTER to keep): ").strip()
            
            if not new_slot_count:
                print("❌ No changes made.")
                return config_data
            
            new_slot_count = int(new_slot_count)
            
            if not (1 <= new_slot_count <= 6):
                print("❌ Slot count must be between 1-6.")
                continue
            
            # Check if new slot count conflicts with existing jobs
            if total_jobs > 0 and highest_slot_used > new_slot_count:
                print(f"\n❌ Cannot reduce slot count to {new_slot_count}.")
                print(f"   Your existing jobs use slot {highest_slot_used}, which is higher than {new_slot_count}.")
                print("   Please reconfigure your jobs first or choose a higher slot count.")
                continue
            
            # Confirm the change
            if new_slot_count != current_slot_count:
                print(f"\n✅ Changing slot count from {current_slot_count} to {new_slot_count}")
                
                if total_jobs > 0:
                    print(f"\n📝 Note: Your {total_jobs} existing jobs will remain unchanged.")
                    print("   Make sure your physical rack has the correct number of slots.")
                
                confirm = input("\nConfirm this change? (y/n): ").strip().lower()
                if confirm in ['y', 'yes']:
                    config_data['RACK_SLOT_COUNT'] = new_slot_count
                    print(f"✅ Slot count updated to {new_slot_count}!")
                    return config_data
                else:
                    print("❌ Change cancelled.")
                    return config_data
            else:
                print("❌ No changes made.")
                return config_data
                
        except ValueError:
            print("❌ Please enter a valid number.")

def select_saved_printer_profile():
    """Let user select from saved printer profiles"""
    from config.config_manager import ConfigManager
    
    config_manager = ConfigManager()
    profiles = config_manager.get_available_profiles()
    
    if not profiles:
        print("\n⚠️  No saved printer profiles found.")
        print("   Use Option 4 to setup and save a new printer profile.")
        return None
    
    print("\n📋 SAVED PRINTER PROFILES:")
    print("─" * 50)
    
    for i, profile in enumerate(profiles, 1):
        print(f"{i}. {profile['name']}")
        print(f"   {profile['brand']} {profile['model']} - {profile['ip']}")
        print()
    
    while True:
        try:
            choice = int(input(f"Select profile (1-{len(profiles)}): ").strip())
            if 1 <= choice <= len(profiles):
                selected_profile = profiles[choice - 1]
                
                # Load the complete printer configuration
                printer_config = config_manager.load_printer_profile(selected_profile['id'])
                if not printer_config:
                    print("❌ Failed to load profile configuration")
                    return None
                
                # Set as active profile
                config_manager.set_active_profile(selected_profile['id'])
                
                print(f"\n✅ Selected: {selected_profile['name']}")
                print(f"📋 {selected_profile['brand']} {selected_profile['model']} at {selected_profile['ip']}")
                
                return printer_config
            else:
                print(f"❌ Please enter a number between 1-{len(profiles)}.")
        except ValueError:
            print("❌ Please enter a valid number.")

def setup_ottoeject_config():
    """Setup OttoEject configuration"""
    print("OTTOEJECT CONFIGURATION:")
    print("─" * 30)
    ottoeject_ip = input("Enter OttoEject IP/Hostname (e.g., ottoeject.local): ").strip()
    
    print("\nOTTOEJECT MACRO CONFIGURATION:")
    print("─" * 40)
    eject_macro = input("Enter EJECT macro name (e.g., EJECT_FROM_P1): ").strip()
    load_macro = input("Enter LOAD macro name (e.g., LOAD_ONTO_P1): ").strip()
    
    return {
        'OTTOEJECT_IP': ottoeject_ip,
        'EJECT_MACRO': eject_macro,
        'LOAD_MACRO': load_macro
    }

def setup_ottoeject_macros_only():
    """Setup only OttoEject macro names (keep existing IP)"""
    print("OTTOEJECT MACRO CONFIGURATION:")
    print("─" * 40)
    print("(Keeping existing OttoEject IP)")
    print()
    eject_macro = input("Enter EJECT macro name (e.g., EJECT_FROM_P1): ").strip()
    load_macro = input("Enter LOAD macro name (e.g., LOAD_ONTO_P1): ").strip()
    
    return {
        'EJECT_MACRO': eject_macro,
        'LOAD_MACRO': load_macro
    }

def modify_printer_details(config_data):
    """Modify existing printer details"""
    print("\n🔧 MODIFY PRINTER DETAILS")
    print("─" * 30)
    
    print("Current Printer Details:")
    print(f"  Brand: {config_data.get('PRINTER_BRAND')}")
    print(f"  Model: {config_data.get('PRINTER_MODEL')}")
    print(f"  IP: {config_data.get('PRINTER_IP')}")
    print(f"  Eject Macro: {config_data.get('EJECT_MACRO')}")
    print(f"  Load Macro: {config_data.get('LOAD_MACRO')}")
    
    # Show printer-specific details
    printer_brand = config_data.get('PRINTER_BRAND')
    if printer_brand == "Bambu Lab":
        print(f"  Serial Number: {config_data.get('PRINTER_SERIAL', 'Not set')}")
        print(f"  Access Code: {config_data.get('PRINTER_ACCESS_CODE', 'Not set')}")
    elif printer_brand == "FlashForge":
        print(f"  Serial Number: {config_data.get('PRINTER_SERIAL', 'Not set')}")
        print(f"  Check Code: {config_data.get('PRINTER_CHECK_CODE', 'Not set')}")
    elif printer_brand == "Prusa":
        print(f"  API Key: {config_data.get('PRINTER_API_KEY', 'Not set')}")
    
    print()
    
    # Modify IP
    new_ip = input(f"New Printer IP (current: {config_data.get('PRINTER_IP')}, press ENTER to keep): ").strip()
    if new_ip:
        config_data['PRINTER_IP'] = new_ip
    
    # Modify macros
    new_eject = input(f"New Eject Macro (current: {config_data.get('EJECT_MACRO')}, press ENTER to keep): ").strip()
    if new_eject:
        config_data['EJECT_MACRO'] = new_eject
    
    new_load = input(f"New Load Macro (current: {config_data.get('LOAD_MACRO')}, press ENTER to keep): ").strip()
    if new_load:
        config_data['LOAD_MACRO'] = new_load
    
    # Modify printer-specific details
    if printer_brand == "Bambu Lab":
        new_serial = input(f"New Serial Number (current: {config_data.get('PRINTER_SERIAL')}, press ENTER to keep): ").strip()
        if new_serial:
            config_data['PRINTER_SERIAL'] = new_serial
        
        new_access = input(f"New Access Code (current: {config_data.get('PRINTER_ACCESS_CODE')}, press ENTER to keep): ").strip()
        if new_access:
            config_data['PRINTER_ACCESS_CODE'] = new_access
    
    elif printer_brand == "FlashForge":
        new_serial = input(f"New Serial Number (current: {config_data.get('PRINTER_SERIAL')}, press ENTER to keep): ").strip()
        if new_serial:
            config_data['PRINTER_SERIAL'] = new_serial
        
        new_check = input(f"New Check Code (current: {config_data.get('PRINTER_CHECK_CODE')}, press ENTER to keep): ").strip()
        if new_check:
            config_data['PRINTER_CHECK_CODE'] = new_check
    
    elif printer_brand == "Prusa":
        new_api_key = input(f"New API Key (current: {config_data.get('PRINTER_API_KEY')}, press ENTER to keep): ").strip()
        if new_api_key:
            config_data['PRINTER_API_KEY'] = new_api_key
    
    print("✅ Printer details updated!")
    return config_data

def change_ottoeject_ip(config_data):
    """Change OttoEject IP address"""
    print("\n🔧 CHANGE OTTOEJECT IP")
    print("─" * 25)
    
    current_ip = config_data.get('OTTOEJECT_IP', 'Not set')
    print(f"Current OttoEject IP: {current_ip}")
    
    new_ip = input("Enter new OttoEject IP/Hostname: ").strip()
    if new_ip:
        config_data['OTTOEJECT_IP'] = new_ip
        print("✅ OttoEject IP updated!")
    else:
        print("❌ No IP entered, keeping current setting")
    
    return config_data
