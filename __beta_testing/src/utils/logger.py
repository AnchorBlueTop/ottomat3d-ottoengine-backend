"""
Logging Utility for OTTOMAT3D Master Script
Provides structured logging to both console and file
"""

import logging
import os
import sys
import platform
from datetime import datetime
from pathlib import Path

class ColoredFormatter(logging.Formatter):
    """Custom formatter with colors for console output"""
    
    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',     # Cyan
        'INFO': '\033[32m',      # Green
        'WARNING': '\033[33m',   # Yellow
        'ERROR': '\033[31m',     # Red
        'CRITICAL': '\033[35m',  # Magenta
        'RESET': '\033[0m'       # Reset
    }
    
    def format(self, record):
        # Add color to levelname
        levelname = record.levelname
        if levelname in self.COLORS:
            colored_levelname = f"{self.COLORS[levelname]}{levelname}{self.COLORS['RESET']}"
            record.levelname = colored_levelname
        
        # Format the message
        formatted = super().format(record)
        
        # Reset levelname for file logging
        record.levelname = levelname
        
        return formatted

def setup_logger(name="OTTOMAT3D", log_level=logging.INFO):
    """
    Set up a logger with both console and file output
    
    Args:
        name: Logger name
        log_level: Logging level (default: INFO)
    
    Returns:
        Configured logger instance
    """
    
    # Create logger
    logger = logging.getLogger(name)
    
    # Avoid duplicate handlers if logger already exists
    if logger.handlers:
        return logger
    
    logger.setLevel(log_level)
    
    # Create logs directory using platform-appropriate location
    system = platform.system()
    
    if system == "Darwin":  # macOS
        # Use Application Support for consistency with config and persistence
        logs_dir = Path.home() / "Library" / "Application Support" / "OTTOMAT3D" / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)
    else:
        # Windows/Linux/Development - keep existing behavior
        script_dir = Path(__file__).parent.parent
        logs_dir = script_dir / "logs"
        logs_dir.mkdir(exist_ok=True)
    
    # Create log filename with timestamp (year_month_date_hour_minute.log)
    timestamp = datetime.now().strftime("%Y_%m_%d_%H_%M")
    log_file = logs_dir / f"{timestamp}.log"
    
    # Console handler with colors
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    
    # File handler
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)  # File gets all messages
    
    # Formatters
    console_format = "%(levelname)s %(asctime)s - %(message)s"
    file_format = "%(levelname)s %(asctime)s [%(name)s] %(filename)s:%(lineno)d - %(message)s"
    
    console_formatter = ColoredFormatter(
        console_format,
        datefmt="%H:%M:%S"
    )
    
    file_formatter = logging.Formatter(
        file_format,
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # Apply formatters
    console_handler.setFormatter(console_formatter)
    file_handler.setFormatter(file_formatter)
    
    # Add handlers
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    # Log the start of session
    logger.info(f"OTTOMAT3D logging started - Log file: {log_file}")
    
    return logger

def log_function_call(func):
    """Decorator to log function calls"""
    def wrapper(*args, **kwargs):
        logger = logging.getLogger("OTTOMAT3D")
        logger.debug(f"Calling {func.__name__} with args={args}, kwargs={kwargs}")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"{func.__name__} completed successfully")
            return result
        except Exception as e:
            logger.error(f"{func.__name__} failed with error: {e}")
            raise
    return wrapper

class StatusLogger:
    """Helper class for logging printer and device status"""
    
    def __init__(self, logger_name="OTTOMAT3D"):
        self.logger = logging.getLogger(logger_name)
    
    def log_printer_status(self, printer_name, status_data):
        """Log printer status in structured format"""
        if not status_data:
            self.logger.warning(f"{printer_name}: No status data available")
            return
        
        # Extract common status fields
        state = status_data.get('status', status_data.get('state', 'UNKNOWN')).upper()
        progress = status_data.get('progress', status_data.get('progress_percent', 0))
        
        # Format progress
        if isinstance(progress, (int, float)):
            progress_str = f"{progress:.1f}%"
        else:
            progress_str = "N/A"
        
        # Log main status
        status_msg = f"{printer_name}: {state} | Progress: {progress_str}"
        
        # Add additional info if available
        if 'current_stage' in status_data:
            status_msg += f" | Stage: {status_data['current_stage']}"
        
        if 'remaining_time_minutes' in status_data:
            remaining = status_data['remaining_time_minutes']
            if remaining is not None:
                status_msg += f" | Remaining: {remaining} min"
        
        self.logger.info(status_msg)
    
    def log_ottoeject_status(self, device_name, status_data):
        """Log OttoEject status in structured format"""
        if not status_data:
            self.logger.warning(f"{device_name}: No status data available")
            return
        
        state = status_data.get('status', status_data.get('state', 'UNKNOWN')).upper()
        self.logger.info(f"{device_name}: {state}")
    
    def log_job_start(self, job_num, total_jobs, filename):
        """Log the start of a print job"""
        self.logger.info("=" * 60)
        self.logger.info(f"🚀 STARTING JOB {job_num}/{total_jobs}: {filename}")
        self.logger.info("=" * 60)
    
    def log_job_complete(self, job_num, total_jobs, filename):
        """Log the completion of a print job"""
        self.logger.info("=" * 60)
        self.logger.info(f"✅ COMPLETED JOB {job_num}/{total_jobs}: {filename}")
        self.logger.info("=" * 60)
    
    def log_ejection_start(self, store_slot, grab_slot=None):
        """Log the start of ejection sequence"""
        if grab_slot:
            self.logger.info(f"🔄 EJECTION SEQUENCE: Store→{store_slot}, Grab→{grab_slot}")
        else:
            self.logger.info(f"🔄 EJECTION SEQUENCE: Store→{store_slot} (Final job)")
    
    def log_macro_execution(self, macro_name, success=True):
        """Log macro execution result"""
        if success:
            self.logger.info(f"✅ Macro executed: {macro_name}")
        else:
            self.logger.error(f"❌ Macro failed: {macro_name}")

def cleanup_old_logs(max_days=2):
    """Clean up log files older than specified days"""
    system = platform.system()
    
    if system == "Darwin":  # macOS
        # Use same Application Support location as logging
        logs_dir = Path.home() / "Library" / "Application Support" / "OTTOMAT3D" / "logs"
    else:
        # Windows/Linux/Development - use project logs directory
        script_dir = Path(__file__).parent.parent
        logs_dir = script_dir / "logs"
    
    if not logs_dir.exists():
        return 0
    
    import time
    current_time = time.time()
    max_age = max_days * 24 * 60 * 60  # Convert days to seconds
    
    # Show cleanup message
    print("🧹 Cleaning up old log files...")
    
    deleted_count = 0
    # Updated glob pattern to match new naming format: YYYY_MM_DD_HH_MM.log
    for log_file in logs_dir.glob("*.log"):
        file_age = current_time - log_file.stat().st_mtime
        if file_age > max_age:
            try:
                log_file.unlink()
                deleted_count += 1
            except OSError:
                pass  # File might be in use
    
    if deleted_count > 0:
        print(f"🗑️  Deleted {deleted_count} old log files (older than {max_days} days)")
    else:
        print("✅ No old log files to clean up")
    
    return deleted_count

# Convenience functions
def log_info(message):
    """Quick info logging"""
    logger = logging.getLogger("OTTOMAT3D")
    logger.info(message)

def log_error(message):
    """Quick error logging"""
    logger = logging.getLogger("OTTOMAT3D")
    logger.error(message)

def log_warning(message):
    """Quick warning logging"""
    logger = logging.getLogger("OTTOMAT3D")
    logger.warning(message)
