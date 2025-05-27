// src/bambulabs-api/data/printer-info.js

/**
 * Enum-like object for known printer types.
 * Mimics PrinterType from printer_info.py
 */
const PrinterType = Object.freeze({
    P1S: "P1S",
    P1P: "P1P",
    A1: "A1",
    A1_MINI: "A1_MINI",
    X1C: "X1C",
    X1E: "X1E",
    UNKNOWN: "UNKNOWN"
});

/**
 * Enum-like object for nozzle types.
 * Mimics NozzleType from printer_info.py
 */
const NozzleType = Object.freeze({
    STAINLESS_STEEL: "stainless_steel",
    HARDENED_STEEL: "hardened_steel",
    UNKNOWN: "unknown"
});

// We can add firmware version constants later if needed.
// For now, just store the string directly.

module.exports = {
    PrinterType,
    NozzleType
};