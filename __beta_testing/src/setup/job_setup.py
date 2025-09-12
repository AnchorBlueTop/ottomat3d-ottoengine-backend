"""
Job Setup Module for OTTOMAT3D
Handles print job configuration and rack validation
"""

from utils.rack_manager import RackManager

def setup_print_jobs(printer_brand=None, printer_model=None):
    """Configure print jobs for automation sequence"""
    print("\nPRINT JOB CONFIGURATION:")
    print("─" * 30)
    
    while True:
        try:
            total_jobs = int(input("Enter number of print jobs (1-6): ").strip())
            if 1 <= total_jobs <= 6:
                break
            print("❌ Please enter a number between 1 and 6.")
        except ValueError:
            print("❌ Please enter a valid number.")
    
    # Get job details
    jobs = {}
    
    for i in range(1, total_jobs + 1):
        print(f"\n📋 JOB {i} CONFIGURATION:")
        print("─" * 25)
        
        filename = input(f"Enter filename for Job {i}: ").strip()
        
        # Ask about AMS for Bambu Lab printers
        use_ams = False
        if printer_brand == "Bambu Lab":
            while True:
                ams_choice = input(f"Use AMS for this print? (y/n): ").strip().lower()
                if ams_choice in ['y', 'yes']:
                    use_ams = True
                    print("\nNOTE: Make sure filament was synced in Bambu Studio before slicing")
                    break
                elif ams_choice in ['n', 'no']:
                    use_ams = False
                    break
                else:
                    print("❌ Please enter 'y' for yes or 'n' for no.")
        
        # Ask about Material Station for FlashForge AD5X printers
        use_material_station = False
        if printer_brand == "FlashForge" and printer_model and "AD5X" in printer_model:
            while True:
                ms_choice = input(f"Use Material Station (AMS/CFS/IFS) for this print? (y/n): ").strip().lower()
                if ms_choice in ['y', 'yes']:
                    use_material_station = True
                    print("\nNOTE: Make sure filaments are mapped correctly in your slicer as per your filament station (AMS/CFS/IFS).")
                    break
                elif ms_choice in ['n', 'no']:
                    use_material_station = False
                    break
                else:
                    print("❌ Please enter 'y' for yes or 'n' for no.")
        
        # Store slot
        while True:
            try:
                store_slot = int(input(f"Enter STORE slot for Job {i} (1-6): ").strip())
                if 1 <= store_slot <= 6:
                    break
                print("❌ Store slot must be between 1-6.")
            except ValueError:
                print("❌ Please enter a valid number.")
        
        # Grab slot (not needed for last job)
        grab_slot = None
        if i < total_jobs:
            while True:
                try:
                    grab_slot = int(input(f"Enter GRAB slot for Job {i} (1-6): ").strip())
                    if 1 <= grab_slot <= 6:
                        break
                    print("❌ Grab slot must be between 1-6.")
                except ValueError:
                    print("❌ Please enter a valid number.")
        
        jobs[i] = {
            'filename': filename,
            'use_ams': use_ams,
            'use_material_station': use_material_station,
            'store_slot': store_slot,
            'grab_slot': grab_slot
        }
    
    return total_jobs, jobs

def get_current_rack_state():
    """Get current rack state from user"""
    print("\nCURRENT RACK STATE SETUP:")
    print("─" * 35)
    print("⚠️  Before we validate your job sequence, we need to know")
    print("   which slots currently have build plates in them.")
    print()
    
    current_rack_state = {}
    for slot in range(6, 0, -1):  # 6 to 1 as requested
        while True:
            response = input(f"Does slot {slot} currently have a build plate? (y/n): ").strip().lower()
            if response in ['y', 'yes']:
                current_rack_state[slot] = f"existing_plate_slot_{slot}"
                print(f"  ✅ Slot {slot}: Has build plate")
                break
            elif response in ['n', 'no']:
                current_rack_state[slot] = "empty"
                print(f"  ⬜ Slot {slot}: Empty")
                break
            else:
                print("❌ Please enter 'y' for yes or 'n' for no.")
    
    print(f"\n📊 CURRENT RACK STATE:")
    for slot in range(6, 0, -1):  # Display from 6 to 1
        status = "🟢 HAS PLATE" if current_rack_state[slot] != "empty" else "⬜ EMPTY"
        print(f"   Slot {slot}: {status}")
    print()
    
    return current_rack_state

def validate_job_sequence(jobs, current_rack_state, config_data=None):
    """Validate job sequence with current rack state"""
    # Get slot count from config or default to 6
    slot_count = 6  # Default
    if config_data:
        slot_count = config_data.get('RACK_SLOT_COUNT', 6)
    
    rack_manager = RackManager(slot_count)
    
    validation_result = rack_manager.validate_job_sequence(jobs, initial_rack_state=current_rack_state, slot_count=slot_count)
    if not validation_result['valid']:
        print(f"\n❌ RACK CONFIGURATION ERROR:")
        print(f"   {validation_result['error']}")
        print(f"\n📊 REMINDER - Current rack state:")
        for slot in range(6, 0, -1):  # Display from 6 to 1
            status = "🟢 HAS PLATE" if current_rack_state[slot] != "empty" else "⬜ EMPTY"
            print(f"   Slot {slot}: {status}")
        print("\n💡 TIP: Make sure you're grabbing from slots that have plates")
        print("      and storing to slots that are empty.")
        print("\nPlease restart configuration and fix slot assignments.")
        return False
    
    print(f"\n✅ Rack configuration validated successfully!")
    return True

def convert_jobs_to_config(jobs, total_jobs):
    """Convert jobs dictionary to config format"""
    config_data = {'TOTAL_JOBS': total_jobs}
    
    for i, job in jobs.items():
        config_data[f'JOB_{i}_FILENAME'] = job['filename']
        config_data[f'JOB_{i}_USE_AMS'] = job.get('use_ams', False)
        config_data[f'JOB_{i}_USE_MATERIAL_STATION'] = job.get('use_material_station', False)
        config_data[f'JOB_{i}_STORE_SLOT'] = job['store_slot']
        if job['grab_slot']:
            config_data[f'JOB_{i}_GRAB_SLOT'] = job['grab_slot']
    
    return config_data
