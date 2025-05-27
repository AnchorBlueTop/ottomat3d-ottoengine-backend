// backend/src/services/PrinterStateManager.js

// Manages persistent Printer instances and their MQTT connections.
// Does NOT update the main application database with live status for v0.1.

const bl_api = require('../bambulabs-api'); // Path to your Bambu API library's main export
const logger = require('../utils/logger');
const EventEmitter = require('events'); // For emitting internal events if needed later

// In-memory map to hold active printer instances: { printerId (number): PrinterInstance }
const activePrinters = new Map();

class PrinterStateManager extends EventEmitter {
    constructor() {
        super();
        this.activePrinters = activePrinters; // Make map accessible
        logger.info('[PrinterStateManager-v0.1] Instance created.');
    }

    /**
     * Initializes the manager: creates Printer instances for each Bambu printer
     * from the provided list and attempts to establish persistent MQTT connections.
     * This should be called once on application startup.
     * @param {Array<object>} initialPrintersFromDb - List of printer objects from the database.
     *                                                Each object should have id, type, ip_address,
     *                                                access_code, serial_number, name.
     */
    async initialize(initialPrintersFromDb) {
        logger.info(`[PrinterStateManager-v0.1] Initializing with ${initialPrintersFromDb.length} printers from DB...`);

        for (const printerDbRecord of initialPrintersFromDb) {
            // Ensure printerId is treated as a number for map keys
            const printerId = parseInt(String(printerDbRecord.id));

            if (String(printerDbRecord.brand).toLowerCase() === 'bambu lab') {
                if (this.activePrinters.has(printerId)) {
                    logger.warn(`[PrinterStateManager-v0.1] Instance for printer ID ${printerId} already exists. Skipping re-initialization.`);
                    continue;
                }

                if (!printerDbRecord.ip_address || !printerDbRecord.access_code || !printerDbRecord.serial_number) {
                    logger.error(`[PrinterStateManager-v0.1] Cannot manage printer ID ${printerId} (${printerDbRecord.name || 'N/A'}): Missing IP, Access Code, or Serial in DB record.`);
                    continue; 
                }

                logger.info(`[PrinterStateManager-v0.1] Creating and connecting instance for Bambu printer: ${printerDbRecord.name} (ID: ${printerId}, IP: ${printerDbRecord.ip_address})`);
                
                try {
                    const instance = new bl_api.Printer({
                        ip: printerDbRecord.ip_address,
                        accessCode: printerDbRecord.access_code,
                        serial: printerDbRecord.serial_number,
                        debug: (process.env.LOG_LEVEL === 'DEBUG' || process.env.BAMBU_API_DEBUG === 'true') // Allow more specific debug enabling
                    });

                    this.activePrinters.set(printerId, instance);

                    // Setup basic MQTT event listeners on this instance for logging/debugging.
                    // These do NOT update the main application's database in this v0.1 proxy version.
                    instance.on('mqtt_connect', () => {
                        logger.info(`[PrinterStateManager-v0.1][ID:${printerId}] >>> MQTT Connected: ${printerDbRecord.name}. Requesting full status (pushall).`);
                        if (typeof instance.pushall === 'function') {
                            instance.pushall()
                                .then(() => logger.info(`[PrinterStateManager-v0.1][ID:${printerId}] pushall command sent successfully.`))
                                .catch(err => logger.error(`[PrinterStateManager-v0.1][ID:${printerId}] Error sending pushall: ${err.message}`));
                        } else {
                            logger.error(`[PrinterStateManager-v0.1][ID:${printerId}] Instance for ${printerDbRecord.name} is missing pushall method!`);
                        }
                    });

                    instance.on('mqtt_close', () => {
                        logger.warn(`[PrinterStateManager-v0.1][ID:${printerId}] <<< MQTT Closed: ${printerDbRecord.name}. Library should attempt to reconnect.`);
                        // Clear any locally cached summary if needed, or let getters handle unavailable data
                    });

                    instance.on('mqtt_error', (err) => {
                        logger.error(`[PrinterStateManager-v0.1][ID:${printerId}] !!! MQTT Error for ${printerDbRecord.name}: ${err.message || err}`);
                    });

                    instance.on('update', (data) => { 
                        // 'update' event logging removed for better console output
                    });
                    
                    instance.on('print_error', (errorCode) => { // Listen for specific print error events
                        logger.error(`[PrinterStateManager-v0.1][ID:${printerId}] Print Error Event Code for ${printerDbRecord.name}: ${errorCode}`);
                    });


                    // Attempt to connect the instance
                    if (typeof instance.connect === 'function') {
                        logger.info(`[PrinterStateManager-v0.1][ID:${printerId}] Calling connect() for ${printerDbRecord.name}...`);
                        await instance.connect(); // Assumes connect is async and handles its own internal logic
                        // A small delay might allow the first status messages to come through,
                        // but the instance should manage its own readiness.
                        // await new Promise(resolve => setTimeout(resolve, 2000)); 
                        logger.info(`[PrinterStateManager-v0.1][ID:${printerId}] connect() call completed for ${printerDbRecord.name}. is_connected: ${instance.is_connected ? instance.is_connected() : 'N/A'}`);
                        
                        // Remove post-connect verbose state checks and delay
                    } else {
                        logger.error(`[PrinterStateManager-v0.1][ID:${printerId}] Printer instance for ${printerDbRecord.name} is missing a 'connect' method.`);
                        this.activePrinters.delete(printerId); // Don't keep unconnectable instance
                    }
                } catch (initError) {
                    logger.error(`[PrinterStateManager-v0.1][ID:${printerId}] Error initializing or connecting instance for ${printerDbRecord.name}: ${initError.message}`, initError.stack);
                    if (this.activePrinters.has(printerId)) {
                        this.activePrinters.delete(printerId); // Clean up if instance was added but failed
                    }
                }
            } else {
                logger.info(`[PrinterStateManager-v0.1] Skipping printer ID ${printerDbRecord.id} (${printerDbRecord.name || 'N/A'}) - not 'Bambu Lab' brand (brand is '${printerDbRecord.brand}').`);
            }
        }
        logger.info('[PrinterStateManager-v0.1] Initialization loop for all printers complete.');
    }

    /**
     * Retrieves the active (and hopefully connected) Printer instance for a given printer ID.
     * @param {number | string} printerId
     * @returns {bl_api.Printer | null} The Printer instance or null if not found/managed.
     */
    getInstance(printerId) {
        const id = parseInt(String(printerId)); // Ensure key is a number
        const instance = this.activePrinters.get(id);
        if (!instance) {
            logger.warn(`[PrinterStateManager-v0.1] No managed instance found for printer ID: ${id}`);
            return null;
        }
        
        // Verbose instance state logging removed for clarity
        return instance;
    }

    /**
     * Handles adding a new printer that is registered after the initial startup.
     * @param {object} printerDbRecord - The printer record from the database.
     */
    async addAndConnectPrinter(printerDbRecord) {
        if (!printerDbRecord || !printerDbRecord.id) {
            logger.error('[PSM-AddConnect] Invalid printer record received.'); // Changed to error
            return null;
        }
        const printerId = parseInt(String(printerDbRecord.id));

        // Check if it's a Bambu printer based on brand
        if (!printerDbRecord.brand || String(printerDbRecord.brand).toLowerCase() !== 'bambu lab') {
            logger.info(`[PSM-AddConnect ID:${printerId}] Printer is not 'Bambu Lab' brand (brand: ${printerDbRecord.brand}). Not managing.`);
            return null;
        }

        if (this.activePrinters.has(printerId)) {
            logger.warn(`[PSM-AddConnect ID:${printerId}] Instance already exists. Disconnecting old one before reconnecting.`);
            await this.removePrinterInstance(printerId); // Ensure clean state if re-adding
        }
        
        logger.info(`[PSM-AddConnect ID:${printerId}] Dynamically adding and connecting instance for Bambu printer: ${printerDbRecord.name} (IP: ${printerDbRecord.ip_address})`);
        
        try {
            if (!printerDbRecord.ip_address || !printerDbRecord.access_code || !printerDbRecord.serial_number) {
                logger.error(`[PSM-AddConnect ID:${printerId}] Cannot connect printer: Missing IP, Access Code, or Serial.`);
                return null;
            }

            const instance = new bl_api.Printer({
                ip: printerDbRecord.ip_address,
                accessCode: printerDbRecord.access_code,
                serial: printerDbRecord.serial_number,
                debug: (process.env.LOG_LEVEL === 'DEBUG' || process.env.BAMBU_API_DEBUG === 'true')
            });

            // Store the instance IMMEDIATELY in the map
            this.activePrinters.set(printerId, instance);
            logger.info(`[PSM-AddConnect ID:${printerId}] Instance created and added to activePrinters map.`);

            // Setup listeners
            instance.on('mqtt_connect', () => {
                logger.info(`[PSM-AddConnect ID:${printerId}] dyn-MQTT Connected: ${printerDbRecord.name}. Requesting pushall.`);
                if (typeof instance.pushall === 'function') {
                    instance.pushall()
                        .then(() => logger.info(`[PSM-AddConnect ID:${printerId}] dyn-pushall command sent.`))
                        .catch(err => logger.error(`[PSM-AddConnect ID:${printerId}] dyn-Error sending pushall: ${err.message}`));
                }
            });
            instance.on('mqtt_close', () => { logger.warn(`[PSM-AddConnect ID:${printerId}] dyn-MQTT Closed for ${printerDbRecord.name}.`); });
            instance.on('mqtt_error', (err) => { logger.error(`[PSM-AddConnect ID:${printerId}] dyn-MQTT Error for ${printerDbRecord.name}: ${err.message || err}`); });
            instance.on('update', (data) => { 
                // 'update' event logging removed for better console output
            });
            instance.on('print_error', (errorCode) => { logger.error(`[PSM-AddConnect ID:${printerId}] dyn-Print Error Code for ${printerDbRecord.name}: ${errorCode}`); });

            if (typeof instance.connect === 'function') {
                logger.info(`[PSM-AddConnect ID:${printerId}] Calling connect() for dyn-instance ${printerDbRecord.name}...`);
                await instance.connect();
                logger.info(`[PSM-AddConnect ID:${printerId}] dyn-connect() call completed. Connected: ${instance.is_connected()}`);
                // Remove delay and verbose state check
            } else {
                logger.error(`[PSM-AddConnect ID:${printerId}] dyn-Instance for ${printerDbRecord.name} is missing a 'connect' method.`);
                this.activePrinters.delete(printerId); // Clean up
                return null;
            }
            return instance; // Return the created and connected instance
        } catch (e) {
            logger.error(`[PSM-AddConnect ID:${printerId}] Error in addAndConnectPrinter for ${printerDbRecord.name}: ${e.message}`, e.stack);
            this.activePrinters.delete(printerId); // Ensure cleanup on error
            return null;
        }
    }

    /**
     * Handles removing a printer instance, e.g., when a printer is deleted from the DB.
     * @param {number | string} printerId
     */
    async removePrinterInstance(printerId) {
         const id = parseInt(String(printerId));
         const instance = this.activePrinters.get(id);
         if (instance) {
            logger.info(`[PrinterStateManager-v0.1] Removing and disconnecting instance for printer ID: ${id}`);
            if (typeof instance.disconnect === 'function') {
                try { 
                    await instance.disconnect(); // If disconnect is async
                } catch (e) { logger.warn(`[PrinterStateManager-v0.1] Error during instance.disconnect for ${id}: ${e.message}`);}
            }
            if (typeof instance.removeAllListeners === 'function') {
                instance.removeAllListeners(); // Clean up listeners on the instance itself
            }
            this.activePrinters.delete(id);
            logger.info(`[PrinterStateManager-v0.1] Instance for printer ID ${id} removed.`);
            return true;
         }
         logger.warn(`[PrinterStateManager-v0.1] removePrinterInstance: No instance found for ID ${id}.`);
         return false;
    }

    /**
     * Gracefully disconnects all managed printer instances on shutdown.
     */
    async gracefulShutdown() {
        logger.info('[PrinterStateManager-v0.1] Initiating graceful shutdown: disconnecting all printers...');
        await this.disconnectAll();
        logger.info('[PrinterStateManager-v0.1] Graceful shutdown complete.');
    }
}

// Export a single instance of the manager
const managerInstance = new PrinterStateManager();

module.exports = managerInstance;