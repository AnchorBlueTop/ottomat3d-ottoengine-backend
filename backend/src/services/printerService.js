// src/services/printerService.js
// Enhanced printer service using Integration Adapters (Adapter-Only Implementation)
// Legacy fallback methods have been removed - all operations now use the Integration Adapter pattern

const db = require('../db');
const { dbGet, dbAll, dbRun } = require('../db/utils');
const logger = require('../utils/logger');
const adapterStateManager = require('./adapterStateManager');
const { AdapterError, JobSpec } = require('../../packages/integration-adapter');

// Fallback to original PrinterStateManager for non-adapter printers
const PrinterStateManager = require('./printerStateManager');

// Helper to check attribute existence safely
function hasattr(obj, attr) {
    if (!obj) return false;
    return typeof obj[attr] === 'function' || obj[attr] !== undefined;
}

const printerService = {
    // --- Enhanced CRUD with Adapter Support ---
    
    async createPrinter(printerData) {
        const {
            name,
            brand = null,
            model = null,
            type=null,
            ip_address,
            access_code = null,
            serial_number = null,
            build_volume = null
        } = printerData;
        
        if (!name || !ip_address) {
            throw new Error('Missing required fields: Name, IP Address.');
        }
        
        // Validate required fields for supported printers (brand-based)
        const brandLower = String(brand || '').toLowerCase();
        if ((brandLower === 'bambu_lab') && 
            (!access_code || !serial_number)) {
            throw new Error('For Bambu Lab printers, access_code and serial_number are required.');
        }

        const buildVolumeJsonString = build_volume ? JSON.stringify(build_volume) : null;

        const sql = `
            INSERT INTO printers (name, brand, model, type, ip_address, access_code, serial_number, build_volume_json, current_filament_json) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL) 
        `;
        const params = [name, brand, model, type, ip_address, access_code, serial_number, buildVolumeJsonString];
        
        try {
            logger.debug(`[PrinterService] Creating printer: ${name}`);
            const result = await dbRun(sql, params);
            
            if (result.lastID) {
                const newPrinterRecord = await this.getPrinterById(result.lastID);
                
                if (newPrinterRecord) {
                    // Try adapter first, fallback to original system
                    const adapter = await adapterStateManager.addAndConnectAdapter(newPrinterRecord);
                    
                    if (!adapter && brandLower === 'bambu_lab') {
                        // Fallback to original PrinterStateManager
                        logger.info(`[PrinterService] Adapter failed, falling back to PrinterStateManager for printer ${newPrinterRecord.id}`);
                        PrinterStateManager.addAndConnectPrinter(newPrinterRecord)
                            .catch(err => logger.error(`PrinterStateManager fallback failed: ${err.message}`));
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
            
            const printerDetailsPromises = allPrinterRecords.map(p => 
                this.getPrinterLiveDetails(p.id)
            );
            
            const results = await Promise.all(printerDetailsPromises);
            
            const successfulPrinters = results
                .filter(res => res.success && res.data)
                .map(res => res.data);

            return successfulPrinters;
            
        } catch (error) {
            logger.error(`[PrinterService] Error fetching all printers: ${error.message}`);
            throw error;
        }
    },

    async getPrinterById(id) {
        try {
            return await dbGet(
                'SELECT id, name, brand, model, type, ip_address, access_code, serial_number, build_volume_json, current_filament_json FROM printers WHERE id = ?', 
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
        const validDirectFields = ['name', 'brand', 'model', 'type', 'ip_address', 'access_code', 'serial_number'];
        
        for (const key in allowedDirectUpdates) {
            if (!validDirectFields.includes(key)) delete allowedDirectUpdates[key];
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
                    await PrinterStateManager.removePrinterInstance(id);
                    await PrinterStateManager.addAndConnectPrinter(updatedPrinterRecord);
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
            await PrinterStateManager.removePrinterInstance(id);
            
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
                    brand: info.brand,
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

        // FALLBACK: Try PrinterStateManager for Bambu Lab printers
        logger.info(`[PrinterService] No adapter available, trying PrinterStateManager fallback for printer ${printerId}`);
        
        let printerInstance = PrinterStateManager.getInstance(printerId);
        
        // If no instance exists, try to create one
        if (!printerInstance) {
            logger.warn(`[PrinterService] No PrinterStateManager instance for printer ${printerId}, attempting to create one`);
            const printerRecord = await this.getPrinterById(printerId);
            if (printerRecord) {
                try {
                    await PrinterStateManager.addAndConnectPrinter(printerRecord);
                    printerInstance = PrinterStateManager.getInstance(printerId);
                    logger.info(`[PrinterService] Successfully created PrinterStateManager instance for printer ${printerId}`);
                } catch (error) {
                    logger.error(`[PrinterService] Failed to create PrinterStateManager instance: ${error.message}`);
                }
            }
        }
        
        if (printerInstance) {
            try {
                // Add timeout to prevent hanging
                const timeout = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('PrinterStateManager timeout')), 5000);
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
                    bed_temperature: statusResult.bed_temperature,
                    nozzle_temperature: statusResult.nozzle_temperature,
                    // Fallback source
                    adapter_source: 'printer_state_manager_fallback',
                    last_update: new Date().toISOString()
                };
                
                logger.info(`[PrinterService] PrinterStateManager fallback successful for printer ${printerId}`);
                return { success: true, data: responseData };
                
            } catch (error) {
                logger.error(`[PrinterService] PrinterStateManager fallback failed: ${error.message}`);
            }
        }

        // No connection available
        return { 
            success: false, 
            message: `No adapter or PrinterStateManager connection available for printer ${printerId}`, 
            data: null 
        };
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

        // FALLBACK: Try PrinterStateManager for Bambu Lab printers
        logger.info(`[PrinterService] No adapter available, trying PrinterStateManager fallback for printer ${printerId}`);
        
        const printerInstance = PrinterStateManager.getInstance(printerId);
        if (printerInstance) {
            try {
                // Add timeout to prevent hanging
                const timeout = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('PrinterStateManager start timeout')), 10000);
                });
                
                // Check if start_print method exists
                if (!printerInstance.start_print || typeof printerInstance.start_print !== 'function') {
                    throw new Error('PrinterStateManager instance does not have start_print method');
                }
                
                // Use PrinterStateManager start method
                logger.debug(`[PrinterService] Calling start_print with filename: ${filename}`);
                const startPromise = Promise.resolve(printerInstance.start_print(filename));
                const result = await Promise.race([startPromise, timeout]);
                
                logger.info(`[PrinterService] PrinterStateManager start print successful for printer ${printerId}`);
                return {
                    success: true,
                    message: `Print started via PrinterStateManager: ${filename}`,
                    adapter_source: 'printer_state_manager_fallback'
                };
                
            } catch (error) {
                logger.error(`[PrinterService] PrinterStateManager start print failed: ${error.message}`);
                return {
                    success: false,
                    message: `PrinterStateManager start failed: ${error.message}`,
                    adapter_source: 'printer_state_manager_fallback'
                };
            }
        }

        // No connection available - provide detailed debugging info
        const debugInfo = {
            adapterId: adapter ? 'exists' : 'null',
            adapterAuth: adapter ? adapter.isAuthenticated() : 'n/a',
            printerStateManager: PrinterStateManager.getInstance(printerId) ? 'exists' : 'null'
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
    }
};

module.exports = printerService;
