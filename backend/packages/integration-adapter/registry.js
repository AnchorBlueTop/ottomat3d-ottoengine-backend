// packages/integration-adapter/registry.js
// Registry for creating printer adapters based on brand and mode

const { AdapterError } = require('./types');

// Import available adapters
const BambuLanAdapter = require('./vendors/bambu/lan');

/**
 * Registry of available printer adapters
 */
class AdapterRegistry {
    constructor() {
        this._adapters = new Map();
        this._registerBuiltInAdapters();
    }

    /**
     * Register built-in adapters
     */
    _registerBuiltInAdapters() {
        // Bambu Lab adapters
        this.register('bambu', 'lan', BambuLanAdapter);
        
        // Aliases for common variations
        this.register('bambu lab', 'lan', BambuLanAdapter);
        this.register('bambulab', 'lan', BambuLanAdapter);
        
        // Future adapters would be registered here:
        // this.register('bambu', 'cloud', BambuCloudAdapter);
        // this.register('prusa', 'lan', PrusaLanAdapter);
        // this.register('ultimaker', 'cloud', UltimakerCloudAdapter);
    }

    /**
     * Register an adapter class
     * @param {string} brand - Printer brand (case-insensitive)
     * @param {string} mode - Connection mode (lan, cloud, etc.)
     * @param {class} AdapterClass - Adapter class constructor
     */
    register(brand, mode, AdapterClass) {
        const key = this._makeKey(brand, mode);
        this._adapters.set(key, AdapterClass);
    }

    /**
     * Create an adapter instance
     * @param {string} brand - Printer brand
     * @param {string} mode - Connection mode
     * @param {object} config - Configuration for the adapter
     * @returns {IPrinterAdapter} - Configured adapter instance
     * @throws {AdapterError}
     */
    makeAdapter(brand, mode, config = {}) {
        const key = this._makeKey(brand, mode);
        const AdapterClass = this._adapters.get(key);
        
        if (!AdapterClass) {
            const available = Array.from(this._adapters.keys());
            throw AdapterError.UNSUPPORTED(
                `No adapter found for brand='${brand}', mode='${mode}'. Available: ${available.join(', ')}`
            );
        }
        
        try {
            return new AdapterClass(config);
        } catch (error) {
            throw AdapterError.PRINTER_ERROR(
                `Failed to create adapter for ${brand}/${mode}: ${error.message}`,
                error
            );
        }
    }

    /**
     * Get list of supported brand/mode combinations
     * @returns {Array<{brand: string, mode: string}>}
     */
    getSupportedAdapters() {
        return Array.from(this._adapters.keys()).map(key => {
            const [brand, mode] = key.split('|');
            return { brand, mode };
        });
    }

    /**
     * Check if a brand/mode combination is supported
     * @param {string} brand - Printer brand
     * @param {string} mode - Connection mode
     * @returns {boolean}
     */
    isSupported(brand, mode) {
        const key = this._makeKey(brand, mode);
        return this._adapters.has(key);
    }

    /**
     * Get capabilities for a specific adapter without creating instance
     * @param {string} brand - Printer brand
     * @param {string} mode - Connection mode
     * @returns {Promise<PrinterCapabilities>}
     * @throws {AdapterError}
     */
    async getCapabilities(brand, mode) {
        const key = this._makeKey(brand, mode);
        const AdapterClass = this._adapters.get(key);
        
        if (!AdapterClass) {
            throw AdapterError.UNSUPPORTED(`No adapter found for brand='${brand}', mode='${mode}'`);
        }
        
        // Create temporary instance to get capabilities
        try {
            const tempAdapter = new AdapterClass({});
            return await tempAdapter.getCapabilities();
        } catch (error) {
            throw AdapterError.PRINTER_ERROR(
                `Failed to get capabilities for ${brand}/${mode}: ${error.message}`,
                error
            );
        }
    }

    /**
     * Create normalized key for brand/mode combination
     * @param {string} brand - Printer brand
     * @param {string} mode - Connection mode
     * @returns {string}
     */
    _makeKey(brand, mode) {
        return `${brand.toLowerCase().trim()}|${mode.toLowerCase().trim()}`;
    }
}

// Create singleton registry instance
const registry = new AdapterRegistry();

/**
 * Factory function to create printer adapters
 * @param {string} brand - Printer brand
 * @param {string} mode - Connection mode (lan, cloud, etc.)
 * @param {object} config - Adapter configuration
 * @returns {IPrinterAdapter}
 * @throws {AdapterError}
 */
function makeAdapter(brand, mode, config = {}) {
    return registry.makeAdapter(brand, mode, config);
}

/**
 * Get supported adapter combinations
 * @returns {Array<{brand: string, mode: string}>}
 */
function getSupportedAdapters() {
    return registry.getSupportedAdapters();
}

/**
 * Check if brand/mode is supported
 * @param {string} brand - Printer brand
 * @param {string} mode - Connection mode
 * @returns {boolean}
 */
function isSupported(brand, mode) {
    return registry.isSupported(brand, mode);
}

/**
 * Get capabilities for brand/mode without creating instance
 * @param {string} brand - Printer brand
 * @param {string} mode - Connection mode
 * @returns {Promise<PrinterCapabilities>}
 */
async function getCapabilities(brand, mode) {
    return await registry.getCapabilities(brand, mode);
}

module.exports = {
    AdapterRegistry,
    registry,
    makeAdapter,
    getSupportedAdapters,
    isSupported,
    getCapabilities
};
