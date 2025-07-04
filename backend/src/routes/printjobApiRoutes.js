// backend/src/routes/printJobApiRoutes.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const printJobController = require('../controllers/printJobController');
const logger = require('../utils/logger');

const router = express.Router();

// Configure Multer for temporary file storage
const tempUploadsDir = path.join(__dirname, '..', '..', 'uploads', 'temp_gcode_uploads');
if (!fs.existsSync(tempUploadsDir)) {
    fs.mkdirSync(tempUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempUploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`)
});
const upload = multer({ storage: storage });

// POST /api/print-jobs/upload - Upload and parse G-code file to create a print_item
router.post('/upload', upload.single('file'), printJobController.uploadAndParseGcode);

// POST /api/print-jobs - Create a new print job from a print_item
router.post('/', printJobController.createPrintJob);

// GET /api/print-jobs - Get all print jobs
router.get('/', printJobController.getAllPrintJobs);

// GET /api/print-jobs/:id - Get a specific print job
router.get('/:id', printJobController.getPrintJobById);

// PUT /api/print-jobs/:id - Update a print job's metadata (e.g., priority)
router.put('/:id', printJobController.updatePrintJob);

// DELETE /api/print-jobs/:id - Cancel a queued print job
router.delete('/:id', printJobController.cancelPrintJob);

// POST /api/print-jobs/:id/complete - Mark a job as completed
router.post('/:id/complete', printJobController.completePrintJob);

module.exports = router;