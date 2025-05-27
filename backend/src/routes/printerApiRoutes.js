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

// --- Base Printer Management Routes (for setup) ---
router.get('/', printerController.getAllPrinters);
router.post('/', printerController.registerPrinter);
router.get('/:id', printerController.getPrinterById);
router.put('/:id', printerController.updatePrinterDetails);
router.delete('/:id', printerController.deletePrinter);

// --- v0.1 Core Proxy Routes ---
router.get('/:id/status', printerController.getPrinterLiveStatus);
router.post('/:id/start-print', printerController.startPrintOnFile); 
router.post('/:id/send-gcode', printerController.sendGcodeToPrinter);

// --- NEW File Upload Route (Modified) ---
// Expects the file in a field named 'file'
router.post('/:id/upload', upload.single('file'), printerController.uploadFileToPrinter); 

module.exports = router;