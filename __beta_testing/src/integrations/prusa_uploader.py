"""
Prusa Integration Module for OTTOMAT3D
Handles Prusa-specific file upload and positioning functionality
"""

from pathlib import Path

try:
    import PrusaLinkPy
except ImportError:
    PrusaLinkPy = None

def upload_prusa_positioning_file(config_data):
    """Auto-upload positioning file to Prusa printer during setup"""
    if not PrusaLinkPy:
        print("\n⚠️  PrusaLinkPy not available - skipping auto-upload")
        print("   Please manually upload the positioning file to /usb/OTTOTEMP/")
        return
    
    print("\n🔄 AUTO-UPLOADING POSITIONING FILE...")
    print("─" * 45)
    
    # Determine which file to upload based on bed type or printer model
    bed_type = config_data.get('BED_TYPE')
    printer_model = config_data.get('PRINTER_MODEL', '')
    
    # Check BED_TYPE first, then fall back to PRINTER_MODEL
    if bed_type == 'z_bed' or printer_model == 'Core One':
        local_filename = "Z_POS_DWELL.gcode"
        remote_filename = "Z_POS_DWELL.gcode"
        description = "Z200 positioning file for Core One"
    else:
        local_filename = "Y_POS_DWELL.gcode"
        remote_filename = "Y_POS_DWELL.gcode"
        description = "Y210 positioning file for MK3/MK4"
    
    # Local and remote paths
    local_path = Path(__file__).parent.parent / "gcode" / local_filename
    remote_path = f"OTTOTEMP/{remote_filename}"  # Becomes /usb/OTTOTEMP/filename.gcode
    
    if not local_path.exists():
        print(f"❌ Local file not found: {local_path}")
        return
    
    try:
        # Connect to printer
        print(f"Connecting to Prusa at {config_data['PRINTER_IP']}...")
        prusa = PrusaLinkPy.PrusaLinkPy(config_data['PRINTER_IP'], config_data['PRINTER_API_KEY'])
        
        # Test connection
        version_response = prusa.get_version()
        if not version_response or version_response.status_code != 200:
            print("❌ Failed to connect to Prusa for file upload")
            return
        
        print(f"✅ Connected! Uploading {description}...")
        
        # Check if OTTOTEMP folder exists first
        print("Checking if OTTOTEMP folder exists...")
        try:
            folder_check = prusa.get_files('/OTTOTEMP/')
            if folder_check.status_code != 200:
                print("⚠️  OTTOTEMP folder doesn't exist - will be created during upload")
        except:
            print("⚠️  Could not check OTTOTEMP folder - proceeding with upload")
        
        # Upload file with overwrite enabled
        print(f"Uploading {local_filename} to {remote_path}...")
        upload_response = prusa.put_gcode(str(local_path), remote_path, printAfterUpload=False, overwrite=True)
        
        if upload_response and upload_response.status_code in [200, 201, 202, 204]:
            print(f"✅ {description} uploaded successfully!")
            print(f"   Location: /usb/{remote_path}")
            print("   This file will be used automatically for bed positioning during automation.")
            
            # Verify the file exists
            if prusa.exists_gcode(remote_path):
                print("✅ File verified on printer!")
            else:
                print("⚠️  Upload succeeded but file verification failed")
                
        else:
            status_code = upload_response.status_code if upload_response else "No Response"
            print(f"❌ Upload failed: HTTP {status_code}")
            if upload_response and upload_response.text:
                print(f"   Error details: {upload_response.text}")
            print("   Please manually upload the positioning file to /usb/OTTOTEMP/")
            print(f"   File content: {local_path}")
            
    except Exception as e:
        print(f"❌ Error during upload: {e}")
        print("   Please manually upload the positioning file to /usb/OTTOTEMP/")
        print(f"   File location: {local_path}")
    
    print()
