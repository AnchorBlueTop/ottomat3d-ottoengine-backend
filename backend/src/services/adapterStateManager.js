// src/services/adapterStateManager.js
// Enhanced state manager using Integration Adapters
// Maintains persistent adapter instances similar to PrinterStateManager

const logger = require('../utils/logger');
const { makeAdapter, AdapterError, AuthConfig } = require('../../packages/integration-adapter');
const { dbAll } = require('../db/utils');

class AdapterStateManager {
    constructor() {
        this.activeAdapters = new Map(); // printerId -> adapter instance
        this.connectionPromises = new Map(); // printerId -> Promise (for concurrent connection attempts)
        this._isShuttingDown = false;
    }

    /**
     * Initialize adapters for all supported printers from database
     */
    async initializeFromDatabase() {
        try {
            logger.info('[AdapterStateManager] Initializing adapters from database...');
            
            // Get all printers that have adapter support
            const printers = await dbAll(`
                SELECT id, name, brand, model, type, ip_address, access_code, serial_number 
                FROM printers 
                WHERE brand IS NOT NULL AND ip_address IS NOT NULL
            `);
            
            logger.info(`[AdapterStateManager] Found ${printers.length} printers in database`);
            
            for (const printer of printers) {
                try {
                    await this.addAndConnectAdapter(printer);
                } catch (error) {
                    logger.error(`[AdapterStateManager] Failed to initialize adapter for printer ${printer.id}: ${error.message}`);
                }
            }
            
            logger.info(`[AdapterStateManager] Initialization complete. Active adapters: ${this.activeAdapters.size}`);
            
        } catch (error) {
            logger.error('[AdapterStateManager] Error during initialization:', error.message);
        }
    }

    /**
     * Add and connect adapter for a printer
     * @param {object} printerRecord - Database record for the printer
     * @returns {IPrinterAdapter|null} - Connected adapter instance or null
     */
    async addAndConnectAdapter(printerRecord) {
        if (!printerRecord || !printerRecord.id) {
            logger.error('[AdapterStateManager] Invalid printer record provided');
            return null;
        }

        const printerId = parseInt(String(printerRecord.id));
        
        // Check if connection attempt already in progress
        if (this.connectionPromises.has(printerId)) {
            logger.info(`[AdapterStateManager] Connection attempt already in progress for printer ${printerId}`);
            return await this.connectionPromises.get(printerId);
        }

        const connectionPromise = this._doAddAndConnect(printerRecord);
        this.connectionPromises.set(printerId, connectionPromise);
        
        try {
            const adapter = await connectionPromise;
            return adapter;
        } finally {
            this.connectionPromises.delete(printerId);
        }
    }

    async _doAddAndConnect(printerRecord) {
        const printerId = parseInt(String(printerRecord.id));
        
        try {
            // Determine adapter type based on printer brand
            const brand = String(printerRecord.brand || '').toLowerCase().trim();
            
            // Map brand to supported adapters
            let adapterBrand, adapterMode;
            if (brand === 'bambu lab' || brand === 'bambu' || brand === 'bambulab') {
                adapterBrand = 'bambu';
                adapterMode = 'lan';
            } else {
                logger.info(`[AdapterStateManager] Printer ${printerId} brand '${brand}' not supported by adapter system`);
                return null;
            }

            // Close existing adapter if any
            if (this.activeAdapters.has(printerId)) {
                logger.info(`[AdapterStateManager] Replacing existing adapter for printer ${printerId}`);
                await this.removeAdapter(printerId);
            }

            // Create adapter configuration
            const config = new AuthConfig({
                ip: printerRecord.ip_address,
                accessCode: printerRecord.access_code,
                serial: printerRecord.serial_number,
                printerId: printerId,
                name: printerRecord.name,
                model: printerRecord.model,
                debug: process.env.LOG_LEVEL === 'DEBUG' || process.env.BAMBU_API_DEBUG === 'true'
            });

            logger.info(`[AdapterStateManager] Creating ${adapterBrand}/${adapterMode} adapter for printer: ${printerRecord.name} (ID: ${printerId})`);

            // Create adapter instance
            const adapter = makeAdapter(adapterBrand, adapterMode, config);
            
            // Set up event listeners before authentication
            this._setupAdapterListeners(adapter, printerId, printerRecord.name);
            
            // Authenticate and connect
            await adapter.authenticate(config);
            
            if (adapter.isAuthenticated()) {
                this.activeAdapters.set(printerId, adapter);
                logger.info(`[AdapterStateManager] Successfully connected adapter for printer ${printerId}`);
                return adapter;
            } else {
                logger.warn(`[AdapterStateManager] Adapter authentication failed for printer ${printerId}`);
                await adapter.close();
                return null;
            }
            
        } catch (error) {
            logger.error(`[AdapterStateManager] Error connecting adapter for printer ${printerId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Get adapter instance for a printer
     * @param {number} printerId - Printer ID
     * @returns {IPrinterAdapter|null} - Adapter instance or null
     */
    getAdapter(printerId) {
        return this.activeAdapters.get(parseInt(printerId)) || null;
    }

    /**
     * Remove and close adapter for a printer
     * @param {number} printerId - Printer ID
     */
    async removeAdapter(printerId) {
        const adapter = this.activeAdapters.get(parseInt(printerId));
        if (adapter) {
            try {
                logger.info(`[AdapterStateManager] Closing adapter for printer ${printerId}`);
                await adapter.close();
            } catch (error) {
                logger.error(`[AdapterStateManager] Error closing adapter for printer ${printerId}: ${error.message}`);
            }
            this.activeAdapters.delete(parseInt(printerId));
        }
    }

    /**
     * Get all active adapter instances
     * @returns {Map<number, IPrinterAdapter>}
     */
    getAllAdapters() {
        return new Map(this.activeAdapters);
    }

    /**
     * Shutdown all adapters
     */
    async shutdown() {
        logger.info('[AdapterStateManager] Shutting down all adapters...');
        this._isShuttingDown = true;
        
        const shutdownPromises = [];
        for (const [printerId, adapter] of this.activeAdapters) {
            shutdownPromises.push(
                this.removeAdapter(printerId).catch(err => 
                    logger.error(`Error shutting down adapter ${printerId}: ${err.message}`)
                )
            );
        }
        
        await Promise.all(shutdownPromises);
        this.activeAdapters.clear();
        this.connectionPromises.clear();
        
        logger.info('[AdapterStateManager] Shutdown complete');
    }

    /**
     * Set up event listeners for an adapter
     */
    _setupAdapterListeners(adapter, printerId, printerName) {
        adapter.on('connected', () => {
            logger.info(`[AdapterStateManager] [ID:${printerId}] Adapter connected: ${printerName}`);
        });

        adapter.on('disconnected', () => {
            logger.warn(`[AdapterStateManager] [ID:${printerId}] Adapter disconnected: ${printerName}`);
        });

        adapter.on('status_change', (statusData) => {
            logger.debug(`[AdapterStateManager] [ID:${printerId}] Status change: ${statusData.status}`);
        });

        adapter.on('error', (errorData) => {
            logger.error(`[AdapterStateManager] [ID:${printerId}] Adapter error: ${errorData.error_code || 'Unknown'}`);
        });
    }

    /**
     * Health check - verify adapters are still connected
     */
    async healthCheck() {
        const results = {
            total_adapters: this.activeAdapters.size,
            healthy: 0,
            unhealthy: 0,
            details: []
        };

        for (const [printerId, adapter] of this.activeAdapters) {
            try {
                const isHealthy = adapter.isAuthenticated();
                if (isHealthy) {
                    results.healthy++;
                } else {
                    results.unhealthy++;
                }
                
                results.details.push({
                    printer_id: printerId,
                    status: isHealthy ? 'healthy' : 'unhealthy',
                    last_check: new Date().toISOString()
                });
                
            } catch (error) {
                results.unhealthy++;
                results.details.push({
                    printer_id: printerId,
                    status: 'error',
                    error: error.message,
                    last_check: new Date().toISOString()
                });
            }
        }

        return results;
    }
}

// Create singleton instance
const adapterStateManager = new AdapterStateManager();

// Graceful shutdown handling
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down AdapterStateManager gracefully...');
    await adapterStateManager.shutdown();
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down AdapterStateManager gracefully...');
    await adapterStateManager.shutdown();
});

module.exports = adapterStateManager;
