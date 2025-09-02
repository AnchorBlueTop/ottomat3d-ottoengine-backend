"""
UI Module for OTTOMAT3D
Handles all user interface elements, ASCII art, and menu displays
"""

from .display import (
    display_welcome,
    display_main_menu,
    get_menu_choice,
    get_printer_choice,
    display_automation_header,
    display_automation_footer
)

__all__ = [
    'display_welcome',
    'display_main_menu', 
    'get_menu_choice',
    'get_printer_choice',
    'display_automation_header',
    'display_automation_footer'
]
