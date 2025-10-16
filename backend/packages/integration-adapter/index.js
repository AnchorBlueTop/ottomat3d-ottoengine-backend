// packages/integration-adapter/index.js
// Main export for the integration adapter package

// Export the core interface and types
const IPrinterAdapter = require('./IPrinterAdapter');
const { 
    AuthConfig, 
    PrinterInfo, 
    PrinterStatus, 
    JobSpec, 
    JobEvent, 
    AdapterError, 
    PrinterCapabilities 
} = require('./types');

// Export registry functions
const { 
    makeAdapter, 
    getSupportedAdapters, 
    isSupported, 
    getCapabilities,
    registry 
} = require('./registry');

// Export specific adapters (optional - can use registry instead)
const BambuLanAdapter = require('./vendors/bambu/lan');

module.exports = {
    // Core interface and types
    IPrinterAdapter,
    AuthConfig,
    PrinterInfo,
    PrinterStatus,
    JobSpec,
    JobEvent,
    AdapterError,
    PrinterCapabilities,
    
    // Registry functions
    makeAdapter,
    getSupportedAdapters,
    isSupported,
    getCapabilities,
    registry,
    
    // Specific adapters
    BambuLanAdapter
};
