// backend/src/controllers/printJobController.js

const printJobService = require('../services/printJobService');
const gcodeParsingService = require('../services/gcodeParsingService');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const crypto = require('crypto');

const printJobController = {

    /**
     * === ENHANCED: Now includes max_z_height_mm and file deduplication ===
     * Handles G-code file upload, parsing, and creation/update of a print_item.
     * POST /api/print-jobs/upload
     */
    async uploadAndParseGcode(req, res, next) {
        let tempFilePath = null;
        try {
            if (!req.file) {
                return res.status(400).json({ 
                    error: 'Bad Request', 
                    message: 'No file uploaded. Ensure the file is sent under the field name "file".' 
                });
            }
            tempFilePath = req.file.path;

            const parseResult = await gcodeParsingService.parseGcodeFile(tempFilePath);
            if (!parseResult.success) {
                return res.status(422).json({ 
                    error: 'Unprocessable Entity', 
                    message: parseResult.message 
                });
            }

            // Optional AV scan (disabled by default). Enable by setting AV_SCAN_ENABLED=true
            if (process.env.AV_SCAN_ENABLED === 'true') {
                try {
                    const { exec } = require('child_process');
                    await new Promise((resolve, reject) => {
                        exec(`clamscan --no-summary ${tempFilePath}`, { timeout: 15000 }, (err, stdout, stderr) => {
                            if (err) {
                                logger.error(`[PrintJobController] AV scan failed: ${stderr || err.message}`);
                                return reject(new Error('Antivirus scan failed or detected a threat.'));
                            }
                            resolve();
                        });
                    });
                } catch (scanErr) {
                    return res.status(422).json({
                        error: 'Unprocessable Entity',
                        message: 'Upload rejected by antivirus scan.'
                    });
                }
            }

            // Compute checksum for integrity
            const fileBuffer = await fs.readFile(tempFilePath);
            const checksum_sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            // Create the print_item data structure
            const file_details_json = {
                name: req.file.originalname,
                location: tempFilePath, // Persist on server; retention policy applies
                size_bytes: req.file.size,
                format: path.extname(req.file.originalname).slice(1),
                checksum_sha256
            };
            
            const parsedData = parseResult.data;
            const printItemData = {
                file_details_json: file_details_json,
                duration_details_json: { duration: parsedData.duration },
                measurement_details_json: parsedData.dimensions,
                filament_details_json: { 
                    type: parsedData.filament_type, 
                    required_weight_grams: parsedData.filament_used_g 
                },
                max_z_height_mm: parsedData.max_z_height_mm  // === NEW: Store max Z height ===
            };

            // === ENHANCED: Use file deduplication logic ===
            const printItem = await printJobService.updateOrCreatePrintItem(printItemData);

            // === ENHANCED: Include max_z_height_mm in response ===
            res.status(201).json({
                message: "File uploaded and parsed successfully.",
                print_item_id: printItem.id,
                filename: file_details_json.name,
                file_size: `${(req.file.size / (1024 * 1024)).toFixed(2)} MB`,
                estimated_print_time: parsedData.duration || 'Unknown',
                layer_count: parsedData.dimensions?.z ? 'Calculated from height' : 'Unknown',
                filament_used: `${parsedData.filament_used_g || 0}g`,
                max_z_height_mm: parsedData.max_z_height_mm,  // === NEW: Height for orchestrator ===
                dimensions: {
                    x_mm: parsedData.dimensions?.x,
                    y_mm: parsedData.dimensions?.y,
                    z_mm: parsedData.dimensions?.z
                },
                filament_type: parsedData.filament_type || 'Unknown'
            });

        } catch (error) {
            logger.error(`[PrintJobController] Upload/Parse Error: ${error.message}`, error);
            next(error);
        }
    },

    /**
     * Creates a new print job from a previously created print_item.
     * POST /api/print-jobs
     */
    async createPrintJob(req, res, next) {
        try {
            const {
                print_item_id,
                printer_id,
                ottoeject_id,
                rack_id,           // NEW - Manual rack selection
                store_location,    // NEW - Manual store slot
                grab_location,     // NEW - Manual grab slot
                auto_start = false,
                priority
            } = req.body;

            // Validate required fields
            if (!print_item_id) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'print_item_id is required.'
                });
            }

            if (!printer_id) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'printer_id is required.'
                });
            }

            if (!ottoeject_id) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'ottoeject_id is required.'
                });
            }

            if (!rack_id) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'rack_id is required.'
                });
            }

            if (store_location === undefined || store_location === null) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'store_location is required.'
                });
            }

            if (grab_location === undefined || grab_location === null) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'grab_location is required.'
                });
            }

            // Pass all relevant fields to the service (includes validation)
            const newJob = await printJobService.createPrintJob({
                print_item_id,
                printer_id,
                ottoeject_id,
                rack_id,
                store_location,
                grab_location,
                auto_start,
                priority
            });

            res.status(201).json({
                message: "Print job created successfully.",
                id: newJob.id,
                print_item_id: newJob.print_item_id,
                printer_id: newJob.printer_id,
                status: newJob.status,
                priority: newJob.priority,
                auto_start: newJob.auto_start,
                assigned_store_slot: newJob.assigned_store_slot,
                assigned_grab_slot: newJob.assigned_grab_slot,
                max_z_height_mm: newJob.max_z_height_mm,
                submitted_at: newJob.submitted_at
            });
        } catch (error) {
            logger.error(`[PrintJobController] Create Job Error: ${error.message}`, error);

            // Handle validation errors
            if (error.message.includes('Validation failed')) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: error.message,
                    details: error.details || []
                });
            }

            if (error.message.includes('FOREIGN KEY constraint failed')) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid print_item_id, printer_id, or ottoeject_id provided.'
                });
            }
            next(error);
        }
    },

    /**
     * Lists all print jobs.
     * GET /api/print-jobs
     */
    async getAllPrintJobs(req, res, next) {
        try {
            const jobs = await printJobService.getAllPrintJobs();
            res.status(200).json(jobs);
        } catch (error) {
            logger.error(`[PrintJobController] Get All Jobs Error: ${error.message}`, error);
            next(error);
        }
    },

    /**
     * Gets a specific print job by ID.
     * GET /api/print-jobs/:id
     */
    async getPrintJobById(req, res, next) {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                return res.status(400).json({ 
                    error: 'Bad Request', 
                    message: 'Job ID must be a valid number.' 
                });
            }
            const job = await printJobService.getPrintJobById(id);
            if (job) {
                res.status(200).json(job);
            } else {
                res.status(404).json({ 
                    error: 'Not Found', 
                    message: `Job with ID ${id} not found.` 
                });
            }
        } catch (error) {
            logger.error(`[PrintJobController] Get Job by ID Error: ${error.message}`, error);
            next(error);
        }
    },

    /**
     * Updates a job's metadata before it starts.
     * PUT /api/print-jobs/:id
     */
    async updatePrintJob(req, res, next) {
        try {
            const id = parseInt(req.params.id, 10);
            const updatedJob = await printJobService.updatePrintJob(id, req.body);
            if (updatedJob) {
                res.status(200).json(updatedJob);
            } else {
                res.status(404).json({ 
                    error: 'Not Found', 
                    message: `Job with ID ${id} not found.` 
                });
            }
        } catch (error) {
            logger.error(`[PrintJobController] Update Job Error: ${error.message}`, error);
            next(error);
        }
    },
    
    /**
     * Cancels/deletes a job if possible.
     * DELETE /api/print-jobs/:id
     */
    async cancelPrintJob(req, res, next) {
        try {
            const id = parseInt(req.params.id, 10);
            const wasCancelled = await printJobService.cancelPrintJob(id);
            if (wasCancelled) {
                res.status(204).send(); 
            } else {
                res.status(409).json({ 
                    error: 'Conflict', 
                    message: `Job with ID ${id} could not be cancelled. It may not exist or is already in progress.` 
                });
            }
        } catch (error) {
            logger.error(`[PrintJobController] Cancel Job Error: ${error.message}`, error);
            next(error);
        }
    },

    /**
     * Marks a job as complete.
     * POST /api/print-jobs/:id/complete
     */
    async completePrintJob(req, res, next) {
        try {
            const id = parseInt(req.params.id, 10);
            const job = await printJobService.completePrintJob(id);
            res.status(200).json({
                id: job.id,
                status: job.status,
                completed_at: job.completed_at
            });
        } catch (error) {
            logger.error(`[PrintJobController] Complete Job Error: ${error.message}`, error);
            next(error);
        }
    },

    /**
     * Manually start a NEW job -> transitions to QUEUED
     * POST /api/print-jobs/:id/start
     */
    async startPrintJob(req, res, next) {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Job ID must be a valid number.'
                });
            }
            const job = await printJobService.startPrintJob(id);
            res.status(200).json({
                id: job.id,
                status: job.status,
                status_message: job.status_message
            });
        } catch (error) {
            if (error.message.includes('Only NEW jobs can be started')) {
                return res.status(409).json({ error: 'Conflict', message: error.message });
            }
            if (error.message.includes('not found')) {
                return res.status(404).json({ error: 'Not Found', message: error.message });
            }
            logger.error(`[PrintJobController] Start Job Error: ${error.message}`, error);
            next(error);
        }
    }
};

module.exports = printJobController;