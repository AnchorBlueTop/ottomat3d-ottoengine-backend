// backend/src/routes/printerApiRoutes.js

const express = require('express');
const multer = require('multer'); 
const printerController = require('../controllers/printerController');
const logger = require('../utils/logger'); // Assuming this is in src/utils/logger.js
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure Multer for temporary file storage
// Ensure this path is correct relative to where app.js runs or use an absolute path.
const tempUploadsDir = path.join(__dirname, '..', '..', 'uploads', 'temp_direct_printer_uploads');

// Ensure the directory exists
if (!fs.existsSync(tempUploadsDir)) {
    fs.mkdirSync(tempUploadsDir, { recursive: true });
    logger.info(`[Routes] Created temporary upload directory: ${tempUploadsDir}`);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tempUploadsDir);
    },
    filename: function (req, file, cb) {
        // Use a unique name to avoid collisions, e.g., timestamp + originalname
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});
const upload = multer({ storage: storage });

router.use((req, res, next) => { 
    // Basic logging example, ensure logger is correctly required and working
    if (logger && typeof logger.debug === 'function') {
        logger.debug(`Printer API Route: ${req.method} ${req.originalUrl}`);
    }
    next(); 
});


// POST /api/printers/ - Register a Printer
router.post('/', printerController.registerPrinter);

// POST /api/printers/connect - Test connection without persisting
router.post('/connect', express.json(), printerController.connect);

// GET /api/printers - Get all Printers
router.get('/', printerController.getAllPrinters);

// GET /api/printers/{id} - Get Single Printer Details
router.get('/:id', printerController.getPrinterById);

// GET /api/printers/{id}/status - Retreieve a Single Printer Status
router.get('/:id/status', printerController.getPrinterLiveStatus);

// PUT /api/printers/{id} - Update Basic Details of a Printer
router.put('/:id', printerController.updatePrinterDetails);

// DELETE /api/printers/{id} - Delete a Printer.
router.delete('/:id', printerController.deletePrinter);

// GET /api/printers/{id}/status - Retreieve a Single Printer Status
router.get('/:id/status', printerController.getPrinterLiveStatus);

// POST /api/printers/{id}/upload - Upload File to Printer.
router.post('/:id/upload', upload.single('file'), printerController.uploadFileToPrinter); 

// POST /api/printers/{id}/send-gcode - Start Gcode Command to Printer.
router.post('/:id/send-gcode', printerController.sendGcodeToPrinter);

// POST /api/printers/{id}/start-print - Start Print File on Printer
router.post('/:id/start-print', printerController.startPrintOnFile); 

// --- ADDED: Printer Control Routes ---

// POST /api/printers/{id}/pause - Pause the current print job
router.post('/:id/pause', printerController.pausePrint);

// POST /api/printers/{id}/resume - Resume a paused print job
router.post('/:id/resume', printerController.resumePrint);

// POST /api/printers/{id}/stop - Stop (cancel) the current print job
router.post('/:id/stop', printerController.stopPrint); 


module.exports = router;