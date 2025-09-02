"""
Configuration Manager for OTTOMAT3D Master Script
Handles loading and saving configuration in a dummy-proof text format
"""

import os
import sys
import platform
from pathlib import Path

class ConfigManager:
    def __init__(self, config_file="config.txt"):
        """Initialize ConfigManager with platform-appropriate config location"""
        system = platform.system()
        
        if system == "Darwin":  # macOS
            # ALWAYS use Application Support directory for macOS
            # App bundles are read-only due to App Translocation security
            app_support = Path.home() / "Library" / "Application Support" / "OTTOMAT3D"
            app_support.mkdir(parents=True, exist_ok=True)
            self.config_file = app_support / config_file
        else:
            # Windows/Linux/Development - keep existing behavior
            # Go to project root (up from src/config/ to project root)
            self.script_dir = Path(__file__).parent.parent.parent
            self.config_file = self.script_dir / config_file
    
    def config_exists(self):
        """Check if configuration file exists"""
        return self.config_file.exists()
    
    def load_config(self):
        """Load configuration from text file"""
        if not self.config_exists():
            return None
        
        config = {}
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    
                    # Skip empty lines and comments
                    if not line or line.startswith('#'):
                        continue
                    
                    # Parse key=value pairs
                    if '=' not in line:
                        print(f"Warning: Invalid line {line_num} in config file: {line}")
                        continue
                    
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    
                    # Fields that should remain as strings even if they're numeric
                    string_fields = {
                        'PRINTER_SERIAL', 'PRINTER_ACCESS_CODE', 'PRINTER_CHECK_CODE', 
                        'PRINTER_API_KEY', 'EJECT_MACRO', 'LOAD_MACRO', 'CURRENT_PRINTER_PROFILE'
                    }
                    
                    # Profile fields should also remain as strings
                    if key.startswith('PROFILE_'):
                        string_fields.add(key)
                    
                    # Convert values based on type, but keep certain fields as strings
                    if key in string_fields:
                        # Keep as string
                        pass
                    elif value.isdigit():
                        value = int(value)
                    elif value.lower() in ['true', 'false']:
                        value = value.lower() == 'true'
                    
                    config[key] = value
            
            return config
            
        except Exception as e:
            print(f"Error loading configuration: {e}")
            return None
    
    def save_config(self, config_data):
        """Save configuration to text file with profile support"""
        try:
            # Ensure the directory exists (important for macOS Application Support and app bundle)
            self.config_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Load existing config to preserve profile data
            existing_config = self.load_config() or {}
            
            # Merge new config with existing, preserving profiles
            merged_config = existing_config.copy()
            merged_config.update(config_data)
            
            with open(self.config_file, 'w', encoding='utf-8') as f:
                f.write("# OTTOMAT3D Configuration File\n")
                f.write("# Lines starting with # are comments\n\n")
                
                # Write profile system info if using profiles
                if 'CURRENT_PRINTER_PROFILE' in merged_config:
                    f.write("# PROFILE SYSTEM\n")
                    f.write(f"CURRENT_PRINTER_PROFILE={merged_config['CURRENT_PRINTER_PROFILE']}\n\n")
                    
                    # Write all saved profiles
                    profile_keys = [key for key in merged_config.keys() if key.startswith('PROFILE_')]
                    profile_nums = set()
                    for key in profile_keys:
                        parts = key.split('_')
                        if len(parts) >= 3:
                            try:
                                profile_nums.add(int(parts[1]))
                            except ValueError:
                                pass
                    
                    for profile_num in sorted(profile_nums):
                        profile_prefix = f'PROFILE_{profile_num}'
                        profile_name = merged_config.get(f'{profile_prefix}_NAME', f'Profile {profile_num}')
                        
                        f.write(f"# Profile {profile_num}: {profile_name}\n")
                        
                        # Write all profile fields
                        profile_fields = ['NAME', 'BRAND', 'CLASS', 'MODEL', 'IP', 'SERIAL', 'ACCESS_CODE', 'CHECK_CODE', 'API_KEY', 'MODE', 'BED_TYPE', 'EJECT_MACRO', 'LOAD_MACRO']
                        for field in profile_fields:
                            profile_key = f'{profile_prefix}_{field}'
                            if profile_key in merged_config:
                                f.write(f"{profile_key}={merged_config[profile_key]}\n")
                        f.write("\n")
                
                # Write current printer configuration (for backward compatibility or when not using profiles)
                if 'PRINTER_BRAND' in merged_config:
                    f.write("# CURRENT PRINTER CONFIGURATION\n")
                    f.write(f"PRINTER_BRAND={merged_config.get('PRINTER_BRAND', '')}\n")
                    f.write(f"PRINTER_CLASS={merged_config.get('PRINTER_CLASS', '')}\n")
                    f.write(f"PRINTER_MODEL={merged_config.get('PRINTER_MODEL', '')}\n")
                    f.write(f"PRINTER_IP={merged_config.get('PRINTER_IP', '')}\n")
                    
                    if 'PRINTER_SERIAL' in merged_config:
                        f.write(f"PRINTER_SERIAL={merged_config['PRINTER_SERIAL']}\n")
                    if 'PRINTER_ACCESS_CODE' in merged_config:
                        f.write(f"PRINTER_ACCESS_CODE={merged_config['PRINTER_ACCESS_CODE']}\n")
                    if 'PRINTER_CHECK_CODE' in merged_config:
                        f.write(f"PRINTER_CHECK_CODE={merged_config['PRINTER_CHECK_CODE']}\n")
                    if 'PRINTER_API_KEY' in merged_config:
                        f.write(f"PRINTER_API_KEY={merged_config['PRINTER_API_KEY']}\n")
                    if 'PRINTER_MODE' in merged_config:
                        f.write(f"PRINTER_MODE={merged_config['PRINTER_MODE']}\n")
                    if 'BED_TYPE' in merged_config:
                        f.write(f"BED_TYPE={merged_config['BED_TYPE']}\n")
                    f.write("\n")
                
                # Write OttoEject configuration
                f.write("# OTTOEJECT CONFIGURATION\n")
                f.write(f"OTTOEJECT_IP={merged_config.get('OTTOEJECT_IP', '')}\n")
                
                # Write current macros (from active profile)
                current_profile = merged_config.get('CURRENT_PRINTER_PROFILE')
                if current_profile:
                    profile_prefix = f'PROFILE_{current_profile}'
                    eject_macro = merged_config.get(f'{profile_prefix}_EJECT_MACRO', '')
                    load_macro = merged_config.get(f'{profile_prefix}_LOAD_MACRO', '')
                    f.write(f"EJECT_MACRO={eject_macro}\n")
                    f.write(f"LOAD_MACRO={load_macro}\n")
                else:
                    f.write(f"EJECT_MACRO={merged_config.get('EJECT_MACRO', '')}\n")
                    f.write(f"LOAD_MACRO={merged_config.get('LOAD_MACRO', '')}\n")
                
                # Write print job configuration
                f.write("\n# PRINT JOB CONFIGURATION\n")
                f.write(f"TOTAL_JOBS={merged_config.get('TOTAL_JOBS', 0)}\n")
                
                # Write individual job configurations
                total_jobs = merged_config.get('TOTAL_JOBS', 0)
                printer_brand = merged_config.get('PRINTER_BRAND', '')
                for i in range(1, total_jobs + 1):
                    f.write(f"\n# Job {i}\n")
                    f.write(f"JOB_{i}_FILENAME={merged_config.get(f'JOB_{i}_FILENAME', '')}\n")
                    # Only write USE_AMS setting for Bambu Lab printers
                    if printer_brand == 'Bambu Lab':
                        f.write(f"JOB_{i}_USE_AMS={merged_config.get(f'JOB_{i}_USE_AMS', False)}\n")
                    # Only write USE_MATERIAL_STATION setting for FlashForge AD5X printers  
                    if printer_brand == 'FlashForge' and merged_config.get('PRINTER_MODEL') and 'AD5X' in merged_config.get('PRINTER_MODEL', ''):
                        f.write(f"JOB_{i}_USE_MATERIAL_STATION={merged_config.get(f'JOB_{i}_USE_MATERIAL_STATION', False)}\n")
                    f.write(f"JOB_{i}_STORE_SLOT={merged_config.get(f'JOB_{i}_STORE_SLOT', '')}\n")
                    if f'JOB_{i}_GRAB_SLOT' in merged_config:
                        f.write(f"JOB_{i}_GRAB_SLOT={merged_config[f'JOB_{i}_GRAB_SLOT']}\n")
                    else:
                        f.write(f"# No grab slot for Job {i} (final job)\n")
                
                f.write(f"\n# Configuration saved at: {self._get_timestamp()}\n")
            
            print(f"✅ Configuration saved to: {self.config_file}")
            return True
            
        except Exception as e:
            print(f"❌ Error saving configuration: {e}")
            return False
    
    def _get_timestamp(self):
        """Get current timestamp for config file"""
        import datetime
        return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def display_config(self, config_data):
        """Display configuration in readable format"""
        print("\n" + "=" * 60)
        print("CURRENT CONFIGURATION")
        print("=" * 60)
        
        print(f"Printer Brand:    {config_data.get('PRINTER_BRAND', 'Unknown')}")
        print(f"Printer Model:    {config_data.get('PRINTER_MODEL', 'Unknown')}")
        print(f"Printer IP:       {config_data.get('PRINTER_IP', 'Unknown')}")
        print(f"OttoEject IP:     {config_data.get('OTTOEJECT_IP', 'Unknown')}")
        print(f"Eject Macro:      {config_data.get('EJECT_MACRO', 'Unknown')}")
        print(f"Load Macro:       {config_data.get('LOAD_MACRO', 'Unknown')}")
        print(f"Total Jobs:       {config_data.get('TOTAL_JOBS', 0)}")
        
        print("\nJOB DETAILS:")
        total_jobs = config_data.get('TOTAL_JOBS', 0)
        for i in range(1, total_jobs + 1):
            filename = config_data.get(f'JOB_{i}_FILENAME', 'Unknown')
            store_slot = config_data.get(f'JOB_{i}_STORE_SLOT', 'Unknown')
            grab_slot = config_data.get(f'JOB_{i}_GRAB_SLOT', 'None')
            print(f"  Job {i}: {filename} → Store:{store_slot}, Grab:{grab_slot}")
        
        print("=" * 60)
    
    def validate_config(self, config_data):
        """Validate configuration data"""
        required_fields = [
            'PRINTER_BRAND', 'PRINTER_CLASS', 'PRINTER_IP',
            'OTTOEJECT_IP', 'TOTAL_JOBS'
        ]
        
        for field in required_fields:
            if field not in config_data or not config_data[field]:
                return False, f"Missing required field: {field}"
        
        # Check if we have macros either globally or from active profile
        current_profile = config_data.get('CURRENT_PRINTER_PROFILE')
        if current_profile:
            profile_prefix = f'PROFILE_{current_profile}'
            eject_macro = config_data.get(f'{profile_prefix}_EJECT_MACRO')
            load_macro = config_data.get(f'{profile_prefix}_LOAD_MACRO')
            if not eject_macro or not load_macro:
                return False, f"Missing macros for active profile {current_profile}"
        else:
            if not config_data.get('EJECT_MACRO') or not config_data.get('LOAD_MACRO'):
                return False, "Missing EJECT_MACRO or LOAD_MACRO"
        
        # Validate job configuration
        total_jobs = config_data.get('TOTAL_JOBS', 0)
        if total_jobs < 1:
            return False, "Must have at least 1 print job"
        
        for i in range(1, total_jobs + 1):
            if f'JOB_{i}_FILENAME' not in config_data:
                return False, f"Missing filename for Job {i}"
            if f'JOB_{i}_STORE_SLOT' not in config_data:
                return False, f"Missing store slot for Job {i}"
        
        return True, "Configuration is valid"
    
    def get_available_profiles(self):
        """Get list of available printer profiles"""
        config = self.load_config()
        if not config:
            return []
        
        profiles = []
        profile_nums = set()
        
        # Find all profile numbers
        for key in config.keys():
            if key.startswith('PROFILE_') and '_NAME' in key:
                parts = key.split('_')
                if len(parts) >= 3:
                    profile_num = parts[1]
                    profile_nums.add(profile_num)
        
        # Build profile list
        for profile_num in sorted(profile_nums):
            profile_name = config.get(f'PROFILE_{profile_num}_NAME', f'Profile {profile_num}')
            profile_brand = config.get(f'PROFILE_{profile_num}_BRAND', 'Unknown')
            profile_model = config.get(f'PROFILE_{profile_num}_MODEL', 'Unknown')
            profile_ip = config.get(f'PROFILE_{profile_num}_IP', 'Unknown')
            
            profiles.append({
                'id': profile_num,
                'name': profile_name,
                'brand': profile_brand,
                'model': profile_model,
                'ip': profile_ip
            })
        
        return profiles
    
    def save_printer_profile(self, printer_config, profile_name):
        """Save a printer configuration as a profile"""
        config = self.load_config() or {}
        
        # Find next available profile number
        profile_nums = set()
        for key in config.keys():
            if key.startswith('PROFILE_') and '_NAME' in key:
                parts = key.split('_')
                if len(parts) >= 3:
                    try:
                        profile_nums.add(int(parts[1]))
                    except ValueError:
                        pass
        
        next_profile_num = 1
        while next_profile_num in profile_nums:
            next_profile_num += 1
        
        # Save profile data
        profile_prefix = f'PROFILE_{next_profile_num}'
        config[f'{profile_prefix}_NAME'] = profile_name
        config[f'{profile_prefix}_BRAND'] = printer_config.get('PRINTER_BRAND', '')
        config[f'{profile_prefix}_CLASS'] = printer_config.get('PRINTER_CLASS', '')
        config[f'{profile_prefix}_MODEL'] = printer_config.get('PRINTER_MODEL', '')
        config[f'{profile_prefix}_IP'] = printer_config.get('PRINTER_IP', '')
        
        # Save printer-specific fields
        if 'PRINTER_SERIAL' in printer_config:
            config[f'{profile_prefix}_SERIAL'] = printer_config['PRINTER_SERIAL']
        if 'PRINTER_ACCESS_CODE' in printer_config:
            config[f'{profile_prefix}_ACCESS_CODE'] = printer_config['PRINTER_ACCESS_CODE']
        if 'PRINTER_CHECK_CODE' in printer_config:
            config[f'{profile_prefix}_CHECK_CODE'] = printer_config['PRINTER_CHECK_CODE']
        if 'PRINTER_API_KEY' in printer_config:
            config[f'{profile_prefix}_API_KEY'] = printer_config['PRINTER_API_KEY']
        if 'PRINTER_MODE' in printer_config:
            config[f'{profile_prefix}_MODE'] = printer_config['PRINTER_MODE']
        if 'BED_TYPE' in printer_config:
            config[f'{profile_prefix}_BED_TYPE'] = printer_config['BED_TYPE']
        
        # Save OttoEject macros with the profile - THESE ARE REQUIRED
        # Every profile MUST have eject and load macros from user input
        if 'EJECT_MACRO' not in printer_config or 'LOAD_MACRO' not in printer_config:
            raise ValueError("EJECT_MACRO and LOAD_MACRO must be provided when saving a printer profile")
        
        config[f'{profile_prefix}_EJECT_MACRO'] = printer_config['EJECT_MACRO']
        config[f'{profile_prefix}_LOAD_MACRO'] = printer_config['LOAD_MACRO']
        
        # Set as current active profile
        config['CURRENT_PRINTER_PROFILE'] = str(next_profile_num)
        
        return self.save_config(config), next_profile_num
    
    def load_printer_profile(self, profile_id):
        """Load a specific printer profile"""
        config = self.load_config()
        if not config:
            return None
        
        profile_prefix = f'PROFILE_{profile_id}'
        
        # Check if profile exists
        if f'{profile_prefix}_NAME' not in config:
            return None
        
        # Extract printer configuration from profile
        printer_config = {
            'PRINTER_BRAND': config.get(f'{profile_prefix}_BRAND', ''),
            'PRINTER_CLASS': config.get(f'{profile_prefix}_CLASS', ''),
            'PRINTER_MODEL': config.get(f'{profile_prefix}_MODEL', ''),
            'PRINTER_IP': config.get(f'{profile_prefix}_IP', '')
        }
        
        # Add optional fields if they exist (excluding macros and BED_TYPE)
        optional_fields = [
            'SERIAL', 'ACCESS_CODE', 'CHECK_CODE', 'API_KEY', 'MODE'
        ]
        
        for field in optional_fields:
            profile_key = f'{profile_prefix}_{field}'
            if profile_key in config:
                # Add PRINTER_ prefix for other fields
                printer_key = f'PRINTER_{field}'
                printer_config[printer_key] = config[profile_key]
        
        # Handle BED_TYPE specially (no PRINTER_ prefix)
        bed_type_key = f'{profile_prefix}_BED_TYPE'
        if bed_type_key in config:
            printer_config['BED_TYPE'] = config[bed_type_key]
        
        # Handle macros - ALWAYS load from profile, no fallback
        # Every profile must have its own macros
        for macro_field in ['EJECT_MACRO', 'LOAD_MACRO']:
            profile_key = f'{profile_prefix}_{macro_field}'
            if profile_key in config:
                printer_config[macro_field] = config[profile_key]
            else:
                # This should never happen, but provide a default based on brand
                brand = printer_config.get('PRINTER_BRAND', 'UNKNOWN').upper().replace(' ', '_')
                if macro_field == 'EJECT_MACRO':
                    printer_config[macro_field] = f'EJECT_FROM_{brand}'
                else:
                    printer_config[macro_field] = f'LOAD_ONTO_{brand}'
        
        return printer_config
    
    def update_printer_profile(self, profile_id, updated_printer_config):
        """Update an existing printer profile with new configuration"""
        config = self.load_config()
        if not config:
            return False
        
        profile_prefix = f'PROFILE_{profile_id}'
        
        # Check if profile exists
        if f'{profile_prefix}_NAME' not in config:
            return False
        
        # Update profile fields from the printer config
        profile_field_mapping = {
            'PRINTER_BRAND': 'BRAND',
            'PRINTER_CLASS': 'CLASS', 
            'PRINTER_MODEL': 'MODEL',
            'PRINTER_IP': 'IP',
            'PRINTER_SERIAL': 'SERIAL',
            'PRINTER_ACCESS_CODE': 'ACCESS_CODE',
            'PRINTER_CHECK_CODE': 'CHECK_CODE',
            'PRINTER_API_KEY': 'API_KEY',
            'PRINTER_MODE': 'MODE',
            'BED_TYPE': 'BED_TYPE',
            'EJECT_MACRO': 'EJECT_MACRO',  # Added macro fields
            'LOAD_MACRO': 'LOAD_MACRO'
        }
        
        # Update profile with new values
        updates_made = 0
        for printer_key, profile_field in profile_field_mapping.items():
            if printer_key in updated_printer_config:
                profile_key = f'{profile_prefix}_{profile_field}'
                old_value = config.get(profile_key, 'NOT_SET')
                new_value = updated_printer_config[printer_key]
                
                if old_value != new_value:
                    config[profile_key] = new_value
                    updates_made += 1
        
        if updates_made > 0:
            # If this is the currently active profile, also update current configuration
            current_profile_id = config.get('CURRENT_PRINTER_PROFILE')
            if current_profile_id == str(profile_id):
                print(f"📝 Updating active profile - syncing current configuration...")
                # Sync current configuration with updated profile
                for printer_key, profile_field in profile_field_mapping.items():
                    if printer_key in updated_printer_config:
                        config[printer_key] = updated_printer_config[printer_key]
            
            return self.save_config(config)
        else:
            return True  # No changes needed
    
    def set_active_profile(self, profile_id):
        """Set the active printer profile and sync current configuration"""
        config = self.load_config() or {}
        config['CURRENT_PRINTER_PROFILE'] = str(profile_id)
        
        # Load profile data and sync current configuration
        profile_config = self.load_printer_profile(profile_id)
        if profile_config:
            # Update all current printer configuration fields with profile data
            profile_to_current_mapping = {
                'PRINTER_BRAND': 'PRINTER_BRAND',
                'PRINTER_CLASS': 'PRINTER_CLASS', 
                'PRINTER_MODEL': 'PRINTER_MODEL',
                'PRINTER_IP': 'PRINTER_IP',
                'PRINTER_SERIAL': 'PRINTER_SERIAL',
                'PRINTER_ACCESS_CODE': 'PRINTER_ACCESS_CODE',
                'PRINTER_CHECK_CODE': 'PRINTER_CHECK_CODE',
                'PRINTER_API_KEY': 'PRINTER_API_KEY',
                'PRINTER_MODE': 'PRINTER_MODE',
                'BED_TYPE': 'BED_TYPE', 
                'EJECT_MACRO': 'EJECT_MACRO',
                'LOAD_MACRO': 'LOAD_MACRO'
            }
            
            # Sync profile data to current configuration
            for profile_key, current_key in profile_to_current_mapping.items():
                if profile_key in profile_config:
                    config[current_key] = profile_config[profile_key]
            
            print(f"🔄 Synced current configuration with profile {profile_id} ({profile_config.get('PRINTER_BRAND', '')} {profile_config.get('PRINTER_MODEL', '')})")
        
        return self.save_config(config)
    
    def get_current_printer_config(self):
        """Get current printer configuration (prioritize current config over profile)"""
        config = self.load_config()
        if not config:
            return None
        
        # If we have current printer config, use that (it's more up-to-date)
        if 'PRINTER_BRAND' in config and 'PRINTER_IP' in config:
            # Use current config as primary
            printer_config = {
                'PRINTER_BRAND': config.get('PRINTER_BRAND', ''),
                'PRINTER_CLASS': config.get('PRINTER_CLASS', ''),
                'PRINTER_MODEL': config.get('PRINTER_MODEL', ''),
                'PRINTER_IP': config.get('PRINTER_IP', '')
            }
            
            # Add optional current config fields
            optional_fields = [
                'PRINTER_SERIAL', 'PRINTER_ACCESS_CODE', 'PRINTER_CHECK_CODE', 
                'PRINTER_API_KEY', 'PRINTER_MODE', 'BED_TYPE'
            ]
            
            for field in optional_fields:
                if field in config:
                    printer_config[field] = config[field]
            
            # Add OttoEject and job config
            # Get macros from active profile if available
            current_profile = config.get('CURRENT_PRINTER_PROFILE')
            if current_profile:
                profile_prefix = f'PROFILE_{current_profile}'
                eject_macro = config.get(f'{profile_prefix}_EJECT_MACRO', config.get('EJECT_MACRO', ''))
                load_macro = config.get(f'{profile_prefix}_LOAD_MACRO', config.get('LOAD_MACRO', ''))
            else:
                eject_macro = config.get('EJECT_MACRO', '')
                load_macro = config.get('LOAD_MACRO', '')
            
            printer_config.update({
                'OTTOEJECT_IP': config.get('OTTOEJECT_IP', ''),
                'EJECT_MACRO': eject_macro,
                'LOAD_MACRO': load_macro,
                'TOTAL_JOBS': config.get('TOTAL_JOBS', 0),
                'CURRENT_PRINTER_PROFILE': current_profile
            })
            
            # Add job configurations
            total_jobs = config.get('TOTAL_JOBS', 0)
            for i in range(1, total_jobs + 1):
                if f'JOB_{i}_FILENAME' in config:
                    printer_config[f'JOB_{i}_FILENAME'] = config[f'JOB_{i}_FILENAME']
                # Only load USE_AMS setting for Bambu Lab printers
                if printer_config.get('PRINTER_BRAND') == 'Bambu Lab' and f'JOB_{i}_USE_AMS' in config:
                    printer_config[f'JOB_{i}_USE_AMS'] = config[f'JOB_{i}_USE_AMS']
                # Only load USE_MATERIAL_STATION setting for FlashForge AD5X printers
                if printer_config.get('PRINTER_BRAND') == 'FlashForge' and printer_config.get('PRINTER_MODEL') and 'AD5X' in printer_config.get('PRINTER_MODEL', '') and f'JOB_{i}_USE_MATERIAL_STATION' in config:
                    printer_config[f'JOB_{i}_USE_MATERIAL_STATION'] = config[f'JOB_{i}_USE_MATERIAL_STATION']
                if f'JOB_{i}_STORE_SLOT' in config:
                    printer_config[f'JOB_{i}_STORE_SLOT'] = config[f'JOB_{i}_STORE_SLOT']
                if f'JOB_{i}_GRAB_SLOT' in config:
                    printer_config[f'JOB_{i}_GRAB_SLOT'] = config[f'JOB_{i}_GRAB_SLOT']
            
            return printer_config
        
        # Fallback: Check if using profile system (old behavior)
        current_profile = config.get('CURRENT_PRINTER_PROFILE')
        if current_profile:
            printer_config = self.load_printer_profile(current_profile)
            if printer_config:
                # Add OttoEject and job config
                printer_config.update({
                    'OTTOEJECT_IP': config.get('OTTOEJECT_IP', ''),
                    'TOTAL_JOBS': config.get('TOTAL_JOBS', 0)
                })
                
                # Add job configurations
                total_jobs = config.get('TOTAL_JOBS', 0)
                for i in range(1, total_jobs + 1):
                    if f'JOB_{i}_FILENAME' in config:
                        printer_config[f'JOB_{i}_FILENAME'] = config[f'JOB_{i}_FILENAME']
                    # Only load USE_AMS setting for Bambu Lab printers
                    if printer_config.get('PRINTER_BRAND') == 'Bambu Lab' and f'JOB_{i}_USE_AMS' in config:
                        printer_config[f'JOB_{i}_USE_AMS'] = config[f'JOB_{i}_USE_AMS']
                    # Only load USE_MATERIAL_STATION setting for FlashForge AD5X printers
                    if printer_config.get('PRINTER_BRAND') == 'FlashForge' and printer_config.get('PRINTER_MODEL') and 'AD5X' in printer_config.get('PRINTER_MODEL', '') and f'JOB_{i}_USE_MATERIAL_STATION' in config:
                        printer_config[f'JOB_{i}_USE_MATERIAL_STATION'] = config[f'JOB_{i}_USE_MATERIAL_STATION']
                    if f'JOB_{i}_STORE_SLOT' in config:
                        printer_config[f'JOB_{i}_STORE_SLOT'] = config[f'JOB_{i}_STORE_SLOT']
                    if f'JOB_{i}_GRAB_SLOT' in config:
                        printer_config[f'JOB_{i}_GRAB_SLOT'] = config[f'JOB_{i}_GRAB_SLOT']
                
                return printer_config
        
        # Final fallback - return config as-is
        return config
    
    def fix_profiles_missing_macros(self):
        """Fix existing profiles that are missing macro assignments"""
        config = self.load_config()
        if not config:
            return False
        
        # Define expected macros for each printer brand using proper OttoEject macro names
        # Import the correct macro utilities
        from utils.macro_utils import get_default_macros as get_correct_macros
        
        default_macros = {
            'Bambu Lab': {
                'P1P': {
                    'EJECT_MACRO': 'EJECT_FROM_BAMBULAB_P_ONE_P',
                    'LOAD_MACRO': 'LOAD_ONTO_BAMBULAB_P_ONE_P'
                },
                'P1S': {
                    'EJECT_MACRO': 'EJECT_FROM_BAMBULAB_P_ONE_S',
                    'LOAD_MACRO': 'LOAD_ONTO_BAMBULAB_P_ONE_S'
                },
                'X1C': {
                    'EJECT_MACRO': 'EJECT_FROM_BAMBULAB_X_ONE_C',
                    'LOAD_MACRO': 'LOAD_ONTO_BAMBULAB_X_ONE_C'
                },
                'A1': {
                    'EJECT_MACRO': 'EJECT_FROM_BAMBULAB_A_ONE',
                    'LOAD_MACRO': 'LOAD_ONTO_BAMBULAB_A_ONE'
                }
            },
            'Elegoo': {
                'Centauri Carbon': {
                    'EJECT_MACRO': 'EJECT_FROM_ELEGOO_CC',
                    'LOAD_MACRO': 'LOAD_ONTO_ELEGOO_CC'
                }
            },
            'Anycubic': {
                'Kobra S1': {
                    'EJECT_MACRO': 'EJECT_FROM_ANYCUBIC_KOBRA_S_ONE',
                    'LOAD_MACRO': 'LOAD_ONTO_ANYCUBIC_KOBRA_S_ONE'
                }
            },
            'FlashForge': {
                'AD5X': {
                    'EJECT_MACRO': 'EJECT_FROM_FLASHFORGE_AD_FIVE_X',
                    'LOAD_MACRO': 'LOAD_ONTO_FLASHFORGE_AD_FIVE_X'
                },
                '5M Pro': {
                    'EJECT_MACRO': 'EJECT_FROM_FLASHFORGE_AD_FIVE_X',
                    'LOAD_MACRO': 'LOAD_ONTO_FLASHFORGE_AD_FIVE_X'
                }
            },
            'Creality': {
                'K1': {
                    'EJECT_MACRO': 'EJECT_FROM_CREALITY_K_ONE_C',
                    'LOAD_MACRO': 'LOAD_ONTO_CREALITY_K_ONE_C'
                },
                'K1C': {
                    'EJECT_MACRO': 'EJECT_FROM_CREALITY_K_ONE_C',
                    'LOAD_MACRO': 'LOAD_ONTO_CREALITY_K_ONE_C'
                }
            },
            'Prusa': {
                'MK3': {
                    'EJECT_MACRO': 'EJECT_FROM_PRUSA_MK_THREE',
                    'LOAD_MACRO': 'LOAD_ONTO_PRUSA_MK_THREE'
                },
                'MK4': {
                    'EJECT_MACRO': 'EJECT_FROM_PRUSA_MK_FOUR',
                    'LOAD_MACRO': 'LOAD_ONTO_PRUSA_MK_FOUR'
                },
                'Core One': {
                    'EJECT_MACRO': 'EJECT_FROM_PRUSA_CORE_ONE',
                    'LOAD_MACRO': 'LOAD_ONTO_PRUSA_CORE_ONE'
                }
            }
        }
        
        # Find all profiles and add missing macros
        profiles_updated = 0
        profile_nums = set()
        for key in config.keys():
            if key.startswith('PROFILE_') and '_BRAND' in key:
                parts = key.split('_')
                if len(parts) >= 3:
                    profile_nums.add(parts[1])
        
        for profile_num in profile_nums:
            profile_prefix = f'PROFILE_{profile_num}'
            brand = config.get(f'{profile_prefix}_BRAND')
            model = config.get(f'{profile_prefix}_MODEL')
            
            if brand and brand in default_macros:
                # Check if macros are missing
                eject_key = f'{profile_prefix}_EJECT_MACRO'
                load_key = f'{profile_prefix}_LOAD_MACRO'
                
                if eject_key not in config or load_key not in config:
                    # Try to get model-specific macros first
                    macros_found = False
                    if model and model in default_macros[brand]:
                        config[eject_key] = default_macros[brand][model]['EJECT_MACRO']
                        config[load_key] = default_macros[brand][model]['LOAD_MACRO']
                        macros_found = True
                    else:
                        # Use the first available model for the brand as fallback
                        first_model = list(default_macros[brand].keys())[0] if default_macros[brand] else None
                        if first_model:
                            config[eject_key] = default_macros[brand][first_model]['EJECT_MACRO']
                            config[load_key] = default_macros[brand][first_model]['LOAD_MACRO']
                            macros_found = True
                    
                    if macros_found:
                        profiles_updated += 1
                        print(f"✅ Added correct macros to {brand} {model or 'default'} profile {profile_num}")
        
        if profiles_updated > 0:
            self.save_config(config)
            print(f"✅ Updated {profiles_updated} profiles with missing macros")
            return True
        else:
            print("✅ All profiles already have macros assigned")
            return False
    
    def verify_profile_sync(self, profile_id):
        """Comprehensive verification that profile data matches current configuration"""
        config = self.load_config()
        if not config:
            return False, "No configuration found"
        
        # Load profile data
        profile_config = self.load_printer_profile(profile_id)
        if not profile_config:
            return False, f"Profile {profile_id} not found"
        
        # Define all fields that should be synced
        sync_fields = {
            'PRINTER_BRAND': 'Brand',
            'PRINTER_CLASS': 'Class', 
            'PRINTER_MODEL': 'Model',
            'PRINTER_IP': 'IP Address',
            'PRINTER_SERIAL': 'Serial Number',
            'PRINTER_ACCESS_CODE': 'Access Code',
            'PRINTER_CHECK_CODE': 'Check Code',
            'PRINTER_API_KEY': 'API Key',
            'PRINTER_MODE': 'Mode',
            'BED_TYPE': 'Bed Type',
            'EJECT_MACRO': 'Eject Macro',
            'LOAD_MACRO': 'Load Macro'
        }
        
        # Check sync status for each field
        sync_status = []
        mismatched_fields = []
        
        for field_key, field_name in sync_fields.items():
            profile_value = profile_config.get(field_key, 'NOT_SET')
            current_value = config.get(field_key, 'NOT_SET')
            
            if profile_value == 'NOT_SET' and current_value == 'NOT_SET':
                sync_status.append(f"⚪ {field_name}: Not configured")
            elif profile_value == current_value:
                sync_status.append(f"✅ {field_name}: Synced ({current_value})")
            else:
                sync_status.append(f"❌ {field_name}: MISMATCH - Profile: '{profile_value}', Current: '{current_value}'")
                mismatched_fields.append(field_key)
        
        # Print detailed verification report
        brand = profile_config.get('PRINTER_BRAND', 'Unknown')
        model = profile_config.get('PRINTER_MODEL', 'Unknown')
        
        print(f"\n🔍 PROFILE SYNC VERIFICATION: {brand} {model} (Profile {profile_id})")
        print("═" * 60)
        
        for status in sync_status:
            print(f"  {status}")
        
        print("═" * 60)
        
        if mismatched_fields:
            print(f"⚠️  Found {len(mismatched_fields)} mismatched fields!")
            print("   Run profile sync again if needed.")
            return False, f"Mismatched fields: {', '.join(mismatched_fields)}"
        else:
            print("🎯 ALL FIELDS PERFECTLY SYNCHRONIZED!")
            return True, "All fields synchronized"
    
    def get_profile_field_summary(self, profile_id):
        """Get a summary of all fields in a profile for debugging"""
        config = self.load_config()
        if not config:
            return None
        
        profile_config = self.load_printer_profile(profile_id)
        if not profile_config:
            return None
        
        summary = {
            'profile_id': profile_id,
            'brand': profile_config.get('PRINTER_BRAND', 'N/A'),
            'model': profile_config.get('PRINTER_MODEL', 'N/A'),
            'bed_type': profile_config.get('BED_TYPE', 'N/A'),
            'ip': profile_config.get('PRINTER_IP', 'N/A'),
            'serial': profile_config.get('PRINTER_SERIAL', 'N/A'),
            'access_code': profile_config.get('PRINTER_ACCESS_CODE', 'N/A'),
            'eject_macro': profile_config.get('EJECT_MACRO', 'N/A'),
            'load_macro': profile_config.get('LOAD_MACRO', 'N/A')
        }
        
        return summary
