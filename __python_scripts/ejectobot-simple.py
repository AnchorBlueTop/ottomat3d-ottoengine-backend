#!/usr/bin/env python3
"""
Simplified Ejectobot Automation Script

This script monitors a 3D printer and triggers the Ejectobot when a print completes.
It runs 3 cycles automatically for testing purposes.
"""

import time
import requests
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("ejectobot.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("Ejectobot")

# Configuration - Edit these values as needed
PRINTER_HOST = "pi.local"
EJECTOBOT_HOST = "pi4.local"
PORT = 7125
PRINT_FILE = "v1_sw_5mmcube_1.gcode"
POLLING_INTERVAL = 10
CYCLES = 3  # Hard-coded number of cycles

class MoonrakerAPI:
    """Simple interface for the Moonraker API"""
    
    def __init__(self, host, port=7125, name="Device"):
        self.base_url = f"http://{host}:{port}"
        self.name = name
    
    def get_status(self):
        """Get printer status"""
        try:
            response = requests.get(f"{self.base_url}/printer/objects/query?print_stats")
            return response.json()
        except Exception as e:
            logger.error(f"Error getting {self.name} status: {e}")
            return {}
    
    def is_printing(self):
        """Check if printer is printing"""
        status = self.get_status()
        if "result" in status and "status" in status["result"]:
            state = status["result"]["status"].get("print_stats", {}).get("state", "")
            return state == "printing"
        return False
    
    def is_complete(self):
        """Check if print is complete"""
        status = self.get_status()
        if "result" in status and "status" in status["result"]:
            state = status["result"]["status"].get("print_stats", {}).get("state", "")
            return state == "complete"
        return False
    
    def start_print(self, filename):
        """Start a print job"""
        try:
            data = {"filename": filename}
            response = requests.post(f"{self.base_url}/printer/print/start", json=data)
            logger.info(f"Print job started: {filename} on {self.name}")
            return True
        except Exception as e:
            logger.error(f"Error starting print on {self.name}: {e}")
            return False
    
    def run_macro(self, macro_name):
        """Run a G-code macro with the fixed method"""
        try:
            # Using your fixed method to prevent looping
            response = requests.post(
                f"{self.base_url}/printer/gcode/script?script={macro_name}"
            )
            logger.info(f"Macro executed: {macro_name} on {self.name}")
            return True
        except Exception as e:
            logger.error(f"Error running macro {macro_name} on {self.name}: {e}")
            return False

def monitor_until_complete(printer, ejectobot):
    """Monitor printer until print completes, then trigger ejectobot"""
    logger.info("Starting print monitoring")
    
    was_printing = False
    
    while True:
        is_printing = printer.is_printing()
        is_complete = printer.is_complete()
        
        # Print started
        if is_printing and not was_printing:
            logger.info("Print job in progress")
        
        # Print finished
        if was_printing and not is_printing and is_complete:
            logger.info("Print job completed successfully")
            time.sleep(5)  # Wait for printer to settle
            
            # Trigger the Ejectobot
            logger.info("Triggering START_EJECT macro")
            ejectobot.run_macro("START_EJECT")
            logger.info("Ejection process completed")
            return True
        
        was_printing = is_printing
        time.sleep(POLLING_INTERVAL)

def run_print_cycle(printer, ejectobot, filename, cycle_num, total_cycles):
    """Run a complete print and eject cycle"""
    logger.info(f"Starting cycle {cycle_num} of {total_cycles}")
    
    # Start the print
    if not printer.start_print(filename):
        logger.error("Failed to start print. Aborting cycle.")
        return False
    
    logger.info(f"Print started. Monitoring until completion...")
    
    # Monitor until completion
    result = monitor_until_complete(printer, ejectobot)
    
    if result:
        logger.info(f"Cycle {cycle_num} completed successfully")
    else:
        logger.error(f"Cycle {cycle_num} failed")
    
    return result

def main():
    logger.info("=== Ejectobot Automation Starting ===")
    
    # Initialize API connections
    printer = MoonrakerAPI(PRINTER_HOST, PORT, "3D Printer")
    ejectobot = MoonrakerAPI(EJECTOBOT_HOST, PORT, "Ejectobot")
    
    # Run the specified number of cycles
    success_count = 0
    
    for i in range(1, CYCLES + 1):
        logger.info(f"=== STARTING CYCLE {i} OF {CYCLES} ===")
        
        # Run one cycle
        if run_print_cycle(printer, ejectobot, PRINT_FILE, i, CYCLES):
            success_count += 1
        
        # Wait between cycles (if not the last one)
        if i < CYCLES:
            logger.info(f"Waiting 10 seconds before next cycle...")
            time.sleep(10)
    
    logger.info(f"=== ALL CYCLES COMPLETE: {success_count}/{CYCLES} successful ===")

if __name__ == "__main__":
    main()