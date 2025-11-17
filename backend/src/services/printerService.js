// src/services/printerService.js
// Enhanced printer service using Integration Adapters (Adapter-Only Implementation)
// Legacy fallback methods have been removed - all operations now use the Integration Adapter pattern

const db = require('../db');
const { dbGet, dbAll, dbRun } = require('../db/utils');
const logger = require('../utils/logger');
const adapterStateManager = require('./adapterStateManager');
const { AdapterError, JobSpec } = require('../../packages/integration-adapter');

// Fallback to BambuStateManager for Bambu Lab printers (MQTT connections)
const bambuStateManager = require('./bambuStateManager');

// Import Bambu Labs API for direct connection tests (used in connect())
const bl_api = require('../bambulabs-api');

// Helper to check attribute existence safely
function hasattr(obj, attr) {
    if (!obj) return false;
    return typeof obj[attr] === 'function' || obj[attr] !== undefined;
}

// Normalize brand string to canonical DB value matching frontend constants
function printerBrand(brand) {
    const raw = String(brand || '').toLowerCase().trim();
    if (!raw) return null;
    // unify separators to underscore and collapse spaces/hyphens
    const compact = raw.replace(/\s+/g, '_').replace(/-/g, '_');
    if (compact === 'bambu_lab' || compact === 'bambu' || compact === 'bambulab') return 'bambu_lab';
    if (compact === 'klipper' || compact === 'moonraker' || compact === 'klipper_moonraker') return 'klipper';
    return compact;
}

const printerService = {
    /**
     * Attempt to connect to a printer without persisting it (on-demand test).
     * For Bambu Lab, uses a temporary MQTT connection and disconnects immediately.
     * Other brands return Not Implemented for now.
     * @param {{brand:string, ip_address:string, access_code?:string, serial_number?:string}} payload
     * @returns {Promise<{success:boolean, status?:string, message:string}>}
     */
    async connect(payload) {
        try {
            const { brand, ip_address, access_code, serial_number, serial_code, check_code, api_key } = payload || {};
            if (!brand || !ip_address) {
                return { success: false, message: 'brand and ip_address are required.' };
            }
            const brandKey = printerBrand(brand);

            // BAMBU LAB - Use legacy MQTT API
            if (brandKey === 'bambu_lab') {
                if (!access_code || !serial_number) {
                    return { success: false, message: 'For Bambu Lab, access_code and serial_number are required.' };
                }
                let instance;
                try {
                    instance = new bl_api.Printer({
                        ip: ip_address,
                        accessCode: access_code,
                        serial: serial_number,
                        debug: (process.env.LOG_LEVEL === 'DEBUG' || String(process.env.BAMBU_API_DEBUG).toLowerCase() === 'true')
                    });

                    // Add error handlers to prevent crashes during connection test
                    instance.on('error', (err) => {
                        logger.error(`[PrinterService] Test connection MQTT error: ${err.message || err}`);
                    });
                    instance.on('mqtt_error', (err) => {
                        logger.error(`[PrinterService] Test connection MQTT error: ${err.message || err}`);
                    });
                } catch (e) {
                    logger.error(`[PrinterService] connect: Failed to create Bambu printer instance: ${e.message}`);
                    return { success: false, message: `Failed to initialize printer instance: ${e.message}` };
                }

                try {
                    const TIMEOUT_MS = Number.parseInt(process.env.PRINTER_CONNECT_TIMEOUT_MS || '20000', 10);
                    const withTimeout = (promise, ms, label) => Promise.race([
                        promise,
                        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
                    ]);

                    if (typeof instance.connect === 'function') {
                        await withTimeout(instance.connect(), TIMEOUT_MS, 'Connect');
                    }
                    const connected = typeof instance.is_connected === 'function' ? instance.is_connected() : false;
                    if (connected) {
                        const pushMs = Number.parseInt(process.env.PRINTER_PUSHALL_TIMEOUT_MS || String(TIMEOUT_MS), 10);
                        try { if (typeof instance.pushall === 'function') await withTimeout(instance.pushall(), pushMs, 'Pushall'); } catch (_) {}
                        return { success: true, status: 'ONLINE', message: 'Connection successful.' };
                    } else {
                        return { success: false, status: 'OFFLINE', message: 'Connection failed. Check printer details.' };
                    }
                } catch (e) {
                    logger.error(`[PrinterService] connect: Error connecting to Bambu at ${ip_address}: ${e.message}`);
                    return { success: false, status: 'OFFLINE', message: 'Connection failed. Check printer details.' };
                } finally {
                    // Disconnect MQTT - keep error handlers attached to prevent crashes
                    try {
                        if (instance && typeof instance.disconnect === 'function') {
                            await instance.disconnect();
                        }
                    } catch (cleanupError) {
                        logger.debug(`[PrinterService] Error during disconnect: ${cleanupError.message}`);
                    }
                }
            }

            // ALL OTHER BRANDS - Use Integration Adapters
            logger.info(`[PrinterService] Testing connection for ${brandKey} printer at ${ip_address}`);

            // Map brand to adapter parameters
            const { makeAdapter: makeAdapterFn } = require('../../packages/integration-adapter');
            let adapterBrand, adapterMode;

            // Map canonical brand to adapter name
            switch (brandKey) {
                case 'flashforge':
                    adapterBrand = 'flashforge';
                    adapterMode = 'hybrid';
                    break;
                case 'prusa':
                    adapterBrand = 'prusa';
                    adapterMode = 'lan';
                    break;
                case 'creality':
                    adapterBrand = 'creality';
                    adapterMode = 'websocket';
                    break;
                case 'anycubic':
                    adapterBrand = 'anycubic';
                    adapterMode = 'moonraker';
                    break;
                case 'elegoo':
                    adapterBrand = 'elegoo';
                    adapterMode = 'websocket';
                    break;
                default:
                    logger.warn(`[PrinterService] Brand '${brandKey}' not supported by adapter system`);
                    return { success: false, message: `Printer brand '${brand}' is not yet supported.` };
            }

            const tempConfig = {
                ip: ip_address,
                accessCode: access_code,
                serial: serial_number,
                serialCode: serial_code,
                checkCode: check_code,
                apiKey: api_key
            };

            // Try to create and test adapter
            try {
                logger.debug(`[PrinterService] Creating ${adapterBrand}/${adapterMode} adapter for connection test`);
                const adapter = makeAdapterFn(adapterBrand, adapterMode);

                if (!adapter) {
                    return { success: false, message: `No adapter available for brand '${brand}'.` };
                }

                // Try to authenticate
                await adapter.authenticate(tempConfig);

                // Check if authenticated
                if (adapter.isAuthenticated()) {
                    // Try to get status as connection test
                    try {
                        await adapter.getStatus();
                        // Clean up
                        await adapter.close();
                        return { success: true, status: 'ONLINE', message: 'Connection successful.' };
                    } catch (statusError) {
                        // Clean up
                        await adapter.close();
                        logger.warn(`[PrinterService] Authenticated but status check failed: ${statusError.message}`);
                        return { success: false, status: 'OFFLINE', message: 'Connection failed. Check printer details.' };
                    }
                } else {
                    await adapter.close();
                    return { success: false, status: 'OFFLINE', message: 'Authentication failed. Please check credentials.' };
                }
            } catch (adapterError) {
                logger.error(`[PrinterService] Adapter connection test failed: ${adapterError.message}`);
                return { success: false, status: 'OFFLINE', message: 'Connection failed. Check printer details.' };
            }

        } catch (e) {
            logger.error(`[PrinterService] connect unexpected error: ${e.message}`);
            return { success: false, message: 'Unexpected server error during connect.' };
        }
    },

    // --- Enhanced CRUD with Adapter Support ---

    async createPrinter(printerData) {
        const {
            name,
            brand = null,
            model = null,
            type = null,
            ip_address,
            // Authentication fields (brand-specific)
            access_code = null,      // Bambu Lab
            serial_number = null,    // Bambu Lab
            serial_code = null,      // FlashForge
            check_code = null,       // FlashForge
            api_key = null,          // Prusa
            // Note: Creality, Anycubic, Elegoo only require ip_address
            build_volume = null
        } = printerData;

        if (!name || !ip_address) {
            throw new Error('Missing required fields: Name, IP Address.');
        }

        // Normalize brand and validate required fields for supported printers (brand-based)
        const brandCanonical = printerBrand(brand);

        // Brand-specific auth validation
        if (brandCanonical === 'bambu_lab' && (!access_code || !serial_number)) {
            throw new Error('For Bambu Lab printers, access_code and serial_number are required.');
        }
        if (brandCanonical === 'flashforge' && (!serial_code || !check_code)) {
            throw new Error('For FlashForge printers, serial_code and check_code are required.');
        }
        if (brandCanonical === 'prusa' && !api_key) {
            throw new Error('For Prusa printers, api_key is required.');
        }

        const buildVolumeJsonString = build_volume ? JSON.stringify(build_volume) : null;

        const sql = `
            INSERT INTO printers (name, brand, model, type, ip_address, access_code, serial_number, serial_code, check_code, api_key, build_volume_json, current_filament_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        `;
    const params = [name, brandCanonical, model, type, ip_address, access_code, serial_number, serial_code, check_code, api_key, buildVolumeJsonString];
        
        try {
            logger.debug(`[PrinterService] Creating printer: ${name}`);
            const result = await dbRun(sql, params);
            
            if (result.lastID) {
                const newPrinterRecord = await this.getPrinterById(result.lastID);
                
                if (newPrinterRecord) {
                    // Try adapter first, fallback to original system
                    const adapter = await adapterStateManager.addAndConnectAdapter(newPrinterRecord);
                    
                    if (!adapter && String(newPrinterRecord.brand || '').toLowerCase() === 'bambu_lab') {
                        // Fallback to original bambuStateManager
                        logger.info(`[PrinterService] Adapter failed, falling back to bambuStateManager for printer ${newPrinterRecord.id}`);
                        bambuStateManager.addAndConnectPrinter(newPrinterRecord)
                            .catch(err => logger.error(`bambuStateManager fallback failed: ${err.message}`));
                    }
                }
                
                return newPrinterRecord;
            }
            return null;
            
        } catch (error) {
            logger.error(`[PrinterService] Error creating printer "${name}": ${error.message}`);
            throw error;
        }
    },

    async getAllPrinters() {
        logger.info('[PrinterService] Getting live details for ALL printers using adapters...');

        try {
            const allPrinterRecords = await dbAll('SELECT id FROM printers');

            // Use allSettled to handle individual printer failures gracefully
            const printerDetailsPromises = allPrinterRecords.map(p =>
                this.getPrinterLiveDetails(p.id)
            );

            const results = await Promise.allSettled(printerDetailsPromises);

            const printers = results
                .filter(res => res.status === 'fulfilled' && res.value && res.value.data)
                .map(res => res.value.data);

            logger.info(`[PrinterService] Successfully retrieved ${printers.length}/${allPrinterRecords.length} printers`);
            return printers;

        } catch (error) {
            logger.error(`[PrinterService] Error fetching all printers: ${error.message}`);
            throw error;
        }
    },

    async getPrinterById(id) {
        try {
            return await dbGet(
                'SELECT id, name, brand, model, type, ip_address, access_code, serial_number, serial_code, check_code, api_key, build_volume_json, current_filament_json FROM printers WHERE id = ?',
                [id]
            );
        } catch (error) {
            logger.error(`[PrinterService] Error fetching printer by ID ${id}: ${error.message}`);
            throw error;
        }
    },
    
    async updatePrinter(id, updateData) {
        const { build_volume, filament, ...otherUpdates } = updateData;
        const allowedDirectUpdates = { ...otherUpdates };
        const validDirectFields = ['name', 'brand', 'model', 'type', 'ip_address', 'access_code', 'serial_number', 'serial_code', 'check_code', 'api_key'];
        
        for (const key in allowedDirectUpdates) {
            if (!validDirectFields.includes(key)) delete allowedDirectUpdates[key];
        }

        // Normalize brand if present
        if (Object.prototype.hasOwnProperty.call(allowedDirectUpdates, 'brand')) {
            allowedDirectUpdates.brand = printerBrand(allowedDirectUpdates.brand);
        }

        const updateFieldsSqlParts = [];
        const paramsForSql = [];
        
        for (const field in allowedDirectUpdates) {
            updateFieldsSqlParts.push(`${field} = ?`);
            paramsForSql.push(allowedDirectUpdates[field]);
        }
        
        if (build_volume !== undefined) {
            updateFieldsSqlParts.push(`build_volume_json = ?`);
            paramsForSql.push(build_volume ? JSON.stringify(build_volume) : null);
        }
        
        if (filament !== undefined) {
            let fo = null;
            if (Array.isArray(filament) && filament.length > 0) fo = filament[0];
            else if (filament && typeof filament === 'object') fo = filament;
            updateFieldsSqlParts.push(`current_filament_json = ?`);
            paramsForSql.push(fo ? JSON.stringify(fo) : null);
        }
        
        if (updateFieldsSqlParts.length === 0) {
            return await this.getPrinterById(id);
        }
        
        paramsForSql.push(id);
        const sql = `UPDATE printers SET ${updateFieldsSqlParts.join(', ')} WHERE id = ?`;
        
        try {
            await dbRun(sql, paramsForSql);
            const updatedPrinterRecord = await this.getPrinterById(id);
            
            // If connection-critical info changed, refresh adapter/connection
            if (updatedPrinterRecord && 
                (allowedDirectUpdates.ip_address || allowedDirectUpdates.access_code || allowedDirectUpdates.serial_number)) {
                
                logger.info(`[PrinterService] Connection details changed for printer ${id}. Refreshing adapter...`);
                
                // Remove and reconnect adapter
                await adapterStateManager.removeAdapter(id);
                await adapterStateManager.addAndConnectAdapter(updatedPrinterRecord);
                
                // Also update original system if needed
                const brandLower = String(updatedPrinterRecord.brand || '').toLowerCase();
                if (brandLower === 'bambu_lab') {
                    await bambuStateManager.removePrinterInstance(id);
                    await bambuStateManager.addAndConnectPrinter(updatedPrinterRecord);
                }
            }
            
            return updatedPrinterRecord;
            
        } catch (error) {
            logger.error(`[PrinterService] Error updating printer ${id}: ${error.message}`);
            throw error;
        }
    },

    async deletePrinter(id) {
        try {
            // Remove from both adapter manager and original system
            await adapterStateManager.removeAdapter(id);
            await bambuStateManager.removePrinterInstance(id);
            
            const result = await dbRun('DELETE FROM printers WHERE id = ?', [id]);
            logger.info(`[PrinterService] Printer ID ${id} deleted from DB (changes: ${result.changes}).`);
            return result.changes > 0;
            
        } catch (error) {
            logger.error(`[PrinterService] Error deleting printer ${id}: ${error.message}`);
            throw error;
        }
    },

    // --- Enhanced Live Details with Adapter Support ---
    
    async getPrinterLiveDetails(printerId) {
        logger.info(`[PrinterService] Getting live details for printer ID: ${printerId} using adapters`);
        
        const printerFromDb = await this.getPrinterById(printerId);
        if (!printerFromDb) {
            return { success: false, message: `Printer ${printerId} not found in DB.`, data: null };
        }

        // Try adapter first
        const adapter = adapterStateManager.getAdapter(printerId);
        
        if (adapter && adapter.isAuthenticated()) {
            try {
                const status = await adapter.getStatus();
                const info = await adapter.getPrinterInfo();
                
                const responseData = {
                    id: parseInt(printerFromDb.id),
                    name: info.name,
                    brand: printerFromDb.brand,
                    model: info.model,
                    type: info.type,
                    status: status.status,
                    current_stage: status.current_stage,
                    progress_percent: status.progress_percent,
                    remaining_time_minutes: status.remaining_time_minutes,
                    layer_progress: status.layer_progress,
                    filament: status.filament,
                    build_volume: printerFromDb.build_volume_json ? JSON.parse(printerFromDb.build_volume_json) : null,
                    ip_address: printerFromDb.ip_address,
                    serial_number: printerFromDb.serial_number,
                    access_code: printerFromDb.access_code,
                    bed_temperature: status.temperatures.bed,
                    nozzle_temperature: status.temperatures.nozzle,
                    // Additional adapter info
                    adapter_source: 'integration_adapter',
                    last_update: status.last_update
                };
                
                return { success: true, data: responseData };
                
            } catch (error) {
                logger.error(`[PrinterService] Error getting status from adapter: ${error.message}`);
            }
        }

        // FALLBACK: Try bambuStateManager for Bambu Lab printers
        logger.info(`[PrinterService] No adapter available, trying bambuStateManager fallback for printer ${printerId}`);
        
        let printerInstance = bambuStateManager.getInstance(printerId);
        
        // If no instance exists, try to create one
        if (!printerInstance) {
            logger.warn(`[PrinterService] No bambuStateManager instance for printer ${printerId}, attempting to create one`);
            const printerRecord = await this.getPrinterById(printerId);
            if (printerRecord) {
                try {
                    await bambuStateManager.addAndConnectPrinter(printerRecord);
                    printerInstance = bambuStateManager.getInstance(printerId);
                    logger.info(`[PrinterService] Successfully created bambuStateManager instance for printer ${printerId}`);
                } catch (error) {
                    logger.error(`[PrinterService] Failed to create bambuStateManager instance: ${error.message}`);
                }
            }
        }
        
        if (printerInstance) {
            try {
                // Add timeout to prevent hanging
                const timeout = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('bambuStateManager timeout')), 5000);
                });
                
                const statusPromise = Promise.resolve({
                    status: printerInstance.get_state ? printerInstance.get_state() : 'UNKNOWN',
                    bed_temperature: printerInstance.get_bed_temperature ? printerInstance.get_bed_temperature() : null,
                    nozzle_temperature: printerInstance.get_nozzle_temperature ? printerInstance.get_nozzle_temperature() : null,
                    progress: printerInstance.get_progress ? printerInstance.get_progress() : 0
                });
                const statusResult = await Promise.race([statusPromise, timeout]);
                
                const responseData = {
                    id: parseInt(printerFromDb.id),
                    name: printerFromDb.name,
                    brand: printerFromDb.brand,
                    model: printerFromDb.model,
                    type: printerFromDb.type,
                    status: statusResult.status || 'UNKNOWN',
                    current_stage: 'N/A',
                    progress_percent: statusResult.progress || 0,
                    remaining_time_minutes: 0,
                    layer_progress: null,
                    filament: null,
                    build_volume: printerFromDb.build_volume_json ? JSON.parse(printerFromDb.build_volume_json) : null,
                    ip_address: printerFromDb.ip_address,
                    serial_number: printerFromDb.serial_number,
                    access_code: printerFromDb.access_code,
                    bed_temperature: statusResult.bed_temperature,
                    nozzle_temperature: statusResult.nozzle_temperature,
                    // Fallback source
                    adapter_source: 'printer_state_manager_fallback',
                    last_update: new Date().toISOString()
                };
                
                logger.info(`[PrinterService] bambuStateManager fallback successful for printer ${printerId}`);
                return { success: true, data: responseData };
                
            } catch (error) {
                logger.error(`[PrinterService] bambuStateManager fallback failed: ${error.message}`);
            }
        }

        // No connection available - return DB data with OFFLINE status
        logger.warn(`[PrinterService] No live connection available for printer ${printerId}, returning DB data with OFFLINE status`);

        const responseData = {
            id: parseInt(printerFromDb.id),
            name: printerFromDb.name,
            brand: printerFromDb.brand,
            model: printerFromDb.model,
            type: printerFromDb.type,
            status: 'OFFLINE',
            current_stage: 'N/A',
            progress_percent: 0,
            remaining_time_minutes: 0,
            layer_progress: null,
            filament: null,
            build_volume: printerFromDb.build_volume_json ? JSON.parse(printerFromDb.build_volume_json) : null,
            ip_address: printerFromDb.ip_address,
            serial_number: printerFromDb.serial_number,
            access_code: printerFromDb.access_code,
            bed_temperature: null,
            nozzle_temperature: null,
            adapter_source: 'database_only',
            last_update: new Date().toISOString()
        };

        return { success: true, data: responseData };
    },

    // --- Enhanced Print Control with Adapter Support ---
    
    async commandStartPrint(printerId, filename, options = {}) {
        logger.info(`[PrinterService] Starting print for printer ID: ${printerId}, File: ${filename}`);
        
        // Try adapter first
        const adapter = adapterStateManager.getAdapter(printerId);
        
        if (adapter && adapter.isAuthenticated()) {
            try {
                const spec = new JobSpec({
                    filename: filename,
                    localPath: options.localPath, // For upload if needed
                    plate_id: options.plate_idx,
                    use_ams: options.useAms !== undefined ? options.useAms : true,
                    ams_mapping: options.amsMapping || [0],
                    skip_objects: options.skip_objects || null
                });
                
                const result = await adapter.start(spec);
                
                if (result.success) {
                    return { 
                        success: true, 
                        message: `Print started: ${filename}`,
                        job_id: result.jobId,
                        adapter_source: 'integration_adapter'
                    };
                } else {
                    return { 
                        success: false, 
                        message: result.message || 'Print start failed',
                        adapter_source: 'integration_adapter'
                    };
                }
                
            } catch (error) {
                if (error instanceof AdapterError && error.type === 'UNSUPPORTED') {
                    return { success: false, message: 'Start print not supported by this printer' };
                } else {
                    logger.error(`[PrinterService] Adapter start print error: ${error.message}`);
                }
            }
        }

        // FALLBACK: Try bambuStateManager for Bambu Lab printers
        logger.info(`[PrinterService] No adapter available, trying bambuStateManager fallback for printer ${printerId}`);
        
        const printerInstance = bambuStateManager.getInstance(printerId);
        if (printerInstance) {
            try {
                // Add timeout to prevent hanging
                const timeout = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('bambuStateManager start timeout')), 10000);
                });
                
                // Check if start_print method exists
                if (!printerInstance.start_print || typeof printerInstance.start_print !== 'function') {
                    throw new Error('bambuStateManager instance does not have start_print method');
                }
                
                // Use bambuStateManager start method
                logger.debug(`[PrinterService] Calling start_print with filename: ${filename}`);
                const startPromise = Promise.resolve(printerInstance.start_print(filename));
                const result = await Promise.race([startPromise, timeout]);
                
                logger.info(`[PrinterService] bambuStateManager start print successful for printer ${printerId}`);
                return {
                    success: true,
                    message: `Print started via bambuStateManager: ${filename}`,
                    adapter_source: 'printer_state_manager_fallback'
                };
                
            } catch (error) {
                logger.error(`[PrinterService] bambuStateManager start print failed: ${error.message}`);
                return {
                    success: false,
                    message: `bambuStateManager start failed: ${error.message}`,
                    adapter_source: 'printer_state_manager_fallback'
                };
            }
        }

        // No connection available - provide detailed debugging info
        const debugInfo = {
            adapterId: adapter ? 'exists' : 'null',
            adapterAuth: adapter ? adapter.isAuthenticated() : 'n/a',
            printerStateManager: bambuStateManager.getInstance(printerId) ? 'exists' : 'null'
        };
        
        logger.error(`[PrinterService] No connection available for printer ${printerId}. Debug: ${JSON.stringify(debugInfo)}`);
        
        return { 
            success: false, 
            message: 'Failed to start print: No adapter available for this printer'
        };
    },

    async commandPausePrint(printerId) {
        logger.info(`[PrinterService] Pausing print for printer ID: ${printerId}`);
        
        const adapter = adapterStateManager.getAdapter(printerId);
        
        if (adapter && adapter.isAuthenticated()) {
            try {
                const result = await adapter.pause();
                return {
                    success: result.success,
                    message: result.message || (result.success ? 'Print paused' : 'Pause failed'),
                    adapter_source: 'integration_adapter'
                };
                
            } catch (error) {
                if (error instanceof AdapterError && error.type === 'UNSUPPORTED') {
                    return { success: false, message: 'Pause not supported by this printer' };
                }
                logger.error(`[PrinterService] Adapter pause error: ${error.message}`);
                return { success: false, message: error.message };
            }
        }

        // No adapter available
        return { success: false, message: 'No adapter available for this printer' };
    },

    async commandResumePrint(printerId) {
        logger.info(`[PrinterService] Resuming print for printer ID: ${printerId}`);
        
        const adapter = adapterStateManager.getAdapter(printerId);
        
        if (adapter && adapter.isAuthenticated()) {
            try {
                const result = await adapter.resume();
                return {
                    success: result.success,
                    message: result.message || (result.success ? 'Print resumed' : 'Resume failed'),
                    adapter_source: 'integration_adapter'
                };
                
            } catch (error) {
                if (error instanceof AdapterError && error.type === 'UNSUPPORTED') {
                    return { success: false, message: 'Resume not supported by this printer' };
                }
                logger.error(`[PrinterService] Adapter resume error: ${error.message}`);
                return { success: false, message: error.message };
            }
        }

        // No adapter available
        return { success: false, message: 'No adapter available for this printer' };
    },

    async commandStopPrint(printerId) {
        logger.info(`[PrinterService] Stopping print for printer ID: ${printerId}`);
        
        const adapter = adapterStateManager.getAdapter(printerId);
        
        if (adapter && adapter.isAuthenticated()) {
            try {
                const result = await adapter.cancel();
                return {
                    success: result.success,
                    message: result.message || (result.success ? 'Print stopped' : 'Stop failed'),
                    adapter_source: 'integration_adapter'
                };
                
            } catch (error) {
                if (error instanceof AdapterError && error.type === 'UNSUPPORTED') {
                    return { success: false, message: 'Stop not supported by this printer' };
                }
                logger.error(`[PrinterService] Adapter stop error: ${error.message}`);
                return { success: false, message: error.message };
            }
        }

        // No adapter available
        return { success: false, message: 'No adapter available for this printer' };
    },

    async commandSendGcode(printerId, gcodeString) {
        logger.info(`[PrinterService] Sending G-code to printer ID: ${printerId}`);
        
        const adapter = adapterStateManager.getAdapter(printerId);
        
        if (adapter && adapter.isAuthenticated()) {
            try {
                const result = await adapter.sendGcode(gcodeString);
                return {
                    success: result.success,
                    message: result.message || (result.success ? 'G-code sent' : 'G-code send failed'),
                    adapter_source: 'integration_adapter'
                };
                
            } catch (error) {
                if (error instanceof AdapterError && error.type === 'UNSUPPORTED') {
                    return { success: false, message: 'G-code sending not supported by this printer' };
                }
                logger.error(`[PrinterService] Adapter G-code error: ${error.message}`);
                return { success: false, message: error.message };
            }
        }

        // No adapter available
        return { success: false, message: 'No adapter available for this printer' };
    },

    async commandUploadFile(printerId, localFilePathOnServer, remoteFilenameOnPrinter) {
        logger.info(`[PrinterService] Uploading file for printer ID: ${printerId}`);
        
        const adapter = adapterStateManager.getAdapter(printerId);
        
        if (adapter && adapter.isAuthenticated()) {
            try {
                const spec = new JobSpec({
                    filename: remoteFilenameOnPrinter,
                    localPath: localFilePathOnServer
                });
                
                const result = await adapter.upload(spec);
                return {
                    success: result.success,
                    message: result.message || (result.success ? 'File uploaded' : 'Upload failed'),
                    adapter_source: 'integration_adapter'
                };
                
            } catch (error) {
                if (error instanceof AdapterError && error.type === 'UNSUPPORTED') {
                    return { 
                        success: false, 
                        message: 'File upload not supported by this printer',
                        statusCode: 501
                    };
                }
                logger.error(`[PrinterService] Adapter upload error: ${error.message}`);
                return { 
                    success: false, 
                    message: error.message,
                    statusCode: 500
                };
            }
        }

        // No adapter available
        return { 
            success: false, 
            message: 'No adapter available for this printer',
            statusCode: 503
        };
    },

    // --- Adapter-Specific Methods ---
    
    async getPrinterCapabilities(printerId) {
        const adapter = adapterStateManager.getAdapter(printerId);
        
        if (adapter) {
            try {
                const capabilities = await adapter.getCapabilities();
                return { success: true, capabilities };
            } catch (error) {
                logger.error(`[PrinterService] Error getting capabilities: ${error.message}`);
                return { success: false, message: error.message };
            }
        }
        
        return { success: false, message: 'No adapter available for this printer' };
    },

    async getStatusStream(printerId) {
        const adapter = adapterStateManager.getAdapter(printerId);

        if (adapter && adapter.isAuthenticated()) {
            try {
                return adapter.getStatusStream();
            } catch (error) {
                logger.error(`[PrinterService] Error creating status stream: ${error.message}`);
                throw error;
            }
        }

        throw new Error('No authenticated adapter available for status stream');
    },

    async calibratePrinter(printerId) {
        logger.info(`[PrinterService] Calibrating printer ID: ${printerId}`);

        const printerFromDb = await this.getPrinterById(printerId);
        if (!printerFromDb) {
            return { success: false, message: `Printer ${printerId} not found in DB.` };
        }

        const brand = String(printerFromDb.brand || '').toLowerCase();
        const adapter = adapterStateManager.getAdapter(printerId);

        if (!adapter || !adapter.isAuthenticated()) {
            return { success: false, message: 'No authenticated adapter available for this printer' };
        }

        try {
            // Brand-specific calibration logic
            if (brand === 'bambu_lab') {
                return await this._calibrateBambuLab(adapter, printerFromDb);
            } else if (brand === 'flashforge') {
                return await this._calibrateFlashForge(adapter, printerFromDb);
            } else if (brand === 'creality') {
                return await this._calibrateCreality(adapter, printerFromDb);
            } else if (brand === 'anycubic') {
                return await this._calibrateAnycubic(adapter, printerFromDb);
            } else if (brand === 'prusa') {
                return await this._calibratePrusa(adapter, printerFromDb);
            } else if (brand === 'elegoo') {
                return await this._calibrateElegoo(adapter, printerFromDb);
            } else {
                return {
                    success: false,
                    message: `Calibration not supported for brand: ${printerFromDb.brand}`
                };
            }
        } catch (error) {
            logger.error(`[PrinterService] Calibration error: ${error.message}`);
            return { success: false, message: error.message };
        }
    },

    async _calibrateBambuLab(adapter, printerFromDb) {
        logger.info('[PrinterService] Bambu Lab calibration');

        // Determine bed type based on model (simplified - default to z_bed)
        const model = String(printerFromDb.model || '').toLowerCase();
        const isSlingBed = model.includes('a1');

        try {
            // Step 1: Home all axes (required by Bambu Lab)
            await adapter.sendGcode('G28');
            logger.info('[PrinterService] Bambu: Homing complete');

            // Step 2: Move to calibration position
            if (isSlingBed) {
                // A1 uses Y-axis sling bed
                await adapter.sendGcode('G90\nG1 Y170 F1000');
                logger.info('[PrinterService] Bambu: Moved to Y170mm (A1 sling bed)');
                return { success: true, message: 'Calibration complete: Bed moved to Y170mm (A1 sling bed)' };
            } else {
                // P1P, P1S, X1C use Z-axis bed
                await adapter.sendGcode('G90\nG1 Z200 F600');
                logger.info('[PrinterService] Bambu: Moved to Z200mm (Z-bed)');
                return { success: true, message: 'Calibration complete: Bed moved to Z200mm' };
            }
        } catch (error) {
            logger.error(`[PrinterService] Bambu calibration error: ${error.message}`);
            return { success: false, message: `Calibration failed: ${error.message}` };
        }
    },

    async _calibrateFlashForge(adapter, printerFromDb) {
        logger.info('[PrinterService] FlashForge calibration');

        try {
            // FlashForge calibration uses TCP commands with ~ prefix
            // These commands are sent via the adapter's sendGcode method

            // Step 1: Login
            await adapter.sendGcode('~M601 S1');
            logger.info('[PrinterService] FlashForge: Login successful');

            // Step 2: Home Z axis
            await adapter.sendGcode('~G28 Z0');
            logger.info('[PrinterService] FlashForge: Z-axis homed');

            // Step 3: Wait for completion
            await adapter.sendGcode('~M400');

            // Step 4: Set absolute positioning
            await adapter.sendGcode('~G90');

            // Step 5: Move to Z190mm
            await adapter.sendGcode('~G1 Z190 F600');
            logger.info('[PrinterService] FlashForge: Moved to Z190mm');

            // Step 6: Wait for completion
            await adapter.sendGcode('~M400');

            // Step 7: Logout
            await adapter.sendGcode('~M602');
            logger.info('[PrinterService] FlashForge: Logout successful');

            return { success: true, message: 'Calibration complete: Bed moved to Z190mm' };
        } catch (error) {
            logger.error(`[PrinterService] FlashForge calibration error: ${error.message}`);
            return { success: false, message: `Calibration failed: ${error.message}` };
        }
    },

    async _calibrateCreality(adapter, printerFromDb) {
        logger.info('[PrinterService] Creality calibration');

        try {
            // Step 1: Home Z axis
            await adapter.sendGcode('G28 Z');
            logger.info('[PrinterService] Creality: Z-axis homed');

            // Step 2: Move to Z230mm (no compensation needed for Creality)
            await adapter.sendGcode('G1 Z230 F600');
            logger.info('[PrinterService] Creality: Moved to Z230mm');

            return { success: true, message: 'Calibration complete: Bed moved to Z230mm' };
        } catch (error) {
            logger.error(`[PrinterService] Creality calibration error: ${error.message}`);
            return { success: false, message: `Calibration failed: ${error.message}` };
        }
    },

    async _calibrateAnycubic(adapter, printerFromDb) {
        logger.info('[PrinterService] Anycubic calibration');

        // CRITICAL: +13mm compensation for Anycubic (beta script line 425)
        // This compensates for difference between G-code end positioning vs manual console commands
        const recommendedPos = 200;
        const compensationOffset = 13;
        const actualPosition = recommendedPos + compensationOffset; // 213mm

        try {
            // Step 1: Home Z axis
            await adapter.sendGcode('G28 Z');
            logger.info('[PrinterService] Anycubic: Z-axis homed');

            // Step 2: Move to Z213mm (Z200 + 13mm compensation)
            await adapter.sendGcode(`G1 Z${actualPosition} F600`);
            logger.info(`[PrinterService] Anycubic: Moved to Z${actualPosition}mm (Z${recommendedPos}mm + ${compensationOffset}mm compensation)`);

            return {
                success: true,
                message: `Calibration complete: Bed moved to Z${actualPosition}mm (Z${recommendedPos}mm + ${compensationOffset}mm compensation)`
            };
        } catch (error) {
            logger.error(`[PrinterService] Anycubic calibration error: ${error.message}`);
            return { success: false, message: `Calibration failed: ${error.message}` };
        }
    },

    async _calibratePrusa(adapter, printerFromDb) {
        logger.info('[PrinterService] Prusa calibration');

        const path = require('path');

        // Determine bed type (default to sling_bed for MK3/MK4)
        const model = String(printerFromDb.model || '').toLowerCase();
        const isZBed = model.includes('core one');

        const dwellFilename = isZBed ? 'Z_POS_DWELL.gcode' : 'Y_POS_DWELL.gcode';
        const localPath = path.join(__dirname, '..', '..', 'gcode', dwellFilename);
        const remotePath = `OTTOTEMP/${dwellFilename}`;

        try {
            // Step 1: Upload dwell file to printer
            logger.info(`[PrinterService] Prusa: Uploading ${dwellFilename}...`);
            const spec = new JobSpec({
                filename: remotePath,
                localPath: localPath
            });

            const uploadResult = await adapter.upload(spec);
            if (!uploadResult.success) {
                return { success: false, message: `Failed to upload dwell file: ${uploadResult.message}` };
            }

            logger.info(`[PrinterService] Prusa: Dwell file uploaded successfully`);

            // Step 2: Start the dwell file
            const startSpec = new JobSpec({ filename: remotePath });
            const startResult = await adapter.start(startSpec);

            if (!startResult.success) {
                return { success: false, message: `Failed to start dwell file: ${startResult.message}` };
            }

            logger.info('[PrinterService] Prusa: Dwell positioning file started');

            const description = isZBed ? 'Z200 positioning (Core One)' : 'Y210 positioning (MK3/MK4)';
            return {
                success: true,
                message: `Calibration started: ${description}. The printer will move to position and pause automatically.`
            };
        } catch (error) {
            logger.error(`[PrinterService] Prusa calibration error: ${error.message}`);
            return { success: false, message: `Calibration failed: ${error.message}` };
        }
    },

    async _calibrateElegoo(adapter, printerFromDb) {
        logger.info('[PrinterService] Elegoo calibration');

        const path = require('path');
        const calibrationFile = 'ELEGOO_Z205_PLA.gcode';
        const localPath = path.join(__dirname, '..', '..', 'gcode', calibrationFile);

        try {
            // Step 1: Upload calibration file
            logger.info(`[PrinterService] Elegoo: Uploading ${calibrationFile}...`);
            const uploadSpec = new JobSpec({
                filename: calibrationFile,
                localPath: localPath
            });

            const uploadResult = await adapter.upload(uploadSpec);
            if (!uploadResult.success) {
                return { success: false, message: `Failed to upload calibration file: ${uploadResult.message}` };
            }

            logger.info(`[PrinterService] Elegoo: Calibration file uploaded successfully`);

            // Step 2: Start the calibration print
            const startSpec = new JobSpec({ filename: calibrationFile });
            const startResult = await adapter.start(startSpec);

            if (!startResult.success) {
                return { success: false, message: `Failed to start calibration print: ${startResult.message}` };
            }

            logger.info('[PrinterService] Elegoo: Calibration print started');

            return {
                success: true,
                message: 'Calibration print started: OTTOMAT3D Logo. Print will end with bed at Z205mm (duration: ~10-15 minutes).'
            };
        } catch (error) {
            logger.error(`[PrinterService] Elegoo calibration error: ${error.message}`);
            return { success: false, message: `Calibration failed: ${error.message}` };
        }
    }
};

module.exports = printerService;
