// backend/src/services/ottoejectService.js

const db = require('../db');
const { dbRun, dbGet, dbAll } = require('../db/utils');
const logger = require('../utils/logger');
const moonrakerService = require('./moonrakerService');

const ottoejectService = {
    // --- Basic CRUD for Ottoeject Registration ---
    // The database table is 'ottoejects' with column 'device_name'.
    async createOttoeject(data) {
        const { device_name, ip_address } = data;
        if (!device_name || !ip_address) {
            throw new Error('Missing required fields: device_name and ip_address are essential.');
        }
        // Schema for v0.1 ottoejects table: id, device_name, ip_address, created_at, updated_at
        const sql = `INSERT INTO ottoejects (device_name, ip_address) VALUES (?, ?)`;
        const params = [device_name, ip_address];
        try {
            logger.debug(`[OttoejectService] Creating ottoeject: ${device_name}`);
            const result = await dbRun(sql, params);
            if (result.lastID) {
                return await ottoejectService.getOttoejectById(result.lastID); // Use service name
            }
            logger.warn('[OttoejectService] Ottoeject creation did not return a lastID.');
            return null;
        } catch (error) {
            logger.error(`[OttoejectService] Error creating ottoeject "${device_name}": ${error.message}`);
            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error(`Failed to create ottoeject: Device with the same name or IP Address might already exist.`);
            }
            throw error;
        }
    },

    async getAllOttoejects() {
        try {
            logger.debug('[OttoejectService] Fetching all ottoejects');
            // Fetches basic registration info. Status will be added live by controller if needed for list.
            return await dbAll('SELECT id, device_name, ip_address FROM ottoejects ORDER BY device_name ASC');
        } catch (error) {
            logger.error(`[OttoejectService] Error fetching all ottoejects: ${error.message}`);
            throw error;
        }
    },

    async getOttoejectById(id) { // Used to get IP for commands/status
        try {
            logger.debug(`[OttoejectService] Fetching ottoeject by ID: ${id}`);
            // Fetches basic registration info.
            return await dbGet('SELECT id, device_name, ip_address FROM ottoejects WHERE id = ?', [id]);
        } catch (error) {
            logger.error(`[OttoejectService] Error fetching ottoeject by ID ${id}: ${error.message}`);
            throw error;
        }
    },

    async updateOttoeject(id, updateData) {
        const allowedUpdates = { ...updateData };
        const validFields = ['device_name', 'ip_address']; // Only these are in v0.1 DB schema
        for (const key in allowedUpdates) { if (!validFields.includes(key)) delete allowedUpdates[key]; }

        if (Object.keys(allowedUpdates).length === 0) {
            logger.warn(`[OttoejectService] UpdateOttoeject for ID ${id}: No valid fields to update.`);
            return await ottoejectService.getOttoejectById(id); // Use service name
        }
        const setClause = Object.keys(allowedUpdates).map(field => `${field} = ?`).join(', ');
        const params = [...Object.values(allowedUpdates), id];
        const sql = `UPDATE ottoejects SET ${setClause} WHERE id = ?`;
        try {
            logger.debug(`[OttoejectService] Attempting to update ottoeject ID ${id} with:`, allowedUpdates);
            await dbRun(sql, params);
            return await ottoejectService.getOttoejectById(id); // Use service name
        } catch (error) {
            logger.error(`[OttoejectService] Error updating ottoeject ${id}: ${error.message}`);
            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error(`Failed to update ottoeject: New device_name or IP might already be in use.`);
            }
            throw error;
        }
    },

    async deleteOttoeject(id) {
        try {
            logger.debug(`[OttoejectService] Attempting to delete ottoeject ID: ${id}`);
            const result = await dbRun('DELETE FROM ottoejects WHERE id = ?', [id]);
            return result.changes > 0;
        } catch (error) {
            logger.error(`[OttoejectService] Error deleting ottoeject ${id}: ${error.message}`);
            throw error;
        }
    },

    // --- v0.1 Core Proxy Methods for Ottoeject ---

    /**
     * Gets live status from the Ottoeject (via Moonraker HTTP) and maps it.
     * Called by GET /api/ottoeject/:id/status
     */
    async getOttoejectLiveStatus(ottoejectId) {
        logger.debug(`[OttoejectService] Getting live status for Ottoeject ID: ${ottoejectId}`);
        try {
            const ottoeject = await ottoejectService.getOttoejectById(ottoejectId); // Use service name
            if (!ottoeject || !ottoeject.ip_address) {
                const err = new Error(`Ottoeject ${ottoejectId} not found or has no IP address.`);
                // @ts-ignore
                err.statusCode = 404; 
                throw err;
            }

            // Query Moonraker for 'idle_timeout' which contains Klipper's main state
            const moonrakerResult = await moonrakerService.queryObjects(ottoeject.ip_address, 'idle_timeout');
            
            let apiStatus = "OFFLINE"; // Default if Moonraker call fails or state unknown
            if (moonrakerResult.success && moonrakerResult.data && moonrakerResult.data.status && moonrakerResult.data.status.idle_timeout) {
                const klipperState = moonrakerResult.data.status.idle_timeout.state?.toLowerCase();
                if (klipperState === 'printing' || klipperState === 'busy') { // Klipper is "Printing" when running a macro
                    apiStatus = "EJECTING"; // Or "BUSY_PROCESSING_MACRO" - "EJECTING" is from API doc
                } else if (klipperState === 'ready' || klipperState === 'idle') {
                    apiStatus = "ONLINE";
                } else if (klipperState === 'error' || klipperState === 'shutdown') {
                    apiStatus = "ISSUE"; // Or "OFFLINE" for shutdown
                } else {
                    apiStatus = "UNKNOWN_MOONRAKER_STATE";
                }
                logger.info(`[OttoejectService] Ottoeject ${ottoejectId} Klipper state: '${klipperState}', API status: '${apiStatus}'`);
            } else {
                 logger.warn(`[OttoejectService] Failed to get valid idle_timeout state from Moonraker for Ottoeject ${ottoejectId}. Moonraker response:`, moonrakerResult.data);
                 // apiStatus remains "OFFLINE"
            }
            
            return { 
                success: true, // Indicates backend successfully attempted to get status
                data: {
                    id: parseInt(ottoeject.id),
                    device_name: ottoeject.device_name,
                    status: apiStatus 
                }
            };
        } catch (error) {
            logger.error(`[OttoejectService] Error getting live status for Ottoeject ${ottoejectId}: ${error.message}`);
            // Return a structure that controller can use to send 502 or appropriate error
            return { 
                success: false, 
                message: error.message || `Failed to retrieve Ottoeject ${ottoejectId} status.`,
                data: { id: parseInt(ottoejectId), device_name: "Unknown", status: "OFFLINE" } // Provide some default
            };
        }
    },

    /**
     * Relays a G-code macro command to the ottoeject (via Moonraker HTTP).
     * Called by POST /api/ottoeject/:id/macros
     */
    async executeMacro(ottoejectId, macroName, params = {}) {
        logger.info(`[OttoejectService] Relaying MACRO '${macroName}' to Ottoeject ID: ${ottoejectId}`, params);
        try {
            const ottoeject = await ottoejectService.getOttoejectById(ottoejectId); // Use service name
            if (!ottoeject || !ottoeject.ip_address) {
                const err = new Error(`Ottoeject ${ottoejectId} not found or has no IP address.`);
                 // @ts-ignore
                err.statusCode = 404;
                throw err;
            }

            let gcodeScript = macroName.trim().toUpperCase();
            if (params && typeof params === 'object' && Object.keys(params).length > 0) {
                const paramString = Object.entries(params)
                                        .map(([key, value]) => `${key.toUpperCase()}=${value}`)
                                        .join(' ');
                gcodeScript += ` ${paramString}`;
            }

            // moonrakerService.executeGcode returns {success, data} or throws
            const result = await moonrakerService.executeGcode(ottoeject.ip_address, gcodeScript);
            
            logger.info(`[OttoejectService] Macro '${macroName}' command relayed via moonrakerService to Ottoeject ${ottoejectId}.`);
            // The API doc for Ottoeject doesn't specify a response for commands.
            // We can return a simple success message.
            return { 
                success: result.success, // Pass through success from moonrakerService
                message: result.success ? `Macro '${macroName}' command sent to Ottoeject ${ottoejectId}.` : `Failed to send macro '${macroName}'.`,
                details: result.data // Include Moonraker's response details
            };
        } catch (error) {
            let returnMessage = error.message;
            if (error.message && (error.message.toLowerCase().includes('timeout') || error.message.toLowerCase().includes('econnaborted'))) {
                returnMessage = `Command '${macroName}' sent to Ottoeject, but acknowledgement from device timed out. External polling for completion is required. Detail: ${error.message}`;
            }
            logger.error(`[OttoejectService] Error relaying macro '${macroName}' to Ottoeject ${ottoejectId}: ${returnMessage}`);
            return { success: false, message: returnMessage, details: null };
        }
    }
};

module.exports = ottoejectService;