"""
Automation Module for OTTOMAT3D
Handles the main automation sequence and job orchestration
"""

import time
from printers.printer_factory import PrinterFactory
from ottoeject.controller import OttoEjectController
from utils.logger import setup_logger
from utils.gcode_processor import process_printer_gcode_files
from .ejection import perform_ejection_sequence

def start_automation_sequence(config_data):
    """Start the automation sequence with print jobs"""
    # Initialize components
    logger = setup_logger()
    printer_factory = PrinterFactory()
    
    # Initialize completed_jobs counter at the start to avoid UnboundLocalError
    completed_jobs = 0
    
    try:
        # Check if this is a printer that needs G-code preprocessing
        printer_brand = config_data.get('PRINTER_BRAND', '')
        if printer_brand in ['Anycubic', 'Elegoo']:
            z_position = "Z200" if printer_brand == 'Anycubic' else "Z205"
            logger.info(f"{printer_brand} printer detected - starting G-code preprocessing ({z_position})...")
            
            # Extract all job filenames
            total_jobs = config_data.get('TOTAL_JOBS', 0)
            job_filenames = []
            
            for job_num in range(1, total_jobs + 1):
                filename = config_data.get(f'JOB_{job_num}_FILENAME')
                if filename:
                    job_filenames.append(filename)
            
            if job_filenames:
                logger.info(f"Found {len(job_filenames)} G-code files to preprocess: {job_filenames}")
                
                # Process all G-code files before starting automation
                printer_ip = config_data.get('PRINTER_IP')
                if not process_printer_gcode_files(printer_ip, printer_brand, job_filenames):
                    logger.error("❌ G-code preprocessing failed - stopping automation")
                    print("❌ G-code preprocessing failed. Automation stopped.")
                    return 0, total_jobs, True
                
                logger.info("✅ G-code preprocessing completed successfully")
            else:
                logger.warning("No job filenames found for G-code preprocessing")
        
        # Create printer instance
        printer = printer_factory.create_printer(config_data)
        if not printer:
            logger.error("Failed to create printer instance")
            return 0, config_data.get('TOTAL_JOBS', 0), True
        
        # Create OttoEject controller
        ottoeject = OttoEjectController(config_data['OTTOEJECT_IP'])
        
        # Test connections
        logger.info("Testing device connections...")
        
        if not printer.test_connection():
            logger.error("Failed to connect to printer")
            return 0, config_data.get('TOTAL_JOBS', 0), True
            
        if not ottoeject.test_connection():
            logger.error("Failed to connect to OttoEject")
            return 0, config_data.get('TOTAL_JOBS', 0), True
        
        # Initial homing
        logger.info("Performing initial OttoEject homing...")
        if not ottoeject.execute_macro("OTTOEJECT_HOME"):
            logger.error("Initial homing failed")
            return 0, config_data.get('TOTAL_JOBS', 0), True
        
        # Process print jobs
        total_jobs = config_data['TOTAL_JOBS']
        
        for job_num in range(1, total_jobs + 1):
            logger.info(f"Starting Job {job_num}/{total_jobs}")
            
            filename = config_data[f'JOB_{job_num}_FILENAME']
            use_ams = config_data.get(f'JOB_{job_num}_USE_AMS', False)
            use_material_station = config_data.get(f'JOB_{job_num}_USE_MATERIAL_STATION', False)
            store_slot = config_data[f'JOB_{job_num}_STORE_SLOT']
            grab_slot = config_data.get(f'JOB_{job_num}_GRAB_SLOT')
            
            # Start print (pass AMS flag for Bambu Lab, Material Station flag for FlashForge)
            if printer_brand == "Bambu Lab":
                if not printer.start_print(filename, is_first_job=(job_num == 1), use_ams=use_ams):
                    logger.error(f"Failed to start Job {job_num}")
                    break
            elif printer_brand == "FlashForge":
                if not printer.start_print(filename, is_first_job=(job_num == 1), use_material_station=use_material_station):
                    logger.error(f"Failed to start Job {job_num}")
                    break
            else:
                if not printer.start_print(filename, is_first_job=(job_num == 1)):
                    logger.error(f"Failed to start Job {job_num}")
                    break
            
            # Wait for completion
            if not printer.wait_for_completion():
                logger.error(f"Job {job_num} failed or did not complete")
                break
            
            # Position bed if needed
            if printer.needs_bed_positioning():
                if not printer.position_bed_for_ejection():
                    logger.error(f"Failed to position bed for Job {job_num}")
                    break
            
            # Perform ejection sequence
            if not perform_ejection_sequence(ottoeject, store_slot, grab_slot, config_data):
                logger.error(f"Ejection sequence failed for Job {job_num}")
                break
            
            # Prusa-specific: Stop paused positioning script after ejection
            if hasattr(printer, 'cleanup_positioning_script'):
                logger.info("Stopping paused positioning script...")
                if not printer.cleanup_positioning_script():
                    logger.error(f"Failed to stop positioning script after Job {job_num}")
                    break
            
            # Prepare printer for next job (clear platform state for FlashForge)
            if job_num < total_jobs:
                if hasattr(printer, 'prepare_for_next_job'):
                    logger.info("Preparing printer for next job...")
                    if not printer.prepare_for_next_job():
                        logger.error(f"Failed to prepare printer for next job after Job {job_num}")
                        break
            
            completed_jobs += 1
            logger.info(f"Job {job_num} completed successfully")
            
            if job_num < total_jobs:
                logger.info("Ready for next job...")
                time.sleep(10)
        
        logger.info(f"Automation completed. {completed_jobs}/{total_jobs} jobs successful.")
        return completed_jobs, total_jobs, False
        
    except KeyboardInterrupt:
        logger.info("Automation stopped by user")
        return completed_jobs, config_data.get('TOTAL_JOBS', 0), True
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return completed_jobs, config_data.get('TOTAL_JOBS', 0), True
    finally:
        # Cleanup: Properly disconnect from printer to avoid timeout errors
        if 'printer' in locals() and printer:
            try:
                logger.info("Disconnecting from printer...")
                if hasattr(printer, 'disconnect'):
                    printer.disconnect()
                    logger.info("✅ Printer disconnected successfully")
                else:
                    logger.info("✅ Printer cleanup completed")
            except Exception as cleanup_error:
                logger.warning(f"Error during printer cleanup: {cleanup_error}")