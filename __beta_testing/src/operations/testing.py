"""
Testing Module for OTTOMAT3D
Handles connection tests for printers and OttoEject
"""

from printers.printer_factory import PrinterFactory
from ottoeject.controller import OttoEjectController
from utils.logger import setup_logger

def test_printer_connection(config_data):
    """Test connection to printer"""
    print("\n🔧 TESTING PRINTER CONNECTION...")
    print("─" * 40)
    
    logger = setup_logger()
    printer_factory = PrinterFactory()
    
    try:
        printer = printer_factory.create_printer(config_data)
        if not printer:
            print("❌ Failed to create printer instance")
            return False
        
        print(f"Testing connection to {config_data.get('PRINTER_BRAND')} at {config_data.get('PRINTER_IP')}...")
        
        if printer.test_connection():
            print("✅ Printer connection successful!")
            print("Please wait for disconnection....")
            return True
        else:
            print("❌ Printer connection failed!")
            return False
            
    except Exception as e:
        print(f"❌ Error testing printer connection: {e}")
        return False

def test_ottoeject_connection(config_data):
    """Test connection to OttoEject"""
    print("\n🔧 TESTING OTTOEJECT CONNECTION...")
    print("─" * 40)
    
    try:
        ottoeject = OttoEjectController(config_data['OTTOEJECT_IP'])
        
        print(f"Testing connection to OttoEject at {config_data.get('OTTOEJECT_IP')}...")
        
        if ottoeject.test_connection():
            print("✅ OttoEject connection successful!")
            return True
        else:
            print("❌ OttoEject connection failed!")
            return False
            
    except Exception as e:
        print(f"❌ Error testing OttoEject connection: {e}")
        return False
