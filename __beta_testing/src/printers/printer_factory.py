"""
Printer Factory and Base Classes for OTTOMAT3D Master Script
Provides unified interface for different printer brands
"""

from abc import ABC, abstractmethod
import time
from utils.logger import setup_logger, StatusLogger

class BasePrinter(ABC):
    """Abstract base class for all printer implementations"""
    
    def __init__(self, config_data):
        """
        Initialize base printer
        
        Args:
            config_data: Configuration dictionary with printer settings
        """
        self.config = config_data
        self.logger = setup_logger()
        self.status_logger = StatusLogger()
        self.ip_address = config_data.get('PRINTER_IP')
        self.brand = config_data.get('PRINTER_BRAND')
        
        # Default timeouts (can be overridden by subclasses)
        self.connection_timeout = 10
        self.status_timeout = 5
        self.command_timeout = 30
        
        # Special handling for first job (Bambu Lab specific but available to all)
        self.first_job_wait_seconds = 0
    
    @abstractmethod
    def test_connection(self):
        """Test connection to printer"""
        pass
    
    @abstractmethod
    def get_status(self):
        """Get current printer status"""
        pass
    
    @abstractmethod
    def start_print(self, filename, is_first_job=False):
        """Start printing a file"""
        pass
    
    @abstractmethod
    def wait_for_completion(self):
        """Wait for current print to complete"""
        pass
    
    def needs_bed_positioning(self):
        """
        Check if this printer type requires bed positioning after print
        
        Returns:
            bool: True if bed positioning is needed
        """
        # Default: most printers need bed positioning
        return True
    
    def position_bed_for_ejection(self):
        """
        Position printer bed for ejection (if supported)
        
        Returns:
            bool: True if positioning successful
        """
        # Default implementation - subclasses should override if needed
        self.logger.info("Bed positioning not implemented for this printer type")
        return True
    
    def _log_status(self, status_data, context=""):
        """Helper method to log printer status"""
        if context:
            context_msg = f" ({context})"
        else:
            context_msg = ""
        
        self.status_logger.log_printer_status(f"{self.brand}{context_msg}", status_data)

class PrinterFactory:
    """Factory class to create appropriate printer instances"""
    
    def __init__(self):
        self.logger = setup_logger()
    
    def create_printer(self, config_data):
        """
        Create a printer instance based on configuration
        
        Args:
            config_data: Configuration dictionary
        
        Returns:
            BasePrinter: Printer instance or None if failed
        """
        printer_class = config_data.get('PRINTER_CLASS')
        printer_brand = config_data.get('PRINTER_BRAND')
        
        self.logger.info(f"Creating printer instance: {printer_brand} ({printer_class})")
        
        if printer_class == "BambuLabPrinter":
            from printers.bambu_printer import BambuLabPrinter
            return BambuLabPrinter(config_data)
        
        elif printer_class == "FlashForgePrinter":
            from printers.flashforge_printer import FlashForgePrinter
            return FlashForgePrinter(config_data)
        
        elif printer_class == "CrealityPrinter":
            from printers.creality_printer import CrealityPrinter
            return CrealityPrinter(config_data)
        
        elif printer_class == "AnycubicPrinter":
            from printers.anycubic_printer import AnycubicPrinter
            return AnycubicPrinter(config_data)
        
        elif printer_class == "ElegooPrinter":
            from printers.elegoo_printer import ElegooPrinter
            return ElegooPrinter(config_data)
        
        elif printer_class == "PrusaPrinter":
            from printers.prusa_printer import PrusaPrinter
            return PrusaPrinter(config_data)
        
        else:
            self.logger.error(f"Unknown printer class: {printer_class}")
            return None

# Common utility functions for printer implementations

def calculate_poll_interval(remaining_time_minutes=None, progress_percent=None):
    """
    Calculate appropriate polling interval based on print status
    
    Args:
        remaining_time_minutes: Estimated time remaining
        progress_percent: Current progress percentage
    
    Returns:
        int: Recommended poll interval in seconds
    """
    # Base interval on remaining time if available
    if remaining_time_minutes is not None:
        if remaining_time_minutes > 10:
            return 60  # 1 minute for long prints
        elif remaining_time_minutes > 2:
            return 30  # 30 seconds for medium prints
        elif remaining_time_minutes >= 0:
            return 10  # 10 seconds for final stages
    
    # Base interval on progress if time not available
    if progress_percent is not None:
        if progress_percent < 90:
            return 30  # 30 seconds for early stages
        elif progress_percent < 99:
            return 15  # 15 seconds for late stages
        else:
            return 5   # 5 seconds for final completion
    
    # Default interval
    return 30

def is_completion_state(state_str, progress_percent=None):
    """
    Check if a state string indicates print completion
    
    Args:
        state_str: State string from printer
        progress_percent: Optional progress percentage
    
    Returns:
        bool: True if state indicates completion
    """
    state_upper = state_str.upper()
    
    # Clear completion states
    completion_states = [
        "FINISH", "FINISHED", "COMPLETE", "COMPLETED", "DONE"
    ]
    
    if state_upper in completion_states:
        return True
    
    # IDLE with high progress typically means completion
    if state_upper == "IDLE" and progress_percent is not None:
        return progress_percent >= 99
    
    return False

def is_error_state(state_str):
    """
    Check if a state string indicates an error condition
    
    Args:
        state_str: State string from printer
    
    Returns:
        bool: True if state indicates error
    """
    state_upper = state_str.upper()
    
    error_states = [
        "ERROR", "FAILED", "FAULT", "PAUSED", "STOPPED", 
        "ATTENTION", "CRITICAL", "OFFLINE"
    ]
    
    return state_upper in error_states

def format_time_remaining(minutes):
    """
    Format time remaining in a readable format
    
    Args:
        minutes: Time remaining in minutes
    
    Returns:
        str: Formatted time string
    """
    if minutes is None:
        return "Unknown"
    
    if minutes < 1:
        return "< 1 min"
    elif minutes < 60:
        return f"{int(minutes)} min"
    else:
        hours = int(minutes // 60)
        mins = int(minutes % 60)
        return f"{hours}h {mins}m"

class PrinterStatusTracker:
    """Helper class to track printer status changes"""
    
    def __init__(self):
        self.last_status = None
        self.last_progress = None
        self.idle_low_progress_count = 0
        self.status_unchanged_count = 0
    
    def update(self, status_data):
        """
        Update status tracking
        
        Args:
            status_data: Current status data from printer
        
        Returns:
            dict: Analysis of status change
        """
        current_status = status_data.get('status', status_data.get('state', 'UNKNOWN')).upper()
        current_progress = status_data.get('progress', status_data.get('progress_percent', 0))
        
        analysis = {
            'status_changed': current_status != self.last_status,
            'progress_changed': current_progress != self.last_progress,
            'potential_issue': False,
            'issue_description': None
        }
        
        # Check for potential issues
        if current_status == "IDLE" and current_progress is not None and current_progress < 10:
            self.idle_low_progress_count += 1
            if self.idle_low_progress_count > 6:
                analysis['potential_issue'] = True
                analysis['issue_description'] = "Printer IDLE with low progress for extended time"
        else:
            self.idle_low_progress_count = 0
        
        # Check for stuck status
        if (current_status == self.last_status and 
            current_progress == self.last_progress and 
            current_status == "PRINTING"):
            self.status_unchanged_count += 1
            if self.status_unchanged_count > 10:
                analysis['potential_issue'] = True
                analysis['issue_description'] = "Status unchanged for extended time"
        else:
            self.status_unchanged_count = 0
        
        # Update tracked values
        self.last_status = current_status
        self.last_progress = current_progress
        
        return analysis
    
    def reset(self):
        """Reset status tracking"""
        self.last_status = None
        self.last_progress = None
        self.idle_low_progress_count = 0
        self.status_unchanged_count = 0
