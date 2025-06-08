// backend/src/controllers/ottoejectController.js

// Assuming your service file is now named ottoejectService.js
const ottoejectService = require('../services/ottoejectService'); 
const logger = require('../utils/logger');

// Basic ID validation helper (can be shared from a utils file)
function validateIdParam(id, paramName = 'Ottoeject ID') { // Default paramName
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
        const error = new Error(`Invalid ${paramName}: Must be a positive integer.`);
        error.statusCode = 400; // For specific error handling by a generic error handler
        throw error;
    }
    return parsedId;
}

const ottoejectController = {
    // --- CRUD for Ottoeject Registration & Management ---

    // POST /api/ottoeject/
    async registerOttoeject(req, res, next) {
        try {
            const { device_name, ip_address } = req.body; // Matches new API doc fields for request
            // For v0.1, status, gantry_size, storage_rack are not part of POST request body for DB storage.
            
            if (!device_name || !ip_address) {
                return res.status(400).json({ error: 'Bad Request', message: 'device_name and ip_address are required for Ottoeject registration.' });
            }

            // Service only expects device_name and ip_address for v0.1 DB schema
            const newOttoeject = await ottoejectService.createOttoeject({ device_name, ip_address });

            if (!newOttoeject) { // Should be caught by service throwing error
                throw new Error('Ottoeject registration failed in service layer.');
            }
            
            res.status(201).json({
                id: newOttoeject.id,
                device_name: newOttoeject.device_name,
                //status: "ONLINE", // Default static response as per API doc example for creation; actual status is polled.
                message: "Ottoeject registered successfully"
            });
        } catch (error) {
            logger.error(`[Ctrl v0.1] RegisterOttoeject Error: ${error.message}`, error.stack);
            if (error.message.includes('Missing required') || error.message.includes('Invalid')) {
                return res.status(400).json({ error: 'Bad Request', message: error.message });
            }
            if (error.message.includes('UNIQUE constraint failed') || error.message.includes('already exist')) {
                return res.status(409).json({ error: 'Conflict', message: error.message });
            }
            next(error);
        }
    },

    // GET /api/ottoeject/
    async getAllOttoejects(req, res, next) {
        try {
            logger.info('[Ctrl v0.1] Request to get all ottoejects.');
            const ottoejectsFromDb = await ottoejectService.getAllOttoejects(); // Gets basic info (id, device_name, ip_address)
            
            // API doc example for GET /ottoeject (list) shows status, gantry_size, storage_rack.
            // For v0.1, since status is live and gantry/rack are not stored in DB:
            // Return static/placeholder data for these fields in the list view.
            const responseOttoejects = ottoejectsFromDb.map(o => ({
                id: o.id,
                device_name: o.device_name,
                //status: "ONLINE", // Placeholder static status for list
                ip_address: o.ip_address,
                // gantry_size_mm: null, // Placeholder or default
                // storage_rack: null    // Placeholder or default
            }));
            res.status(200).json(responseOttoejects);
        } catch (error) {
            logger.error(`[Ctrl v0.1] GetAllOttoejects Error: ${error.message}`, error.stack);
            next(error);
        }
    },

    // GET /api/ottoeject/:id
    async getOttoejectById(req, res, next) { // This endpoint returns stored details + live status
        try {
            const ottoejectId = validateIdParam(req.params.id);
            logger.info(`[Ctrl v0.1] Request to get ottoeject by ID (with live status): ${ottoejectId}`);
            
            const ottoejectFromDb = await ottoejectService.getOttoejectById(ottoejectId);
            if (!ottoejectFromDb) {
                return res.status(404).json({ error: 'Not Found', message: `Ottoeject with ID ${ottoejectId} not found.` });
            }

            // Fetch live status
            const statusResult = await ottoejectService.getOttoejectLiveStatus(ottoejectId);
            let liveDeviceStatus = "OFFLINE"; // Default if status fetch fails
            if (statusResult.success && statusResult.data) {
                liveDeviceStatus = statusResult.data.status; // e.g., ONLINE, EJECTING, from service mapping
            } else {
                logger.warn(`[Ctrl v0.1] Failed to get live status for ottoeject ${ottoejectId} when fetching details. Message: ${statusResult.message}`);
            }

            // Construct response based on API doc (gantry_size, storage_rack deferred for v0.1 DB storage)
            res.status(200).json({
                id: ottoejectFromDb.id,
                device_name: ottoejectFromDb.device_name,
                status: liveDeviceStatus, // Live status
                ip_address: ottoejectFromDb.ip_address
                // gantry_size_mm: null, // From DB if stored later
                // storage_rack: null    // From DB if stored later
            });
        } catch (error) {
            logger.error(`[Ctrl v0.1] GetOttoejectById Error: ${error.message}`, error.stack);
            if (error.statusCode === 400) { // From validateIdParam
                 return res.status(400).json({ error: 'Bad Request', message: error.message });
            }
            next(error);
        }
    },
    
    // PUT /api/ottoeject/:id
    async updateOttoeject(req, res, next) {
        try {
            const ottoejectId = validateIdParam(req.params.id);
            const updateData = req.body; // Expects { device_name?, ip_address? } for v0.1
             if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ error: 'Bad Request', message: 'Request body cannot be empty for update.' });
            }

            logger.info(`[Ctrl v0.1] Request to update ottoeject ID ${ottoejectId}`);
            // Service will filter for valid fields (device_name, ip_address for v0.1)
            const updatedOttoeject = await ottoejectService.updateOttoeject(ottoejectId, updateData);
            
            if (!updatedOttoeject) { // If service couldn't find the record to update
                 return res.status(404).json({ error: 'Not Found', message: `Ottoeject with ID ${ottoejectId} not found for update.` });
            }
            // API doc for PUT /printers had a full object response with a message.
            // Let's assume similar for ottoeject, but status will be placeholder.
            res.status(200).json({
                id: updatedOttoeject.id,
                device_name: updatedOttoeject.device_name,
                //status: "ONLINE", // Placeholder after update, actual is polled by /status
                message: "Ottoeject updated successfully"
            });
        } catch (error) {
            logger.error(`[Ctrl v0.1] UpdateOttoeject Error: ${error.message}`, error.stack);
             if (error.statusCode === 400) return res.status(400).json({ error: 'Bad Request', message: error.message });
             if (error.message.includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'Conflict', message: error.message });
            next(error);
        }
    },

    // DELETE /api/ottoeject/:id
    async deleteOttoeject(req, res, next) {
        try {
            const ottoejectId = validateIdParam(req.params.id);
            logger.info(`[Ctrl v0.1] Request to delete ottoeject ID ${ottoejectId}`);
            const success = await ottoejectService.deleteOttoeject(ottoejectId);
            if (success) {
                res.status(200).json({ message: "Ottoeject deleted successfully" }); // API doc shows 200 with message
            } else {
                res.status(404).json({ error: 'Not Found', message: `Ottoeject with ID ${ottoejectId} not found.` });
            }
        } catch (error) {
            logger.error(`[Ctrl v0.1] DeleteOttoeject Error: ${error.message}`, error.stack);
            if (error.statusCode === 400) return res.status(400).json({ error: 'Bad Request', message: error.message });
            next(error);
        }
    },

    // --- v0.1 Core Proxy Methods ---

    // GET /api/ottoeject/:id/status
    async getOttoejectLiveStatus(req, res, next) { // Name matches route
        try {
            const ottoejectId = validateIdParam(req.params.id);
            logger.info(`[Ctrl v0.1] Request for live status of ottoeject ID: ${ottoejectId}`);
            const result = await ottoejectService.getOttoejectLiveStatus(ottoejectId);

            if (result.success && result.data) {
                // result.data from service is already { id, device_name, status (mapped) }
                res.status(200).json(result.data); 
            } else {
                // Service returns a default structure on failure which can be passed through
                // or controller can format its own 502
                res.status(502).json(result.data || { 
                    id: parseInt(ottoejectId), // Ensure ID is int
                    device_name: "Unknown", // Fallback
                    status: "OFFLINE",      // Fallback
                    error: 'Device Communication Error', 
                    message: result.message || `Could not retrieve status for ottoeject ${ottoejectId}.`
                });
            }
        } catch (error) {
            logger.error(`[Ctrl v0.1] GetOttoejectLiveStatus Error for ID ${req.params.id}: ${error.message}`, error.stack);
            if (error.statusCode === 400) {
                 return res.status(400).json({ error: 'Bad Request', message: error.message });
            }
            next(error); // Pass to generic Express error handler
        }
    },

    // POST /api/ottoeject/:id/macros
    async executeMacro(req, res, next) {
        try {
            const ottoejectId = validateIdParam(req.params.id);
            const { macro, params } = req.body; // params is optional
            if (!macro || typeof macro !== 'string' || macro.trim() === "") {
                 return res.status(400).json({ error: 'Bad Request', message: 'Request body must include a non-empty string "macro" field.' });
            }
            logger.info(`[Ctrl v0.1] Request to execute macro '${macro}' on ottoeject ID: ${ottoejectId}`);
            const result = await ottoejectService.executeMacro(ottoejectId, macro, params || {});

            if (result.success) {
                res.status(202).json({ // 202 Accepted: command sent to device
                    message: result.message || `Macro '${macro}' command successfully relayed.`,
                    moonraker_response: result.details // Contains Moonraker's direct response
                });
            } else {
                // Service layer encountered an issue (e.g., Moonraker HTTP error, device not found by service)
                res.status(502).json({ 
                    error: 'Macro Execution Proxy Error', 
                    message: result.message || `Failed to execute macro '${macro}'.`,
                    moonraker_details: result.details // Include if service provides error details from Moonraker
                });
            }
        } catch (error) {
            logger.error(`[Ctrl v0.1] ExecuteMacro Error for ID ${req.params.id}, Macro ${req.body.macro}: ${error.message}`, error.stack);
            if (error.statusCode === 400) { // From validateIdParam
                 return res.status(400).json({ error: 'Bad Request', message: error.message });
            }
            // If service throws an error (e.g. device not found before even calling Moonraker)
            if (error.statusCode === 404) {
                return res.status(404).json({ error: 'Not Found', message: error.message });
            }
            next(error);
        }
    }
};

module.exports = ottoejectController;