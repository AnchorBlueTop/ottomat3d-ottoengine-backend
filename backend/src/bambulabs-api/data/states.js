// src/bambulabs-api/data/states.js

/**
 * Enum-like object for the Gcode State reported by the printer.
 * Mimics GcodeState from states_info.py
 */
const GcodeState = Object.freeze({
    IDLE: "IDLE",
    PREPARE: "PREPARE", // Note: Python file doesn't list this, but might be needed
    RUNNING: "RUNNING",
    PAUSE: "PAUSE",
    FINISH: "FINISH",
    FAILED: "FAILED",
    UNKNOWN: "UNKNOWN"
});

/**
 * Enum-like object for the detailed Print Status reported by the printer.
 * Mimics PrintStatus from states_info.py (stg_cur value)
 * Use numerical values as keys if the MQTT report sends numbers,
 * or string keys if descriptive names are more useful internally.
 * For now, let's map the numbers to names for readability.
 */
const PrintStatus = Object.freeze({
     0: "PRINTING",
     1: "AUTO_BED_LEVELING",
     2: "HEATBED_PREHEATING",
     3: "SWEEPING_XY_MECH_MODE",
     4: "CHANGING_FILAMENT",
     5: "M400_PAUSE",
     6: "PAUSED_FILAMENT_RUNOUT",
     7: "HEATING_HOTEND",
     8: "CALIBRATING_EXTRUSION",
     9: "SCANNING_BED_SURFACE",
    10: "INSPECTING_FIRST_LAYER",
    11: "IDENTIFYING_BUILD_PLATE_TYPE",
    12: "CALIBRATING_MICRO_LIDAR", // Check this mapping if needed
    13: "HOMING_TOOLHEAD",
    14: "CLEANING_NOZZLE_TIP",
    15: "CHECKING_EXTRUDER_TEMPERATURE",
    16: "PAUSED_USER",
    17: "PAUSED_FRONT_COVER_FALLING",
    18: "CALIBRATING_LIDAR", // Check this mapping if needed
    19: "CALIBRATING_EXTRUSION_FLOW",
    20: "PAUSED_NOZZLE_TEMPERATURE_MALFUNCTION",
    21: "PAUSED_HEAT_BED_TEMPERATURE_MALFUNCTION",
    22: "FILAMENT_UNLOADING",
    23: "PAUSED_SKIPPED_STEP",
    24: "FILAMENT_LOADING",
    25: "CALIBRATING_MOTOR_NOISE",
    26: "PAUSED_AMS_LOST",
    27: "PAUSED_LOW_FAN_SPEED_HEAT_BREAK",
    28: "PAUSED_CHAMBER_TEMPERATURE_CONTROL_ERROR",
    29: "COOLING_CHAMBER",
    30: "PAUSED_USER_GCODE",
    31: "MOTOR_NOISE_SHOWOFF",
    32: "PAUSED_NOZZLE_FILAMENT_COVERED_DETECTED",
    33: "PAUSED_CUTTER_ERROR",
    34: "PAUSED_FIRST_LAYER_ERROR",
    35: "PAUSED_NOZZLE_CLOG",
   255: "IDLE", // Special case for idle
   UNKNOWN: "UNKNOWN" // Default/fallback
});

/**
 * Helper function to get PrintStatus name from numerical value.
 * @param {number|null|undefined} value The numerical status code.
 * @returns {string} The corresponding status name or UNKNOWN.
 */
function getPrintStatusName(value) {
    if (value === null || value === undefined || !PrintStatus.hasOwnProperty(value)) {
        return PrintStatus.UNKNOWN;
    }
    return PrintStatus[value];
}


module.exports = {
    GcodeState,
    PrintStatus,
    getPrintStatusName
};