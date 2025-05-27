// backend/src/services/printerService.js

// - Uses PrinterStateManager for live Bambu Printer instances.
// - getPrinterLiveDetails fetches live status/filament from managed instance.
// - Command methods use managed instance.
// - CRUD informs PrinterStateManager about new/deleted printers.

const db = require('../db');
const { dbGet, dbAll, dbRun } = require('../db/utils');
const logger = require('../utils/logger');
// const bl_api = require('../bambulabs-api'); // No longer creating bl_api.Printer instances directly here
const PrinterStateManager = require('../services/printerStateManager'); // Use the manager - use absolute path to ensure same instance

// Helper to check attribute existence safely (if not already globally available or in utils)
function hasattr(obj, attr) {
    if (!obj) return false;
    return typeof obj[attr] === 'function' || obj[attr] !== undefined;
}

const printerService = {
    // --- Basic CRUD for Printer Registration ---
    async createPrinter(printerData) {
        const {
            name, brand = null, model = null, type,
            ip_address, access_code = null, serial_number = null,
            build_volume = null // From API doc, service stores it as JSON
        } = printerData;

        if (!name || !type || !ip_address) {
            throw new Error('Missing required fields: name, type, ip_address.');
        }
        if (String(type).toLowerCase() === 'fdm' && String(brand).toLowerCase() === 'bambu lab' && (!access_code || !serial_number)) {
            throw new Error('For Bambu Lab printers, access_code and serial_number are required.');
        }

        const buildVolumeJsonString = build_volume ? JSON.stringify(build_volume) : null;

        // Schema for v0.1: printers(id, name, brand, model, type, ip_address, access_code, serial_number, build_volume_json, current_filament_json)
        const sql = `
            INSERT INTO printers (name, brand, model, type, ip_address, access_code, serial_number, build_volume_json, current_filament_json) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL) 
        `;
        const params = [name, brand, model, type, ip_address, access_code, serial_number, buildVolumeJsonString];
        
        try {
            logger.debug(`[Service v0.1] Creating printer: ${name}`);
            const result = await dbRun(sql, params);
            if (result.lastID) {
                const newPrinterRecord = await printerService.getPrinterById(result.lastID);
                if (newPrinterRecord && String(newPrinterRecord.brand).toLowerCase() === 'bambu lab') {
                    // Inform PrinterStateManager about the new printer so it can connect
                    logger.info(`[Service v0.1] Informing PrinterStateManager to add and connect new Bambu Lab printer ID: ${newPrinterRecord.id}`);
                    PrinterStateManager.addAndConnectPrinter(newPrinterRecord) // This is async but we don't need to await it here
                        .then(instance => {
                            if (instance) {
                                logger.info(`[Service v0.1] PrinterStateManager successfully connected printer ID: ${newPrinterRecord.id}, Connected: ${instance.is_connected && instance.is_connected()}`);
                            } else {
                                logger.warn(`[Service v0.1] PrinterStateManager.addAndConnectPrinter returned null for printer ID: ${newPrinterRecord.id}`);
                            }
                        })
                        .catch(err => logger.error(`[Service v0.1] Error connecting new printer ${newPrinterRecord.id} in PrinterStateManager: ${err.message}`));
                }
                return newPrinterRecord; // Return the DB record
            }
            return null;
        } catch (error) { logger.error(`[Service v0.1] Error creating printer "${name}": ${error.message}`); throw error; }
    },

    async getAllPrinters() {
        try {
            // Fetch necessary fields from DB, including type and current_filament_json
            const printersFromDb = await dbAll('SELECT id, name, type, current_filament_json FROM printers ORDER BY name ASC');
            
            return printersFromDb.map(p => {
                let filamentData = { material: "N/A", color: "N/A" }; // Default placeholder
                if (p.current_filament_json) {
                    try { 
                        const dbFilament = JSON.parse(p.current_filament_json);
                        // Ensure we only take material and color for this simplified view
                        filamentData.material = dbFilament.material || "N/A";
                        filamentData.color = dbFilament.color || (dbFilament.color_hex || "N/A"); // Use color or color_hex
                    } catch (e) { 
                        logger.warn(`[Service getAllPrinters] Error parsing stored filament_json for printer ${p.id}`);
                    }
                }
                return {
                    id: p.id,
                    name: p.name,
                    status: "IDLE", // Placeholder status for list view as per v0.1 original design
                    type: p.type, 
                    filament: filamentData // Placeholder filament from DB or default
                };
            });
        }
        catch (error) { 
            logger.error(`[Service v0.1] Error fetching all printers: ${error.message}`); 
            throw error; 
        }
    },

    async getPrinterById(id) { // Fetches static data from DB
        try {
            return await dbGet(
                'SELECT id, name, brand, model, type, ip_address, access_code, serial_number, build_volume_json, current_filament_json FROM printers WHERE id = ?', 
                [id]
            );
        }
        catch (error) { logger.error(`[Service v0.1] Error fetching printer by ID ${id}: ${error.message}`); throw error; }
    },
    
    async updatePrinter(id, updateData) {
        // ... (logic to update DB fields: name, brand, model, type, ip, auth, build_volume_json, current_filament_json) ...
        // This method primarily updates the static configuration in the DB.
        // If connection details (IP, auth) change for a Bambu printer, PrinterStateManager might need to be notified to reconnect.
        const { build_volume, filament, ...otherUpdates } = updateData;
        const allowedDirectUpdates = { ...otherUpdates };
        const validDirectFields = ['name', 'brand', 'model', 'type', 'ip_address', 'access_code', 'serial_number'];
        for (const key in allowedDirectUpdates) { if (!validDirectFields.includes(key)) delete allowedDirectUpdates[key]; }

        const updateFieldsSqlParts = []; const paramsForSql = [];
        for (const field in allowedDirectUpdates) { updateFieldsSqlParts.push(`${field} = ?`); paramsForSql.push(allowedDirectUpdates[field]); }
        if (build_volume !== undefined) { updateFieldsSqlParts.push(`build_volume_json = ?`); paramsForSql.push(build_volume ? JSON.stringify(build_volume) : null); }
        if (filament !== undefined) {
            let fo = null; if (Array.isArray(filament) && filament.length > 0) fo = filament[0]; else if (filament && typeof filament === 'object') fo = filament;
            updateFieldsSqlParts.push(`current_filament_json = ?`); paramsForSql.push(fo ? JSON.stringify(fo) : null);
        }
        if (updateFieldsSqlParts.length === 0) return await printerService.getPrinterById(id);
        paramsForSql.push(id);
        const sql = `UPDATE printers SET ${updateFieldsSqlParts.join(', ')} WHERE id = ?`;
        try {
            await dbRun(sql, paramsForSql);
            const updatedPrinterRecord = await printerService.getPrinterById(id);
            // If connection-critical info changed for a Bambu printer, tell manager to refresh/reconnect
            if (updatedPrinterRecord && String(updatedPrinterRecord.brand).toLowerCase() === 'bambu lab' &&
                (allowedDirectUpdates.ip_address || allowedDirectUpdates.access_code || allowedDirectUpdates.serial_number)) {
                logger.info(`[Service v0.1] Connection details changed for Bambu printer ${id}. Notifying PrinterStateManager to refresh.`);
                await PrinterStateManager.removePrinterInstance(id); // Remove old instance
                await PrinterStateManager.addAndConnectPrinter(updatedPrinterRecord); // Add and connect with new details
            }
            return updatedPrinterRecord;
        } catch (error) { logger.error(`[Service v0.1] Error updating printer ${id}: ${error.message}`); throw error; }
    },

    async deletePrinter(id) {
        try {
            // Inform manager to disconnect and remove instance before deleting from DB
            await PrinterStateManager.removePrinterInstance(id);
            const result = await dbRun('DELETE FROM printers WHERE id = ?', [id]);
            logger.info(`[Service v0.1] Printer ID ${id} deleted from DB (changes: ${result.changes}).`);
            return result.changes > 0;
        } catch (error) { logger.error(`[Service v0.1] Error deleting printer ${id}: ${error.message}`); throw error; }
    },

    // --- v0.1 Core Proxy Methods using PrinterStateManager ---
    async getPrinterLiveDetails(printerId) {
        logger.info(`[Service v0.1] Getting live details for printer ID: ${printerId} via PrinterStateManager.`);
        const printerFromDb = await printerService.getPrinterById(printerId);
        if (!printerFromDb) {
             return { success: false, message: `Printer ${printerId} not found in DB.`, data: null };
        }

        let liveStatus = "UNKNOWN";
        let liveFilamentData = printerFromDb.current_filament_json ? JSON.parse(printerFromDb.current_filament_json) : { material: "N/A", color: "N/A" };
        let buildVolumeObject = printerFromDb.build_volume_json ? JSON.parse(printerFromDb.build_volume_json) : null;
        let liveBedTemp = null;
        let liveNozzleTemp = null;
        // New fields for enhanced status
        let liveStage = "UNKNOWN";
        let liveMcPercent = null;
        let liveMcRemainingTime = null;

        if (printerFromDb.brand && String(printerFromDb.brand).toLowerCase() === 'bambu lab') {
            const instance = PrinterStateManager.getInstance(printerId);
            // Instance capability checks removed for cleaner logs
            
            if (instance && hasattr(instance, 'is_connected') && instance.is_connected()) {
                const statusDump = hasattr(instance, 'mqtt_dump') ? instance.mqtt_dump() : {};
                liveStatus = (hasattr(instance, 'get_state') ? instance.get_state() : statusDump.print?.gcode_state) || "UNKNOWN";
                
                // Add temperature extraction
                if (hasattr(instance, 'getBedTemperature')) {
                    liveBedTemp = instance.getBedTemperature(); // Try camelCase method first
                } else if (hasattr(instance, 'get_bed_temperature')) {
                    liveBedTemp = instance.get_bed_temperature(); // Try snake_case method next
                }
                
                if (hasattr(instance, 'getNozzleTemperature')) {
                    liveNozzleTemp = instance.getNozzleTemperature(); // Try camelCase method first
                } else if (hasattr(instance, 'get_nozzle_temperature')) {
                    liveNozzleTemp = instance.get_nozzle_temperature(); // Try snake_case method next
                }
                
                // Extract new fields: stage, percent, remaining time
                if (hasattr(instance, 'get_current_stage')) {
                    liveStage = instance.get_current_stage();
                }
                if (hasattr(instance, 'get_percentage')) {
                    liveMcPercent = instance.get_percentage();
                }
                if (hasattr(instance, 'get_time')) {
                    liveMcRemainingTime = instance.get_time();
                }
                logger.debug(`[Service v0.1 LiveDetails ID:${printerId}] Status: ${liveStatus}, Bed: ${liveBedTemp}, Nozzle: ${liveNozzleTemp}, Stage: ${liveStage}, Percent: ${liveMcPercent}, RemainingTime: ${liveMcRemainingTime}`);
                
                // Filament extraction from live instance
                const vtTrayInfo = statusDump?.print?.vt_tray; // Correct path: print.vt_tray
                const amsInfo = statusDump?.print?.ams;     // Correct path: print.ams
                let activeFilamentData = null;
                
                // Process filament info from vt_tray (external spool)
                if (vtTrayInfo && vtTrayInfo.tray_type && vtTrayInfo.tray_type.trim() !== "") { 
                    activeFilamentData = vtTrayInfo;
                    logger.debug(`[Service-FilamentOutcome ID:${printerId}] Filament determined from vt_tray: ${vtTrayInfo.tray_type}/${vtTrayInfo.tray_color}`);
                }
                // If no vt_tray info, try AMS unit
                else if (amsInfo?.ams?.length > 0 && amsInfo.ams[0]?.tray?.length > 0) {
                    const activeTrayId = String(amsInfo.tray_now);
                    const activeTray = amsInfo.ams[0].tray.find(t => String(t.id) === activeTrayId);
                    
                    if (activeTray && activeTray.tray_type && activeTray.tray_type.trim() !== "") {
                        activeFilamentData = activeTray;
                        logger.debug(`[Service-FilamentOutcome ID:${printerId}] Filament determined from AMS (activeTray ${activeTrayId}): ${activeTray.tray_type}/${activeTray.tray_color}`);
                    } else {
                        // Keep warning logs as they indicate real issues
                        if (!activeTray) {
                            logger.warn(`[Service-FilamentOutcome ID:${printerId}] AMS activeTray not found for ID: ${activeTrayId}`);
                        } else if (!activeTray.tray_type || activeTray.tray_type.trim() === "") {
                            logger.warn(`[Service-FilamentOutcome ID:${printerId}] AMS activeTray ${activeTrayId} found, but tray_type is missing or empty`);
                        }
                    }
                }
                
                if (activeFilamentData) {
                    liveFilamentData = {
                        material: activeFilamentData.tray_type || "N/A", 
                        color: activeFilamentData.tray_color || "N/A",
                        name: activeFilamentData.name || null,
                        source: activeFilamentData === vtTrayInfo ? "external_spool" : 
                                `ams_unit_${amsInfo?.ams_exist_bits?.indexOf('1') ?? 0}_slot_${parseInt(activeFilamentData.id) + 1}`
                    };
                    
                    // Add more properties only if they exist
                    if (activeFilamentData.tray_sub_brands) {
                        liveFilamentData.sub_brand = activeFilamentData.tray_sub_brands;
                    }
                    
                    if (activeFilamentData.tray_weight) {
                        liveFilamentData.weight = activeFilamentData.tray_weight;
                    }
                    
                    if (activeFilamentData.tray_diameter) {
                        liveFilamentData.diameter = activeFilamentData.tray_diameter;
                    }
                    
                    // Try to parse remaining capacity if available
                    if (activeFilamentData.cols && activeFilamentData.cols[0]) {
                        try {
                            const remainingPercent = (parseInt(activeFilamentData.cols[0], 16) / 255 * 100).toFixed(0);
                            liveFilamentData.remaining_capacity_percent = `${remainingPercent}%`;
                        } catch (e) {
                            logger.warn(`[Service-LiveDetails ID:${printerId}] Failed to parse remaining capacity:`, e.message);
                        }
                    }
                } else {
                    // If no active filament data found, keep the default or DB-loaded values but add source
                    if (!liveFilamentData.source) {
                        liveFilamentData.source = printerFromDb.current_filament_json ? "database_fallback" : "default_fallback";
                    }
                    logger.debug(`[Service-FilamentOutcome ID:${printerId}] Using fallback filament data: ${liveFilamentData.source}`);
                }
            } else {
                logger.warn(`[Service-LiveDetails ID:${printerId}] Bambu printer instance not connected or not found in manager. Reporting OFFLINE. Instance was: ${instance ? 'defined but not connected' : 'null'}.`);
                liveStatus = "OFFLINE";
                
                // For fallback filament, ensure we have a source field
                if (!liveFilamentData.source) {
                    liveFilamentData.source = printerFromDb.current_filament_json ? "database_fallback" : "default_fallback";
                }
                logger.debug(`[Service-LiveDetails ID:${printerId}] Using fallback filament data for OFFLINE printer`);
            }
        } else {
            liveStatus = "NOT_BAMBU_OR_MONITORED";
            
            // For non-Bambu printers, ensure we have a source field in the filament data
            if (!liveFilamentData.source) {
                liveFilamentData.source = printerFromDb.current_filament_json ? "database_fallback" : "default_fallback";
            }
            logger.debug(`[Service-LiveDetails ID:${printerId}] Using fallback filament data for non-Bambu printer`);
        }
        
        const responseData = {
            id: parseInt(printerFromDb.id), name: printerFromDb.name, brand: printerFromDb.brand,
            model: printerFromDb.model, type: printerFromDb.type, status: String(liveStatus).toUpperCase(),
            // New fields
            current_stage: liveStage,                // e.g., "PRINTING", "AUTO_BED_LEVELING"
            progress_percent: liveMcPercent,          // e.g., 50 (for 50%) or null
            remaining_time_minutes: liveMcRemainingTime, // e.g., 120 (for 120 minutes) or null
            // Existing fields
            filament: liveFilamentData, build_volume: buildVolumeObject,
            ip_address: printerFromDb.ip_address, serial_number: printerFromDb.serial_number,
            bed_temperature: liveBedTemp,
            nozzle_temperature: liveNozzleTemp
        };
        return { success: true, data: responseData };
    },

    async commandStartPrint(printerId, filename, options = {}) {
        logger.info(`[Service v0.1] Relaying START PRINT for printer ID: ${printerId}, File: ${filename}`);
        try {
            const instance = PrinterStateManager.getInstance(printerId);
            if (!instance || (hasattr(instance, 'is_connected') && !instance.is_connected())) {
                throw new Error(`Printer instance ${printerId} not available or not connected for start print.`);
            }
            const success = await instance.start_print(
                filename, options.plate_idx || "", 
                options.useAms === undefined ? true : options.useAms, 
                options.amsMapping || [0], options.skip_objects || null
            );
            if (success) return { success: true, message: `Start print command for ${filename} sent.` };
            return { success: false, message: `API library indicated failure for start_print ${filename}.` };
        } catch (error) { 
            logger.error(`[Service v0.1] Error relaying start print for printer ${printerId}: ${error.message}`);
            return { success: false, message: error.message };
        }
    },

    async commandSendGcode(printerId, gcodeString) {
        logger.info(`[Service v0.1] Relaying G-CODE to printer ID: ${printerId}`);
        try {
            const instance = PrinterStateManager.getInstance(printerId);
            if (!instance || (hasattr(instance, 'is_connected') && !instance.is_connected())) {
                throw new Error(`Printer instance ${printerId} not available or not connected for sendGcode.`);
            }
            const success = await instance.gcode(gcodeString);
            if (success) return { success: true, message: `G-code sent.` };
            return { success: false, message: `API library indicated failure for sendGcode.` };
        } catch (error) { 
            logger.error(`[Service v0.1] Error relaying G-code to printer ${printerId}: ${error.message}`);
            return { success: false, message: error.message };
        }
    },

    async commandUploadFile(printerId, localFilePathOnServer, remoteFilenameOnPrinter) {
        logger.info(`[Service v0.1] Relaying UPLOAD FILE for printer ID: ${printerId}. Local: '${localFilePathOnServer}', Remote: '${remoteFilenameOnPrinter}'`);
        try {
            const instance = PrinterStateManager.getInstance(printerId);
            if (!instance) { // Printer not managed (e.g., not Bambu or not found by PSM)
                logger.warn(`[Service v0.1 Upload] Printer instance ${printerId} not found in PrinterStateManager. Cannot upload.`);
                return { success: false, message: `Printer ${printerId} not managed or not found.`, statusCode: 404, error: "Printer Not Managed" };
            }
            if (!hasattr(instance, 'is_connected') || !instance.is_connected()) {
                logger.warn(`[Service v0.1 Upload] Printer instance ${printerId} not connected. Cannot upload.`);
                return { success: false, message: `Printer ${printerId} is not connected.`, statusCode: 503, error: "Printer Offline" };
            }
            if (!hasattr(instance, 'upload_file')) {
                logger.error(`[Service v0.1 Upload] Printer instance for ${printerId} is missing 'upload_file' method.`);
                return { success: false, message: `Printer ${printerId} does not support file upload via this API instance.`, statusCode: 501, error: "Upload Not Supported By Instance" };
            }

            // instance.upload_file(localPath, remoteFilename) is from bambulabs-api/index.js
            // which calls ftpClient.uploadFile, which returns FTPResponse or null
            const ftpResponse = await instance.upload_file(localFilePathOnServer, remoteFilenameOnPrinter);
            
            if (ftpResponse && ftpResponse.code >= 200 && ftpResponse.code < 300) {
                logger.info(`[Service v0.1 Upload] File '${remoteFilenameOnPrinter}' successfully uploaded to printer ID ${printerId}. FTP Response: ${ftpResponse.code} ${ftpResponse.message}`);
                return { success: true, message: `File '${remoteFilenameOnPrinter}' uploaded successfully to printer ${printerId}.` };
            } else {
                const ftpErrorMessage = ftpResponse ? `${ftpResponse.code} ${ftpResponse.message}` : "FTP client failed to return response.";
                logger.error(`[Service v0.1 Upload] Failed to upload file to printer ID ${printerId}. FTP Client Response: ${ftpErrorMessage}`);
                return { 
                    success: false, 
                    message: `Failed to upload file to printer ${printerId}. Device reported: ${ftpErrorMessage}`,
                    statusCode: 502, // Bad Gateway - problem communicating with the printer's FTP
                    error: "Device FTP Error"
                };
            }
        } catch (error) { 
            // This catch is for errors within the service logic itself or if instance.upload_file throws unexpectedly
            logger.error(`[Service v0.1 Upload] Critical error during file upload for printer ${printerId}: ${error.message}`, error.stack);
            return { 
                success: false, 
                message: `Internal server error during file upload: ${error.message}`,
                statusCode: 500,
                error: "Internal Server Error"
            };
        }
    }
};

module.exports = printerService;