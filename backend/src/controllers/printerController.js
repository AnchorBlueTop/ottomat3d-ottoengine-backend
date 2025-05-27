// backend/src/controllers/printerController.js

const printerService = require('../services/printerService');
const logger = require('../utils/logger');
const fs = require('fs').promises; // Use promises API for async unlink

// Basic ID validation helper (can be shared from a utils file)
function validateIdParam(id, paramName = 'Printer ID') {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
        const error = new Error(`Invalid ${paramName}: Must be a positive integer.`);
        error.statusCode = 400; // For specific error handling by a generic error handler
        throw error;
    }
    return parsedId;
}

const printerController = {
    // --- CRUD for Printer Registration & Management ---
    // POST /api/printers/
    async registerPrinter(req, res, next) {
        try {
            const printerData = req.body;
            logger.info(`[Ctrl v0.1] Registering printer:`, printerData);
            // Basic validation of top-level fields expected by API doc for POST /printers
            if (!printerData.name || !printerData.type || !printerData.ip_address) {
                return res.status(400).json({ error: 'Bad Request', message: 'name, type, and ip_address are required for printer registration.' });
            }
            // Service will validate Bambu-specific fields if type is 'bambu'
            
            const newPrinter = await printerService.createPrinter(printerData);
            // createPrinter now informs PrinterStateManager to connect if it's a Bambu printer

            res.status(201).json({
                id: newPrinter.id,
                name: newPrinter.name, // Ensure service returns at least these from DB record
                message: "Printer registered successfully"
            });
        } catch (error) {
            logger.error(`[Ctrl v0.1] RegisterPrinter Error: ${error.message}`, error.stack);
            if (error.message.includes('Missing required') || error.message.includes('Invalid')) {
                return res.status(400).json({ error: 'Bad Request', message: error.message });
            }
            if (error.message.includes('UNIQUE constraint failed') || error.message.includes('already exist')) {
                return res.status(409).json({ error: 'Conflict', message: error.message });
            }
            next(error); // Pass to generic error handler
        }
    },

    // GET /api/printers/
    async getAllPrinters(req, res, next) {
        try {
            logger.info('[Ctrl v0.1] Request to get all printers.');
            // printerService.getAllPrinters() returns static DB data + placeholder status/filament
            // as per API doc for list view.
            const printers = await printerService.getAllPrinters();
            res.status(200).json(printers);
        } catch (error) {
            logger.error(`[Ctrl v0.1] GetAllPrinters Error: ${error.message}`, error.stack);
            next(error);
        }
    },

    // GET /api/printers/:id
    async getPrinterById(req, res, next) { // This endpoint returns full live details
        try {
            const printerId = validateIdParam(req.params.id);
            logger.info(`[Ctrl v0.1] Request to get printer by ID (full live details): ${printerId}`);
            
            // This service method fetches live status/filament and combines with stored DB info
            const result = await printerService.getPrinterLiveDetails(printerId);

            if (result.success && result.data) {
                res.status(200).json(result.data);
            } else if (result.message && result.message.toLowerCase().includes('not found')) {
                res.status(404).json({ error: 'Not Found', message: result.message });
            } else { // Likely a communication error if not "not found"
                res.status(502).json({ error: 'Device Communication Error', message: result.message || `Could not retrieve details for printer ${printerId}.`});
            }
        } catch (error) {
            logger.error(`[Ctrl v0.1] GetPrinterById (live) Error: ${error.message}`, error.stack);
            if (error.statusCode === 400) { // From validateIdParam
                 return res.status(400).json({ error: 'Bad Request', message: error.message });
            }
            next(error);
        }
    },

    // PUT /api/printers/:id
    async updatePrinterDetails(req, res, next) {
        try {
            const printerId = validateIdParam(req.params.id);
            const updateData = req.body;
            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ error: 'Bad Request', message: 'Request body cannot be empty for update.' });
            }

            logger.info(`[Ctrl v0.1] Request to update printer ID ${printerId}`);
            // printerService.updatePrinter updates the DB.
            // The service also now notifies PrinterStateManager if connection details changed.
            const updatedPrinterRecordFromDb = await printerService.updatePrinter(printerId, updateData);

            if (!updatedPrinterRecordFromDb) {
                 return res.status(404).json({ error: 'Not Found', message: `Printer with ID ${printerId} not found.` });
            }
            
            logger.info(`[Ctrl v0.1] Printer ${printerId} DB record updated. Fetching live details for response...`);
            const resultWithLiveDetails = await printerService.getPrinterLiveDetails(printerId);
            
            let responseBody;
            if (resultWithLiveDetails.success && resultWithLiveDetails.data) {
                responseBody = {
                    ...resultWithLiveDetails.data,
                    message: "Printer updated successfully"
                };
            } else {
                // Fallback if live details fetch fails post-update
                logger.warn(`[Ctrl v0.1] UpdatePrinter: Succeeded DB update for ${printerId} but failed to fetch live details for response. Message: ${resultWithLiveDetails.message}`);
                const dbData = { ...updatedPrinterRecordFromDb }; // Use data directly from DB update
                if (dbData.build_volume_json) { try { dbData.build_volume = JSON.parse(dbData.build_volume_json); } catch(e){ dbData.build_volume = null;} }
                delete dbData.build_volume_json;
                if (dbData.current_filament_json) { try { dbData.filament = JSON.parse(dbData.current_filament_json); } catch(e){ dbData.filament = {material:"N/A", color:"N/A"};} }
                else { dbData.filament = {material:"N/A", color:"N/A"}; }
                delete dbData.current_filament_json;
                delete dbData.access_code; // Don't send sensitive info back
                delete dbData.serial_number;

                responseBody = {
                    ...dbData,
                    status: "UNKNOWN", // Cannot confirm live status
                    message: "Printer updated successfully (live details could not be refreshed immediately)."
                };
            }
            res.status(200).json(responseBody);

        } catch (error) {
            logger.error(`[Ctrl v0.1] UpdatePrinterDetails Error: ${error.message}`, error.stack);
             if (error.statusCode === 400) return res.status(400).json({ error: 'Bad Request', message: error.message });
             if (error.message.includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'Conflict', message: error.message });
            next(error);
        }
    },

    // DELETE /api/printers/:id
    async deletePrinter(req, res, next) {
        try {
            const printerId = validateIdParam(req.params.id);
            logger.info(`[Ctrl v0.1] Request to delete printer ID ${printerId}`);
            // printerService.deletePrinter now also informs PrinterStateManager
            const success = await printerService.deletePrinter(printerId);
            if (success) {
                res.status(200).json({ message: "Printer deleted successfully" }); // API doc shows 200
            } else {
                res.status(404).json({ error: 'Not Found', message: `Printer with ID ${printerId} not found.` });
            }
        } catch (error) {
            logger.error(`[Ctrl v0.1] DeletePrinter Error: ${error.message}`, error.stack);
            if (error.statusCode === 400) return res.status(400).json({ error: 'Bad Request', message: error.message });
            next(error);
        }
    },

    // --- v0.1 Core Proxy Methods Aligned with New API Doc ---

    // GET /api/printers/:id/status
    async getPrinterLiveStatus(req, res, next) {
        try {
            const printerId = validateIdParam(req.params.id);
            logger.info(`[Ctrl v0.1] Request for live status of printer ID: ${printerId}`);
            const result = await printerService.getPrinterLiveDetails(printerId); // Service gets live data

            if (result.success && result.data) {
                res.status(200).json({
                    id: result.data.id,
                    name: result.data.name,
                    brand: result.data.brand, // ADD brand
                    model: result.data.model, // ADD model
                    status: result.data.status, // Main gcode_state
                    current_stage: result.data.current_stage,
                    progress_percent: result.data.progress_percent,
                    remaining_time_minutes: result.data.remaining_time_minutes
                    // REMOVED type, filament, bed_temperature, nozzle_temperature as requested
                });
            } else {
                res.status(502).json({ error: 'Device Communication Error', message: result.message || `Could not retrieve status for printer ${printerId}.`});
            }
        } catch (error) {
            logger.error(`[Ctrl v0.1] GetPrinterLiveStatus Error: ${error.message}`, error.stack);
            if (error.statusCode === 400) return res.status(400).json({ error: 'Bad Request', message: error.message });
            next(error);
        }
    },

    // POST /api/printers/:id/start-print
    async startPrintOnFile(req, res, next) { // Renamed from startPrintCommand
        try {
            const printerId = validateIdParam(req.params.id);
            const { filename } = req.body; // File must be on printer
            if (!filename) {
                return res.status(400).json({ error: 'Bad Request', message: 'Missing "filename" in request body.' });
            }
            logger.info(`[Ctrl v0.1] Request to start print of file '${filename}' on printer ID: ${printerId}`);
            
            const result = await printerService.commandStartPrint(printerId, filename, req.body); // Pass full req.body as options

            if (result.success) {
                res.status(202).json({ message: result.message }); // 202 Accepted
            } else {
                res.status(result.statusCode || 409).json({ error: 'Command Failed or Printer Issue', message: result.message });
            }
        } catch (error) {
            logger.error(`[Ctrl v0.1] StartPrintOnFile Error: ${error.message}`, error.stack);
            if (error.statusCode === 400) return res.status(400).json({ error: 'Bad Request', message: error.message });
            next(error);
        }
    },

    // POST /api/printers/:id/send-gcode
    async sendGcodeToPrinter(req, res, next) { // Renamed from sendGcodeCommand
        try {
            const printerId = validateIdParam(req.params.id);
            const { gcode } = req.body;
            if (!gcode || typeof gcode !== 'string') {
                return res.status(400).json({ error: 'Bad Request', message: 'Request body must include a string "gcode" field.' });
            }
            logger.info(`[Ctrl v0.1] Request to send G-code to printer ID: ${printerId}`);
            const result = await printerService.commandSendGcode(printerId, gcode);

            if (result.success) {
                res.status(202).json({ message: result.message }); // 202 Accepted
            } else {
                res.status(result.statusCode || 409).json({ error: 'Command Failed', message: result.message });
            }
        } catch (error) {
            logger.error(`[Ctrl v0.1] SendGcodeToPrinter Error: ${error.message}`, error.stack);
            if (error.statusCode === 400) return res.status(400).json({ error: 'Bad Request', message: error.message });
            next(error);
        }
    },

    async uploadFileToPrinter(req, res, next) {
        const printerId = validateIdParam(req.params.id);
        let tempFilePath = null; // To ensure we try to delete it

        try {
            if (!req.file) {
                // Updated error message to reflect the new field name 'file'
                return res.status(400).json({ error: 'Bad Request', message: 'No file uploaded. Ensure the file is sent under the field name "file".' });
            }
            tempFilePath = req.file.path; // Full path to the temporarily stored file by multer
            const originalFilename = req.file.originalname;
            const fileSizeInBytes = req.file.size; // multer provides size in bytes

            // Convert file size to a more readable format (e.g., KB, MB)
            let fileSizeReadable;
            if (fileSizeInBytes < 1024) {
                fileSizeReadable = `${fileSizeInBytes} B`;
            } else if (fileSizeInBytes < 1024 * 1024) {
                fileSizeReadable = `${(fileSizeInBytes / 1024).toFixed(2)} KB`;
            } else {
                fileSizeReadable = `${(fileSizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
            }

            // Optional: Client can specify a remote filename, or we use original.
            // For v0.1, let's assume the remote filename is the same as the original.
            // If you want to allow client to specify, get it from req.body.remote_filename
            const remoteFilenameOnPrinter = req.body.remote_filename || originalFilename;

            logger.info(`[Ctrl v0.1] Request to upload file '${originalFilename}' (as '${remoteFilenameOnPrinter}') to printer ID ${printerId}. Temp path: ${tempFilePath}, Size: ${fileSizeReadable}`);

            const result = await printerService.commandUploadFile(printerId, tempFilePath, remoteFilenameOnPrinter);

            if (result.success) {
                // Construct the new response structure
                res.status(200).json({ 
                    filename: remoteFilenameOnPrinter, // Or originalFilename if preferred for this field
                    file_size: fileSizeReadable,
                    upload_time: new Date().toISOString(), // Current time as upload_time
                    message: result.message || `File '${remoteFilenameOnPrinter}' uploaded successfully to printer ${printerId}.`
                });
            } else {
                // Service should provide a meaningful message
                res.status(result.statusCode || 502).json({ // 502 if device comms issue, 404 if printer not managed, etc.
                    error: result.error || 'Upload Failed', 
                    message: result.message 
                });
            }
        } catch (error) {
            logger.error(`[Ctrl v0.1] UploadFileToPrinter Error: ${error.message}`, error.stack);
            if (error.statusCode === 400) { // From validateIdParam
                return res.status(400).json({ error: 'Bad Request', message: error.message });
            }
            next(error); // Pass to generic error handler
        } finally {
            // Cleanup: Delete the temporary file from the server
            if (tempFilePath) {
                try {
                    await fs.unlink(tempFilePath);
                    logger.info(`[Ctrl v0.1] Deleted temporary uploaded file: ${tempFilePath}`);
                } catch (unlinkError) {
                    logger.error(`[Ctrl v0.1] Failed to delete temporary file ${tempFilePath}: ${unlinkError.message}`);
                }
            }
        }
    }
    // Removed controller methods for direct file management (upload, list, delete) and pause/resume/stop
    // as these are not in the primary v0.1 Python script interaction loop via backend proxy.
    // If needed, they would call corresponding simplified relay methods in printerService.
};

module.exports = printerController;