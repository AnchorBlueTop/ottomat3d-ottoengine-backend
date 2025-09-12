"""
Macro Utilities for OTTOMAT3D
Provides default macro mappings for different printer brands and models
"""

def get_default_macros(printer_brand, printer_model):
    """
    Get default eject and load macro names for a specific printer
    
    Args:
        printer_brand: Brand name (e.g., "Bambu Lab", "Prusa", etc.)
        printer_model: Model name (e.g., "P1P", "MK4", etc.)
    
    Returns:
        dict: Contains 'EJECT_MACRO' and 'LOAD_MACRO' keys with default values
    """
    
    # Default macro mappings for each printer brand and model
    PRINTER_MACROS = {
        "Bambu Lab": {
            "P1P": {
                "EJECT_MACRO": "EJECT_FROM_BAMBULAB_P_ONE_P",
                "LOAD_MACRO": "LOAD_ONTO_BAMBULAB_P_ONE_P"
            },
            "P1S": {
                "EJECT_MACRO": "EJECT_FROM_BAMBULAB_P_ONE_S", 
                "LOAD_MACRO": "LOAD_ONTO_BAMBULAB_P_ONE_S"
            },
            "A1": {
                "EJECT_MACRO": "EJECT_FROM_BAMBULAB_A_ONE",
                "LOAD_MACRO": "LOAD_ONTO_BAMBULAB_A_ONE"
            },
            "X1C": {
                "EJECT_MACRO": "EJECT_FROM_BAMBULAB_X_ONE_C",
                "LOAD_MACRO": "LOAD_ONTO_BAMBULAB_X_ONE_C"
            }
        },
        "Elegoo": {
            "Centauri Carbon": {
                "EJECT_MACRO": "EJECT_FROM_ELEGOO_CC",
                "LOAD_MACRO": "LOAD_ONTO_ELEGOO_CC"
            }
        },
        "Creality": {
            "K1": {
                "EJECT_MACRO": "EJECT_FROM_CREALITY_K_ONE_C",
                "LOAD_MACRO": "LOAD_ONTO_CREALITY_K_ONE_C"
            },
            "K1C": {
                "EJECT_MACRO": "EJECT_FROM_CREALITY_K_ONE_C",
                "LOAD_MACRO": "LOAD_ONTO_CREALITY_K_ONE_C"
            }
        },
        "FlashForge": {
            "AD5X": {
                "EJECT_MACRO": "EJECT_FROM_FLASHFORGE_AD_FIVE_X",
                "LOAD_MACRO": "LOAD_ONTO_FLASHFORGE_AD_FIVE_X"
            },
            "5M Pro": {
                "EJECT_MACRO": "EJECT_FROM_FLASHFORGE_AD_FIVE_X",  # Same as AD5X
                "LOAD_MACRO": "LOAD_ONTO_FLASHFORGE_AD_FIVE_X"
            }
        },
        "Prusa": {
            "MK3": {
                "EJECT_MACRO": "EJECT_FROM_PRUSA_MK_THREE",
                "LOAD_MACRO": "LOAD_ONTO_PRUSA_MK_THREE"
            },
            "MK4": {
                "EJECT_MACRO": "EJECT_FROM_PRUSA_MK_FOUR",
                "LOAD_MACRO": "LOAD_ONTO_PRUSA_MK_FOUR"
            },
            "Core One": {
                "EJECT_MACRO": "EJECT_FROM_PRUSA_CORE_ONE",
                "LOAD_MACRO": "LOAD_ONTO_PRUSA_CORE_ONE"
            }
        },
        "Anycubic": {
            "Kobra S1": {
                "EJECT_MACRO": "EJECT_FROM_ANYCUBIC_KOBRA_S_ONE",
                "LOAD_MACRO": "LOAD_ONTO_ANYCUBIC_KOBRA_S_ONE"
            }
        }
    }
    
    # Get macros for the specific brand and model
    if printer_brand in PRINTER_MACROS:
        brand_macros = PRINTER_MACROS[printer_brand]
        if printer_model in brand_macros:
            return brand_macros[printer_model].copy()
    
    # Fallback: generate generic macros if not found
    brand_clean = printer_brand.upper().replace(' ', '_')
    model_clean = printer_model.upper().replace(' ', '_').replace('/', '_')
    
    return {
        "EJECT_MACRO": f"EJECT_FROM_{brand_clean}_{model_clean}",
        "LOAD_MACRO": f"LOAD_ONTO_{brand_clean}_{model_clean}"
    }

def get_all_supported_macros():
    """
    Get a list of all supported printer/model combinations with their macros
    
    Returns:
        dict: Complete mapping of all supported combinations
    """
    brands = ["Bambu Lab", "Elegoo", "Creality", "FlashForge", "Prusa", "Anycubic"]
    all_macros = {}
    
    # Example models for each brand (you can expand this)
    example_models = {
        "Bambu Lab": ["P1P", "P1S", "A1", "X1C"],
        "Elegoo": ["Centauri Carbon"],
        "Creality": ["K1", "K1C"],
        "FlashForge": ["AD5X", "5M Pro"],
        "Prusa": ["MK3", "MK4", "Core One"],
        "Anycubic": ["Kobra S1"]
    }
    
    for brand in brands:
        all_macros[brand] = {}
        for model in example_models.get(brand, []):
            all_macros[brand][model] = get_default_macros(brand, model)
    
    return all_macros

def get_door_closing_macro(printer_brand, printer_model):
    """
    Get door closing macro name for printers that have doors
    
    Args:
        printer_brand: Brand name (e.g., "Bambu Lab", "Creality", etc.)
        printer_model: Model name (e.g., "P1S", "K1C", etc.)
    
    Returns:
        str: Door closing macro name, or None if printer doesn't have a door
    """
    
    # Mapping of printer models that have doors to their door closing macros
    # Handle all possible model name variations
    DOOR_CLOSING_MACROS = {
        "Bambu Lab": {
            "P1S": "CLOSE_DOOR_BAMBULAB_P_ONE_S",
            "X1C": "CLOSE_DOOR_BAMBULAB_X_ONE_C"
        },
        "Creality": {
            "K1": "CLOSE_DOOR_CREALITY_K_ONE_C",
            "K1C": "CLOSE_DOOR_CREALITY_K_ONE_C", 
            "K1/K1C": "CLOSE_DOOR_CREALITY_K_ONE_C"  # Handle the combined model name
        },
        "Anycubic": {
            "Kobra S1": "CLOSE_DOOR_ANYCUBIC_KOBRA_S_ONE"
        },
        "Elegoo": {
            "Centauri Carbon": "CLOSE_DOOR_ELEGOO_CC"
        }
    }
    
    if printer_brand in DOOR_CLOSING_MACROS:
        brand_macros = DOOR_CLOSING_MACROS[printer_brand]
        if printer_model in brand_macros:
            return brand_macros[printer_model]
    
    return None

def has_door(printer_brand, printer_model):
    """
    Check if a printer model has a door
    
    Args:
        printer_brand: Brand name (e.g., "Bambu Lab", "Creality", etc.)
        printer_model: Model name (e.g., "P1S", "K1C", etc.)
    
    Returns:
        bool: True if printer has a door, False otherwise
    """
    return get_door_closing_macro(printer_brand, printer_model) is not None

def validate_macro_name(macro_name):
    """
    Validate that a macro name follows the expected format
    
    Args:
        macro_name: Macro name to validate
    
    Returns:
        bool: True if valid format
    """
    if not macro_name:
        return False
    
    # Should start with EJECT_FROM_, LOAD_ONTO_, or CLOSE_DOOR_
    valid_prefixes = ["EJECT_FROM_", "LOAD_ONTO_", "CLOSE_DOOR_"]
    
    return any(macro_name.startswith(prefix) for prefix in valid_prefixes)

def test_door_closing_macros():
    """
    Test function to verify door closing macro mappings work correctly
    
    Returns:
        dict: Test results for all door-equipped printers
    """
    test_cases = [
        ("Bambu Lab", "P1S", "CLOSE_DOOR_BAMBULAB_P_ONE_S"),
        ("Bambu Lab", "X1C", "CLOSE_DOOR_BAMBULAB_X_ONE_C"),
        ("Creality", "K1", "CLOSE_DOOR_CREALITY_K_ONE_C"),
        ("Creality", "K1C", "CLOSE_DOOR_CREALITY_K_ONE_C"),
        ("Creality", "K1/K1C", "CLOSE_DOOR_CREALITY_K_ONE_C"),
        ("Anycubic", "Kobra S1", "CLOSE_DOOR_ANYCUBIC_KOBRA_S_ONE"),
        ("Elegoo", "Centauri Carbon", "CLOSE_DOOR_ELEGOO_CC")
    ]
    
    results = {}
    
    for brand, model, expected_macro in test_cases:
        actual_macro = get_door_closing_macro(brand, model)
        results[f"{brand} {model}"] = {
            'expected': expected_macro,
            'actual': actual_macro,
            'success': actual_macro == expected_macro
        }
    
    return results
