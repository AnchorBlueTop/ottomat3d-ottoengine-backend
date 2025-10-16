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
            logger.info(`[PrinterController] Registering printer:`, printerData);
            // Basic validation of top-level fields expected by API doc for POST /printers
            if (!printerData.name || !printerData.ip_address) {
                return res.status(400).json({ error: 'Bad Request', message: 'name and ip_address are required for printer registration.' });
            }
            // Service will validate Bambu-specific fields based on brand (access_code and serial_number)
            
            const newPrinter = await printerService.createPrinter(printerData);
            // createPrinter now informs PrinterStateManager to connect if it's a Bambu printer

            res.status(201).json({
                id: newPrinter.id,
                name: newPrinter.name,
                message: "Printer registered successfully"
            });
        } catch (error) {
            logger.error(`[PrinterController] RegisterPrinter Error: ${error.message}`, error.stack);
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
            logger.info('[PrinterController] Request to get all printers.');
            const printers = await printerService.getAllPrinters();
            res.status(200).json(printers);
        } catch (error) {
            logger.error(`[PrinterController] GetAllPrinters Error: ${error.message}`, error.stack);
            next(error);
        }
    },

    // GET /api/printers/:id
    async getPrinterById(req, res, next) { // This endpoint returns full live details
        try {
            const printerId = validateIdParam(req.params.id);
            logger.info(`[PrinterController] Request to get printer by ID (full live details): ${printerId}`);
            
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
            logger.error(`[PrinterController] GetPrinterById (live) Error: ${error.message}`, error.stack);
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

            logger.info(`[PrinterController] Request to update printer ID ${printerId}`);
            // printerService.updatePrinter updates the DB.
            // The service also now notifies PrinterStateManager if connection details changed.
            const updatedPrinterRecordFromDb = await printerService.updatePrinter(printerId, updateData);

            if (!updatedPrinterRecordFromDb) {
                 return res.status(404).json({ error: 'Not Found', message: `Printer with ID ${printerId} not found.` });
            }
            
            logger.info(`[PrinterController] Printer ${printerId} DB record updated. Fetching live details for response...`);
            const resultWithLiveDetails = await printerService.getPrinterLiveDetails(printerId);
            
            let responseBody;
            if (resultWithLiveDetails.success && resultWithLiveDetails.data) {
                responseBody = {
                    ...resultWithLiveDetails.data,
                    message: "Printer updated successfully"
                };
            } else {
                // Fallback if live details fetch fails post-update
                logger.warn(`[PrinterController] UpdatePrinter: Succeeded DB update for ${printerId} but failed to fetch live details for response. Message: ${resultWithLiveDetails.message}`);
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
            logger.error(`[PrinterController] UpdatePrinterDetails Error: ${error.message}`, error.stack);
             if (error.statusCode === 400) return res.status(400).json({ error: 'Bad Request', message: error.message });
             if (error.message.includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'Conflict', message: error.message });
            next(error);
        }
    },

    // DELETE /api/printers/:id
    async deletePrinter(req, res, next) {
        try {
            const printerId = validateIdParam(req.params.id);
            logger.info(`[PrinterController] Request to delete printer ID ${printerId}`);
            // printerService.deletePrinter now also informs PrinterStateManager
            const success = await printerService.deletePrinter(printerId);
            if (success) {
                res.status(200).json({ message: "Printer deleted successfully" }); // API doc shows 200
            } else {
                res.status(404).json({ error: 'Not Found', message: `Printer with ID ${printerId} not found.` });
            }
        } catch (error) {
            logger.error(`[PrinterController] DeletePrinter Error: ${error.message}`, error.stack);
            if (error.statusCode === 400) return res.status(400).json({ error: 'Bad Request', message: error.message });
            next(error);
        }
    },

    // --- v0.1 Core Proxy Methods Aligned with New API Doc ---

    // GET /api/printers/:id/status
    async getPrinterLiveStatus(req, res, next) {
        try {
            const printerId = validateIdParam(req.params.id);
            logger.info(`[PrinterController] Request for live status of printer ID: ${printerId}`);
            const result = await printerService.getPrinterLiveDetails(printerId); // Service gets live data

            if (result.success && result.data) {
                res.status(200).json({
                    id: result.data.id,
                    name: result.data.name,
                    brand: result.data.brand, 
                    model: result.data.model, 
                    status: result.data.status, // Main gcode_state
                    current_stage: result.data.current_stage,
                    progress_percent: result.data.progress_percent,
                    remaining_time_minutes: result.data.remaining_time_minutes
                });
            } else {
                res.status(502).json({ error: 'Device Communication Error', message: result.message || `Could not retrieve status for printer ${printerId}.`});
            }
        } catch (error) {
            logger.error(`[PrinterController] GetPrinterLiveStatus Error: ${error.message}`, error.stack);
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
            logger.info(`[PrinterController] Request to start print of file '${filename}' on printer ID: ${printerId}`);
            
            const result = await printerService.commandStartPrint(printerId, filename, req.body);

            if (result.success) {
                res.status(202).json({ message: result.message }); 
            } else {
                res.status(result.statusCode || 409).json({ error: 'Command Failed or Printer Issue', message: result.message });
            }
        } catch (error) {
            logger.error(`[PrinterController] StartPrintOnFile Error: ${error.message}`, error.stack);
            if (error.statusCode === 400) return res.status(400).json({ error: 'Bad Request', message: error.message });
            next(error);
        }
    },

    // POST /api/printers/:id/send-gcode
    async sendGcodeToPrinter(req, res, next) { 
        try {
            const printerId = validateIdParam(req.params.id);
            const { gcode } = req.body;
            if (!gcode || typeof gcode !== 'string') {
                return res.status(400).json({ error: 'Bad Request', message: 'Request body must include a string "gcode" field.' });
            }
            logger.info(`[PrinterController] Request to send G-code to printer ID: ${printerId}`);
            const result = await printerService.commandSendGcode(printerId, gcode);

            if (result.success) {
                res.status(202).json({ message: result.message }); 
            } else {
                res.status(result.statusCode || 409).json({ error: 'Command Failed', message: result.message });
            }
        } catch (error) {
            logger.error(`[PrinterController] SendGcodeToPrinter Error: ${error.message}`, error.stack);
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
            const remoteFilenameOnPrinter = req.body.remote_filename || originalFilename;

            logger.info(`[PrinterController] Request to upload file '${originalFilename}' (as '${remoteFilenameOnPrinter}') to printer ID ${printerId}. Temp path: ${tempFilePath}, Size: ${fileSizeReadable}`);

            const result = await printerService.commandUploadFile(printerId, tempFilePath, remoteFilenameOnPrinter);

            if (result.success) {
                res.status(200).json({ 
                    filename: remoteFilenameOnPrinter,
                    file_size: fileSizeReadable,
                    upload_time: new Date().toISOString(), 
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
            logger.error(`[PrinterController] UploadFileToPrinter Error: ${error.message}`, error.stack);
            if (error.statusCode === 400) { // From validateIdParam
                return res.status(400).json({ error: 'Bad Request', message: error.message });
            }
            next(error); // Pass to generic error handler
        } finally {
            // Cleanup: Delete the temporary file from the server
            if (tempFilePath) {
                try {
                    await fs.unlink(tempFilePath);
                    logger.info(`[PrinterController] Deleted temporary uploaded file: ${tempFilePath}`);
                } catch (unlinkError) {
                    logger.error(`[PrinterController] Failed to delete temporary file ${tempFilePath}: ${unlinkError.message}`);
                }
            }
        }
    },

    // --- ADDED: Printer Control Handlers ---

    async pausePrint(req, res, next) {
        try {
            const printerId = validateIdParam(req.params.id);
            logger.info(`[PrinterController] Request to PAUSE print on printer ID: ${printerId}`);
            const result = await printerService.commandPausePrint(printerId);
            if (result.success) {
                res.status(202).json({ message: result.message });
            } else {
                res.status(result.statusCode || 500).json({ error: 'Command Failed', message: result.message });
            }
        } catch (error) {
            logger.error(`[PrinterController] PausePrint Error: ${error.message}`, error);
            if (error.statusCode) {
                return res.status(error.statusCode).json({ error: 'Bad Request', message: error.message });
            }
            next(error);
        }
    },

    async resumePrint(req, res, next) {
        try {
            const printerId = validateIdParam(req.params.id);
            logger.info(`[PrinterController] Request to RESUME print on printer ID: ${printerId}`);
            const result = await printerService.commandResumePrint(printerId);
            if (result.success) {
                res.status(202).json({ message: result.message });
            } else {
                res.status(result.statusCode || 500).json({ error: 'Command Failed', message: result.message });
            }
        } catch (error) {
            logger.error(`[PrinterController] ResumePrint Error: ${error.message}`, error);
            if (error.statusCode) {
                return res.status(error.statusCode).json({ error: 'Bad Request', message: error.message });
            }
            next(error);
        }
    },

    async stopPrint(req, res, next) {
        try {
            const printerId = validateIdParam(req.params.id);
            logger.info(`[PrinterController] Request to STOP print on printer ID: ${printerId}`);
            const result = await printerService.commandStopPrint(printerId);
            if (result.success) {
                res.status(202).json({ message: result.message });
            } else {
                res.status(result.statusCode || 500).json({ error: 'Command Failed', message: result.message });
            }
        } catch (error) {
            logger.error(`[PrinterController] StopPrint Error: ${error.message}`, error);
            if (error.statusCode) {
                return res.status(error.statusCode).json({ error: 'Bad Request', message: error.message });
            }
            next(error);
        }
    }
};

module.exports = printerController;