"""
Setup Module for OTTOMAT3D
Handles printer configuration, job setup, and validation
"""

from .printer_setup import (
    get_supported_printers,
    setup_printer_connection,
    setup_ottoeject_config,
    setup_ottoeject_macros_only,
    modify_printer_details,
    change_ottoeject_ip,
    select_saved_printer_profile,
    change_rack_slot_count,
    get_default_macros
)

from .job_setup import (
    setup_print_jobs,
    get_current_rack_state,
    validate_job_sequence,
    convert_jobs_to_config
)

__all__ = [
    'get_supported_printers',
    'setup_printer_connection',
    'setup_ottoeject_config',
    'setup_ottoeject_macros_only',
    'setup_print_jobs',
    'get_current_rack_state',
    'validate_job_sequence',
    'convert_jobs_to_config',
    'modify_printer_details',
    'change_ottoeject_ip',
    'select_saved_printer_profile',
    'change_rack_slot_count',
    'get_default_macros'
]
