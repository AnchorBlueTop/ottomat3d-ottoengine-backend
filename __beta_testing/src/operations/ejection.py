"""
Ejection Sequence Module for OTTOMAT3D
Handles the complete ejection and loading sequence with OttoEject
"""

from utils.logger import setup_logger
from utils.macro_utils import get_door_closing_macro

def perform_ejection_sequence(ottoeject, store_slot, grab_slot, config_data):
    """Perform the complete ejection sequence"""
    logger = setup_logger()
    
    logger.info("Starting ejection sequence...")
    
    try:
        # Home first
        if not ottoeject.execute_macro("OTTOEJECT_HOME"):
            return False
        
        # Eject from printer
        eject_macro = config_data['EJECT_MACRO']
        if not ottoeject.execute_macro(eject_macro):
            return False
        
        # Store to slot
        store_macro = f"STORE_TO_SLOT_{store_slot}"
        if not ottoeject.execute_macro(store_macro):
            return False
    
        # Check if this is the final job (no grab_slot means final job)
        is_final_job = grab_slot is None
        
        if is_final_job:
            # For final job, check if printer has a door and close it
            printer_brand = config_data.get('PRINTER_BRAND', '')
            printer_model = config_data.get('PRINTER_MODEL', '')
            
            # Debug logging to help troubleshoot door closing issues
            logger.info(f"Final job detected - checking for door closing capability")
            logger.info(f"Printer brand: '{printer_brand}', Printer model: '{printer_model}'")
            
            door_closing_macro = get_door_closing_macro(printer_brand, printer_model)
            
            if door_closing_macro:
                logger.info(f"Door found! Closing door using macro: {door_closing_macro}")
                if not ottoeject.execute_macro(door_closing_macro):
                    logger.error(f"Failed to execute door closing macro: {door_closing_macro}")
                    return False
                logger.info(f"✅ Door closed successfully for {printer_brand} {printer_model}")
            else:
                logger.info(f"Final job completed - {printer_brand} {printer_model} does not have a door to close")
                logger.info(f"Available door-equipped models: Bambu Lab P1S/X1C, Creality K1/K1C, Anycubic Kobra S1, Elegoo Centauri Carbon")
        else:
            # Not final job - grab new plate and load onto printer
            grab_macro = f"GRAB_FROM_SLOT_{grab_slot}"
            if not ottoeject.execute_macro(grab_macro):
                return False
            
            # Load onto printer
            load_macro = config_data['LOAD_MACRO']
            if not ottoeject.execute_macro(load_macro):
                return False
        
        # Park
        if not ottoeject.execute_macro("PARK_OTTOEJECT"):
            return False
        
        logger.info("Ejection sequence completed successfully")
        return True
        
    except KeyboardInterrupt:
        logger.warning("🚨 Ejection sequence interrupted by user - EMERGENCY STOPPING OttoEject!")
        try:
            ottoeject.emergency_stop()
            logger.info("✅ Emergency stop sent to OttoEject")
        except Exception as e:
            logger.error(f"❌ Failed to send emergency stop: {e}")
        logger.info("⚠️  Please check OttoEject status and position before continuing")
        return False
