// src/services/orchestratorService.js
// Main Orchestrator Service for OTTOMAT3D Automation
// Handles conflict resolution AND automatic job processing
// Features: Queue processing, height-aware slot assignment, print-to-storage workflow

const { EventEmitter } = require('events');
const { rackEventEmitter } = require('./rackEventEmitter');
const ConflictResolver = require('./conflictResolver');
const AdvancedSlotManager = require('../utils/AdvancedSlotManager');
const printerService = require('./printerService');
const ottoejectService = require('./ottoejectService');
const ottorackService = require('./ottorackService');
const logger = require('../utils/logger');
const { dbAll, dbGet, dbRun } = require('../db/utils');

class OrchestratorService extends EventEmitter {
    constructor() {
        super();
        
        // Conflict resolution components
        this.conflictResolver = new ConflictResolver(this);
        this.activeConflictResolutions = new Set();
        
        // === ENHANCED: Automatic Job Processing Components ===
        this.jobProcessingEnabled = true;
        this.activeWorkflows = new Map(); // jobId -> workflow state
        this.jobPollingInterval = null;
        this.slotManagers = new Map(); // rackId -> AdvancedSlotManager
        
        // State management
        this.rackStateCache = new Map();
        this.isInitialized = false;
        this.isShuttingDown = false;
        
        // Enhanced performance tracking
        this.eventProcessingStats = {
            total_events: 0,
            conflicts_detected: 0,
            conflicts_resolved: 0,
            conflicts_failed: 0,
            jobs_paused: 0,
            jobs_reassigned: 0
        };
        
        // === NEW: Job Processing Statistics ===
        this.jobProcessingStats = {
            jobs_processed: 0,
            jobs_assigned_slots: 0,
            jobs_dispatched: 0,
            jobs_completed: 0,
            jobs_failed: 0,
            printers_utilized: new Set(),
            average_processing_time_ms: 0
        };
        
        logger.info('[OrchestratorService] Enhanced instance created with automatic job processing');
    }

    /**
     * Extract height from measurement_details_json (replaces max_z_height_mm)
     */
    _extractPrintHeight(job) {
        if (!job.measurement_details_json) {
            logger.warn(`[OrchestratorService] No measurement details for job ${job.id}`);
            return 0;
        }
        
        try {
            const measurements = typeof job.measurement_details_json === 'string' 
                ? JSON.parse(job.measurement_details_json)
                : job.measurement_details_json;
            
            // Extract z field (height) from measurements
            const height = measurements.z || measurements.height_mm || measurements.z_mm || 0;
            return height;
        } catch (error) {
            logger.error(`[OrchestratorService] Error parsing measurement details for job ${job.id}:`, error.message);
            return 0;
        }
    }

    /**
     * Initialize the orchestrator service
     * Sets up event listeners and prepares for conflict resolution
     */
    async initialize() {
        if (this.isInitialized) {
            logger.warn('[OrchestratorService] Already initialized');
            return;
        }

        try {
            logger.info('[OrchestratorService] Initializing orchestrator service...');
            
            // Set up event listener for rack state changes
            rackEventEmitter.on('rackStateChanged', this.handleRackStateChange.bind(this));
            
            // Set max listeners to support multiple components
            rackEventEmitter.setMaxListeners(25);
            
            // Initialize rack state cache
            await this._initializeRackStateCache();
            
            // === ENHANCED: Initialize Job Processing ===
            await this._initializeSlotManagers();
            await this._startJobProcessing();
            
            this.isInitialized = true;
            logger.info('[OrchestratorService] Enhanced orchestrator service initialized successfully');
            
            // Emit initialization complete event
            this.emit('initialized');
            
        } catch (error) {
            logger.error('[OrchestratorService] Failed to initialize:', error.message);
            throw error;
        }
    }

    /**
     * Main event handler for rack state changes
     * Filters out self-triggered events and detects conflicts
     */
    async handleRackStateChange(eventPayload) {
        if (this.isShuttingDown) {
            logger.debug('[OrchestratorService] Ignoring event during shutdown');
            return;
        }

        const { rackId, shelfId, previousState, newState, triggeredBy, eventType } = eventPayload;
        
        // Update stats
        this.eventProcessingStats.total_events++;
        
        // Ignore events triggered by orchestrator itself
        if (triggeredBy === 'orchestrator') {
            logger.debug(`[OrchestratorService] Ignoring self-triggered event: Rack ${rackId}, Shelf ${shelfId}`);
            return;
        }
        
        logger.info(`[OrchestratorService] Processing manual rack change: Rack ${rackId}, Shelf ${shelfId}: ${previousState} → ${newState} (${eventType})`);
        
        try {
            // Invalidate cached rack state
            this.rackStateCache.delete(rackId);
            
            // Detect and resolve conflicts
            await this.detectAndResolveConflicts(eventPayload);
            
        } catch (error) {
            logger.error(`[OrchestratorService] Error processing rack state change: ${error.message}`, error);
            
            // Emit error event for monitoring
            this.emit('eventProcessingError', {
                eventPayload,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // ===================================================================
    // ENHANCED: AUTOMATIC JOB PROCESSING METHODS
    // ===================================================================

    /**
     * Initialize AdvancedSlotManager instances for all racks
     */
    async _initializeSlotManagers() {
        try {
            const racks = await dbAll('SELECT id, name, shelf_count, shelf_spacing_mm FROM storage_racks');
            
            logger.info(`[OrchestratorService] Initializing slot managers for ${racks.length} racks`);
            
            for (const rack of racks) {
                const slotManager = new AdvancedSlotManager({
                    id: rack.id,
                    name: rack.name,
                    shelf_count: rack.shelf_count,
                    shelf_spacing_mm: rack.shelf_spacing_mm
                });
                
                this.slotManagers.set(rack.id, slotManager);
                logger.debug(`[OrchestratorService] Initialized slot manager for rack ${rack.name} (ID: ${rack.id})`);
            }
            
            logger.info('[OrchestratorService] Slot managers initialized successfully');
            
        } catch (error) {
            logger.error('[OrchestratorService] Error initializing slot managers:', error.message);
            throw error;
        }
    }

    /**
     * Start automatic job processing
     */
    async _startJobProcessing() {
        if (!this.jobProcessingEnabled) {
            logger.info('[OrchestratorService] Job processing is disabled');
            return;
        }
        
        logger.info('[OrchestratorService] Starting automatic job processing...');
        
        // Clear any existing interval to prevent memory leaks
        if (this.jobPollingInterval) {
            clearInterval(this.jobPollingInterval);
            this.jobPollingInterval = null;
        }
        
        // Start polling for queued jobs every 5 seconds
        this.jobPollingInterval = setInterval(async () => {
            if (!this.isShuttingDown) {
                await this.processQueuedJobs();
            }
        }, 5000);
        
        logger.info('[OrchestratorService] Job processing started');
    }

    /**
     * Main job processing method - finds and processes queued jobs with auto_start=true
     */
    async processQueuedJobs() {
        try {
            // Find jobs that are queued and have auto_start=true
            const queuedJobs = await dbAll(`
                SELECT pj.*, pi.measurement_details_json, pi.file_details_json
                FROM print_jobs pj
                LEFT JOIN print_items pi ON pj.print_item_id = pi.id
                WHERE pj.status = 'QUEUED' 
                AND pj.auto_start = 1
                AND pj.assigned_rack_id IS NULL
                ORDER BY pj.priority ASC, pj.submitted_at ASC
                LIMIT 10
            `);
            
            if (queuedJobs.length === 0) {
                return; // No jobs to process
            }
            
            logger.info(`[OrchestratorService] Processing ${queuedJobs.length} queued jobs`);
            
            for (const job of queuedJobs) {
                await this._processIndividualJob(job);
            }
            
        } catch (error) {
            logger.error('[OrchestratorService] Error processing queued jobs:', error.message);
        }
    }

    /**
     * Process an individual job through the complete workflow
     */
    async _processIndividualJob(job) {
        const startTime = Date.now();
        
        try {
            const printHeight = this._extractPrintHeight(job);
            logger.info(`[OrchestratorService] Processing job ${job.id}: ${job.file_details_json ? JSON.parse(job.file_details_json).name : 'Unknown'} (Height: ${printHeight}mm)`);
            
            // Step 1: Height-aware slot assignment
            const slotAssignment = await this.assignSlotsForJob(job);
            if (!slotAssignment.success) {
                logger.warn(`[OrchestratorService] Cannot assign slots for job ${job.id}: ${slotAssignment.reason}`);
                return;
            }
            
            // Step 2: Find available printer
            const availablePrinter = await this._findAvailablePrinter(job);
            if (!availablePrinter) {
                logger.debug(`[OrchestratorService] No available printer for job ${job.id}, will retry later`);
                return;
            }
            
            // Step 3: Update job with assignments
            await this._updateJobAssignments(job.id, {
                printer_id: availablePrinter.id,
                assigned_rack_id: slotAssignment.rackId,
                assigned_store_slot: slotAssignment.storeSlot,
                assigned_grab_slot: slotAssignment.grabSlot,
                effective_clearance_mm: slotAssignment.clearance,
                slot_assignment_reason: slotAssignment.reason,
                orchestration_status: 'assigned'
            });
            
            // Step 4: Create workflow tracker
            this.activeWorkflows.set(job.id, {
                jobId: job.id,
                printerId: availablePrinter.id,
                rackId: slotAssignment.rackId,
                storeSlot: slotAssignment.storeSlot,
                grabSlot: slotAssignment.grabSlot,
                phase: 'assigned',
                startTime: Date.now(),
                lastUpdate: Date.now()
            });
            
            // === NEW: Step 5: Execute complete print workflow ===
            await this._executeFullPrintWorkflow(job.id);
            
            // Update statistics
            this.jobProcessingStats.jobs_processed++;
            this.jobProcessingStats.jobs_assigned_slots++;
            this.jobProcessingStats.printers_utilized.add(availablePrinter.id);
            
            const processingTime = Date.now() - startTime;
            this.jobProcessingStats.average_processing_time_ms = 
                (this.jobProcessingStats.average_processing_time_ms + processingTime) / 2;
            
            logger.info(`[OrchestratorService] Job ${job.id} successfully assigned to printer ${availablePrinter.id}, slots: store=${slotAssignment.storeSlot}, grab=${slotAssignment.grabSlot}`);
            
            // Emit job assigned event
            this.emit('jobAssigned', {
                jobId: job.id,
                printerId: availablePrinter.id,
                rackId: slotAssignment.rackId,
                storeSlot: slotAssignment.storeSlot,
                grabSlot: slotAssignment.grabSlot,
                processingTimeMs: processingTime
            });
            
        } catch (error) {
            logger.error(`[OrchestratorService] Error processing job ${job.id}:`, error.message);
            this.jobProcessingStats.jobs_failed++;
            
            // Emit job failed event
            this.emit('jobFailed', {
                jobId: job.id,
                error: error.message,
                phase: 'assignment'
            });
        }
    }

    /**
     * Enhanced slot assignment with queue awareness
     */
    async assignSlotsForJob(job, queuePosition = 0) {
        try {
            // Get upcoming jobs in queue for lookahead optimization
            const upcomingJobs = await dbAll(`
                SELECT pj.*, pi.measurement_details_json
                FROM print_jobs pj
                JOIN print_items pi ON pj.print_item_id = pi.id
                WHERE pj.status = 'QUEUED' 
                AND pj.auto_start = 1
                AND pj.id != ?
                ORDER BY pj.priority ASC, pj.submitted_at ASC
                LIMIT 5
            `, [job.id]);
            
            // Try each rack
            const racks = await dbAll('SELECT * FROM storage_racks');
            
            for (const rack of racks) {
                // Ensure we have a slot manager for this rack
                if (!this.slotManagers.has(rack.id)) {
                    logger.info(`[Orchestrator] Creating missing slot manager for rack ${rack.id} (${rack.name})`);
                    const slotManager = new AdvancedSlotManager({
                        id: rack.id,
                        name: rack.name,
                        shelf_count: rack.shelf_count,
                        shelf_spacing_mm: rack.shelf_spacing_mm
                    });
                    this.slotManagers.set(rack.id, slotManager);
                }
                
                const slotManager = this.slotManagers.get(rack.id);
                if (!slotManager) {
                    logger.warn(`[Orchestrator] No slot manager for rack ${rack.id}`);
                    continue;
                }
                
                const rackState = await this.getCurrentRackState(rack.id);
                
                // Find optimal storage with lookahead
                const printHeight = this._extractPrintHeight(job);
                const storageResult = slotManager.findOptimalStorageSlot(
                    printHeight,
                    rackState,
                    upcomingJobs
                );
                
                if (!storageResult.canFit) {
                    logger.debug(`[Orchestrator] Rack ${rack.id} cannot fit ${printHeight}mm print`);
                    continue;
                }
                
                // Find grab slot if needed
                let grabSlot = null;
                if (storageResult.requiresPlate || storageResult.grabSlot) {
                    // If grabSlot already determined by SlotManager, use it
                    if (storageResult.grabSlot) {
                        grabSlot = storageResult.grabSlot;
                    } else {
                        // Fallback to finding grab slot
                        const grabResult = slotManager.findOptimalGrabSlot(rackState);
                        if (!grabResult.available) {
                            logger.warn(`[Orchestrator] Storage needs plate but none available in rack ${rack.id}`);
                            continue;
                        }
                        grabSlot = grabResult.slot;
                    }
                }
                
                logger.info(`[Orchestrator] Assigned job ${job.id}: rack=${rack.id}, store=${storageResult.slot}, grab=${grabSlot}`);
                
                return {
                    success: true,
                    rackId: rack.id,
                    storeSlot: storageResult.slot,
                    grabSlot: grabSlot,
                    clearance: storageResult.clearance,
                    strategy: storageResult.strategy,
                    score: storageResult.score,
                    reason: storageResult.reason
                };
            }
            
            // No rack can accommodate
            const printHeight = this._extractPrintHeight(job);
            return {
                success: false,
                reason: `No rack can accommodate ${printHeight}mm print with current configuration`
            };
            
        } catch (error) {
            logger.error(`[Orchestrator] Error assigning slots: ${error.message}`);
            return { success: false, reason: error.message };
        }
    }

    /**
     * Find an available printer for the job
     */
    async _findAvailablePrinter(job) {
        try {
            // Get all printers that match job requirements
            const printers = await printerService.getAllPrinters();
            
            for (const printer of printers) {
                // Check if printer is idle and available
                if (printer.status === 'IDLE' || printer.status === 'FINISH') {
                    logger.debug(`[OrchestratorService] Found available printer: ${printer.name} (ID: ${printer.id})`);
                    return printer;
                }
            }
            
            return null; // No available printers
            
        } catch (error) {
            logger.error('[OrchestratorService] Error finding available printer:', error.message);
            return null;
        }
    }

    /**
     * Update job with orchestration assignments
     */
    async _updateJobAssignments(jobId, assignments) {
        try {
            const updateFields = [];
            const updateValues = [];
            
            for (const [field, value] of Object.entries(assignments)) {
                updateFields.push(`${field} = ?`);
                updateValues.push(value);
            }
            
            updateValues.push(jobId);
            
            const sql = `UPDATE print_jobs SET ${updateFields.join(', ')} WHERE id = ?`;
            await dbRun(sql, updateValues);
            
            logger.debug(`[OrchestratorService] Updated job ${jobId} assignments:`, assignments);
            
        } catch (error) {
            logger.error(`[OrchestratorService] Error updating job ${jobId} assignments:`, error.message);
            throw error;
        }
    }

    // ===================================================================
    // PHASE 3: COMPLETE PRINT WORKFLOW EXECUTION
    // ===================================================================

    /**
     * Execute the complete print-to-storage workflow for a job
     * FIXED: Only execute post-print workflow after print completion is detected
     */
    async _executeFullPrintWorkflow(jobId) {
        const workflow = this.activeWorkflows.get(jobId);
        if (!workflow) {
            throw new Error(`No workflow found for job ${jobId}`);
        }

        try {
            logger.info(`[OrchestratorService] Starting complete workflow for job ${jobId}`);
            
            // Phase 1: Pre-print setup (load plate)
            await this._executePrePrintWorkflow(workflow);
            
            // Phase 2: Start print and monitor (DO NOT await post-print here!)
            await this._executePrintPhase(workflow);
            
            // NOTE: Post-print workflow is triggered by progress monitoring
            // when print completion is detected in _startPrintProgressMonitoring
            
            logger.info(`[OrchestratorService] Print started and monitoring active for job ${jobId}`);
            
        } catch (error) {
            logger.error(`[OrchestratorService] Workflow failed for job ${jobId}:`, error.message);
            
            // Update workflow status
            workflow.phase = 'failed';
            workflow.error = error.message;
            workflow.lastUpdate = Date.now();
            
            // Update job status
            await this._updateJobAssignments(jobId, {
                status: 'FAILED',
                orchestration_status: 'failed'
            });
            
            this.jobProcessingStats.jobs_failed++;
            
            // Emit workflow failed event
            this.emit('workflowFailed', {
                jobId,
                error: error.message,
                phase: workflow.phase
            });
            
            throw error;
        }
    }

    /**
     * Phase 1: Pre-print setup - Load clean plate onto printer
     */
    async _executePrePrintWorkflow(workflow) {
        workflow.phase = 'pre_print';
        workflow.lastUpdate = Date.now();
        
        logger.info(`[OrchestratorService] Executing pre-print workflow for job ${workflow.jobId}`);
        
        try {
            // If grabSlot is specified, load a plate from that slot
            if (workflow.grabSlot) {
                // Get OttoEject for this rack
                const ottoeject = await this._getOttoejectForRack(workflow.rackId);
                if (ottoeject) {
                    // Execute grab and load sequence
                    await this._executeGrabAndLoadSequence(ottoeject.id, workflow.grabSlot, workflow.printerId);
                } else {
                    logger.warn(`[OrchestratorService] No OttoEject found for rack ${workflow.rackId}, skipping plate loading`);
                }
            }
            
            workflow.phase = 'ready_to_print';
            workflow.lastUpdate = Date.now();
            
            logger.info(`[OrchestratorService] Pre-print workflow completed for job ${workflow.jobId}`);
            
        } catch (error) {
            logger.error(`[OrchestratorService] Pre-print workflow failed for job ${workflow.jobId}:`, error.message);
            throw error;
        }
    }

    /**
     * Phase 2: Start print and monitor progress until completion
     */
    async _executePrintPhase(workflow) {
        workflow.phase = 'printing';
        workflow.lastUpdate = Date.now();
        
        try {
            // Get job details for the print file
            const job = await dbGet('SELECT pj.*, pi.file_details_json FROM print_jobs pj LEFT JOIN print_items pi ON pj.print_item_id = pi.id WHERE pj.id = ?', [workflow.jobId]);
            
            if (!job) {
                throw new Error(`Job ${workflow.jobId} not found in database`);
            }
            
            // Extract filename from job data
            let filename = 'unknown.gcode';
            if (job.file_details_json) {
                try {
                    const fileDetails = JSON.parse(job.file_details_json);
                    filename = fileDetails.name;
                } catch (e) {
                    logger.warn(`[OrchestratorService] Could not parse file details for job ${workflow.jobId}`);
                }
            }
            
            logger.info(`[OrchestratorService] Starting print for job ${workflow.jobId}: ${filename}`);
            
            // Start the print
            const printResult = await printerService.commandStartPrint(workflow.printerId, filename);
            
            if (!printResult.success) {
                throw new Error(`Failed to start print: ${printResult.message}`);
            }
            
            // Update job status to printing
            await this._updateJobAssignments(workflow.jobId, {
                status: 'PRINTING',
                orchestration_status: 'printing',
                started_at: new Date().toISOString()
            });
            
            this.jobProcessingStats.jobs_dispatched++;
            
            logger.info(`[OrchestratorService] Print started successfully for job ${workflow.jobId}`);
            
            // Start monitoring print progress
            this._startPrintProgressMonitoring(workflow);
            
        } catch (error) {
            logger.error(`[OrchestratorService] Print phase failed for job ${workflow.jobId}:`, error.message);
            throw error;
        }
    }

    /**
     * Monitor print progress until completion
     * FIXED: Wait 2 minutes before acting on status to avoid stale previous job status
     */
    async _startPrintProgressMonitoring(workflow) {
        const printerId = workflow.printerId;
        const jobId = workflow.jobId;
        
        logger.info(`[OrchestratorService] Starting progress monitoring for job ${jobId} on printer ${printerId}`);
        
        // CRITICAL: Wait 2 minutes before acting on print status
        // This prevents acting on stale status from previous print job
        const startTime = Date.now();
        const twoMinutesMs = 2 * 60 * 1000;
        
        // Monitor print status every 30 seconds
        const monitorInterval = setInterval(async () => {
            try {
                const elapsedTime = Date.now() - startTime;
                
                // For the first 2 minutes, just log but don't act on status
                if (elapsedTime < twoMinutesMs) {
                    const remainingWait = Math.ceil((twoMinutesMs - elapsedTime) / 1000);
                    logger.debug(`[OrchestratorService] Monitoring job ${jobId} (waiting ${remainingWait}s before acting on status)`);
                    return;
                }
                
                const printerStatus = await printerService.getPrinterLiveDetails(printerId);
                
                if (!printerStatus.success) {
                    logger.warn(`[OrchestratorService] Could not get printer ${printerId} status for job ${jobId}`);
                    return;
                }
                
                const status = printerStatus.data.status;
                const progress = printerStatus.data.progress_percent || 0;
                
                logger.debug(`[OrchestratorService] Print progress for job ${jobId}: ${status} (${progress}%)`);
                
                // Check if print is completed
                if (status === 'FINISH' || (status === 'IDLE' && progress >= 99)) {
                    clearInterval(monitorInterval);
                    
                    logger.info(`[OrchestratorService] Print completed for job ${jobId}`);
                    
                    // Update job status
                    await this._updateJobAssignments(jobId, {
                        status: 'COMPLETED',
                        finished_printing_at: new Date().toISOString(),
                        progress_percent: 100
                    });
                    
                    // Move to post-print phase
                    workflow.phase = 'print_completed';
                    workflow.lastUpdate = Date.now();
                    
                    // NOW execute post-print workflow (eject/store sequence)
                    logger.info(`[OrchestratorService] Print completed - starting post-print workflow for job ${jobId}`);
                    this._executePostPrintWorkflow(workflow)
                        .catch(error => {
                            logger.error(`[OrchestratorService] Post-print workflow failed for job ${jobId}:`, error.message);
                            workflow.phase = 'failed';
                            workflow.error = error.message;
                        });
                        
                } else if (status === 'FAILED' || status === 'PAUSED') {
                    clearInterval(monitorInterval);
                    
                    logger.error(`[OrchestratorService] Print failed or paused for job ${jobId}: ${status}`);
                    
                    // Update job status
                    await this._updateJobAssignments(jobId, {
                        status: 'FAILED',
                        orchestration_status: 'failed'
                    });
                    
                    workflow.phase = 'failed';
                    workflow.error = `Print ${status.toLowerCase()}`;
                    workflow.lastUpdate = Date.now();
                    
                    this.jobProcessingStats.jobs_failed++;
                }
                
            } catch (error) {
                logger.error(`[OrchestratorService] Error monitoring print progress for job ${jobId}:`, error.message);
            }
        }, 30000); // Monitor every 30 seconds
        
        // Store interval reference for cleanup
        workflow.monitorInterval = monitorInterval;
    }

    /**
     * Phase 3: Post-print workflow - Eject completed print and store
     */
    async _executePostPrintWorkflow(workflow) {
        workflow.phase = 'post_print';
        workflow.lastUpdate = Date.now();
        
        try {
            logger.info(`[OrchestratorService] Executing post-print workflow for job ${workflow.jobId}`);
            
            // Get OttoEject for this rack
            const ottoeject = await this._getOttoejectForRack(workflow.rackId);
            if (!ottoeject) {
                logger.warn(`[OrchestratorService] No OttoEject found for rack ${workflow.rackId}, skipping eject/store workflow`);
                await this._finalizeJob(workflow.jobId);
                return;
            }
            
            // Get job height for tracking
            const job = await dbGet(
                'SELECT pi.measurement_details_json FROM print_jobs pj JOIN print_items pi ON pj.print_item_id = pi.id WHERE pj.id = ?',
                [workflow.jobId]
            );
            const printHeight = job ? this._extractPrintHeight(job) : null;
            
            // Execute eject and store sequence
            await this._executeEjectAndStoreSequence(ottoeject.id, workflow.printerId, workflow.storeSlot, printHeight);
            
            // Check if there are more jobs queued - if not, this is the final job
            const remainingJobs = await dbAll(
                'SELECT id FROM print_jobs WHERE status = ? AND auto_start = 1 AND id != ?',
                ['QUEUED', workflow.jobId]
            );
            
            const isFinalJob = remainingJobs.length === 0;
            
            if (isFinalJob) {
                // FINAL JOB SEQUENCE: Check if printer has door and close it
                const printerInfo = await this._getPrinterInfo(workflow.printerId);
                
                if (this._printerHasDoor(printerInfo)) {
                    const doorClosingMacro = this._getDoorClosingMacro(printerInfo);
                    
                    if (doorClosingMacro) {
                        logger.info(`[OrchestratorService] Final job completed - closing door on ${printerInfo.brand} ${printerInfo.model}`);
                        await ottoejectService.executeMacro(ottoeject.id, doorClosingMacro);
                        await this._waitForOttoejectIdle(ottoeject.id);
                        logger.info(`[OrchestratorService] Door closed successfully`);
                    }
                } else {
                    logger.info(`[OrchestratorService] Final job completed - ${printerInfo.brand} ${printerInfo.model} does not have a door to close`);
                }
            } else {
                // MORE JOBS QUEUED: Execute grab and load sequence for next job
                if (workflow.grabSlot) {
                    logger.info(`[OrchestratorService] More jobs queued - executing grab and load sequence`);
                    await this._executeGrabAndLoadSequence(ottoeject.id, workflow.grabSlot, workflow.printerId);
                }
            }
            
            // Park OttoEject (final step)
            logger.info(`[OrchestratorService] Parking OttoEject after post-print workflow`);
            await ottoejectService.executeMacro(ottoeject.id, 'PARK_OTTOEJECT');
            await this._waitForOttoejectIdle(ottoeject.id);
            
            // Finalize the job
            await this._finalizeJob(workflow.jobId);
            
            workflow.phase = 'completed';
            workflow.lastUpdate = Date.now();
            
            logger.info(`[OrchestratorService] Post-print workflow completed for job ${workflow.jobId}`);
            
            this.jobProcessingStats.jobs_completed++;
            
            // Remove workflow from active list
            this.activeWorkflows.delete(workflow.jobId);
            
            // Emit workflow completed event
            this.emit('workflowCompleted', {
                jobId: workflow.jobId,
                totalTime: Date.now() - workflow.startTime
            });
            
        } catch (error) {
            logger.error(`[OrchestratorService] Post-print workflow failed for job ${workflow.jobId}:`, error.message);
            throw error;
        }
    }

    /**
     * Execute grab and load sequence for pre-print setup
     */
    async _executeGrabAndLoadSequence(ottoejectId, grabSlot, printerId) {
        logger.info(`[OrchestratorService] Executing grab and load sequence: slot ${grabSlot} → printer ${printerId}`);
        
        try {
            // Home the OttoEject
            logger.info(`[OrchestratorService] Homing OttoEject for grab and load...`);
            await ottoejectService.executeMacro(ottoejectId, 'OTTOEJECT_HOME');
            await this._waitForOttoejectIdle(ottoejectId);
            
            // Grab plate from specified slot
            const grabMacro = `GRAB_FROM_SLOT_${grabSlot}`;
            logger.info(`[OrchestratorService] Grabbing plate from slot ${grabSlot} using macro: ${grabMacro}`);
            await ottoejectService.executeMacro(ottoejectId, grabMacro);
            await this._waitForOttoejectIdle(ottoejectId);
            
            // Load plate onto printer using printer-specific macro
            const printerInfo = await this._getPrinterInfo(printerId);
            const loadMacro = this._getLoadMacroForPrinter(printerInfo);
            
            logger.info(`[OrchestratorService] Loading plate onto ${printerInfo.brand} ${printerInfo.model} using macro: ${loadMacro}`);
            await ottoejectService.executeMacro(ottoejectId, loadMacro);
            await this._waitForOttoejectIdle(ottoejectId);
            
            // Park the OttoEject
            logger.info(`[OrchestratorService] Parking OttoEject after grab and load...`);
            await ottoejectService.executeMacro(ottoejectId, 'PARK_OTTOEJECT');
            await this._waitForOttoejectIdle(ottoejectId);
            
            logger.info(`[OrchestratorService] Grab and load sequence completed successfully`);
            
        } catch (error) {
            logger.error(`[OrchestratorService] Grab and load sequence failed:`, error.message);
            throw error;
        }
    }

    /**
     * Execute eject and store sequence for post-print workflow
     * FIXED: Matches beta testing sequence exactly
     */
    async _executeEjectAndStoreSequence(ottoejectId, printerId, storeSlot, printHeight = null) {
        logger.info(`[OrchestratorService] Executing eject and store sequence: printer ${printerId} → slot ${storeSlot}`);
        
        // Update slot manager with print height if provided
        if (printHeight && storeSlot) {
            const workflow = this.activeWorkflows.values().next().value;
            if (workflow && workflow.rackId) {
                const slotManager = this.slotManagers.get(workflow.rackId);
                if (slotManager) {
                    slotManager.recordPrintStorage(storeSlot, printHeight);
                }
            }
        }
        
        try {
            // STEP 1: Send G-code to position printer bed (Bambu & FlashForge only)
            await this._positionPrinterBedForEjection(printerId);
            
            // STEP 2: Home the OttoEject
            logger.info(`[OrchestratorService] Homing OttoEject...`);
            await ottoejectService.executeMacro(ottoejectId, 'OTTOEJECT_HOME');
            await this._waitForOttoejectIdle(ottoejectId);
            
            // STEP 3: Execute printer-specific eject macro
            const printerInfo = await this._getPrinterInfo(printerId);
            const ejectMacro = this._getEjectMacroForPrinter(printerInfo);
            
            logger.info(`[OrchestratorService] Ejecting from ${printerInfo.brand} ${printerInfo.model} using macro: ${ejectMacro}`);
            await ottoejectService.executeMacro(ottoejectId, ejectMacro);
            await this._waitForOttoejectIdle(ottoejectId);
            
            // STEP 4: Store in specified slot
            const storeMacro = `STORE_TO_SLOT_${storeSlot}`;
            logger.info(`[OrchestratorService] Storing print in slot ${storeSlot} using macro: ${storeMacro}`);
            await ottoejectService.executeMacro(ottoejectId, storeMacro);
            await this._waitForOttoejectIdle(ottoejectId);
            
            logger.info(`[OrchestratorService] Eject and store sequence completed successfully`);
            
        } catch (error) {
            logger.error(`[OrchestratorService] Eject and store sequence failed:`, error.message);
            throw error;
        }
    }

    /**
     * Wait for OttoEject to become idle
     */
    async _waitForOttoejectIdle(ottoejectId, timeoutMs = 180000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeoutMs) {
            const statusResult = await ottoejectService.getOttoejectLiveStatus(ottoejectId);
            
            if (statusResult.success && statusResult.data.status === 'ONLINE') {
                return true;
            }
            
            // Wait 3 seconds before checking again
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        throw new Error(`OttoEject ${ottoejectId} did not become idle within ${timeoutMs/1000} seconds`);
    }

    /**
     * Position printer bed for ejection (Bambu & FlashForge only)
     */
    async _positionPrinterBedForEjection(printerId) {
        try {
            const printerInfo = await this._getPrinterInfo(printerId);
            
            if (!printerInfo || !printerInfo.brand) {
                logger.warn(`[OrchestratorService] No printer brand info for printer ${printerId} - skipping bed positioning`);
                return;
            }
            
            const brand = printerInfo.brand.toLowerCase();
            const model = printerInfo.model ? printerInfo.model.toLowerCase() : '';
            
            // Only Bambu and FlashForge printers need bed positioning
            if (!brand.includes('bambu') && !brand.includes('flashforge')) {
                logger.info(`[OrchestratorService] Printer ${printerInfo.brand} ${printerInfo.model} does not need bed positioning`);
                return;
            }
            
            let gcode = '';
            
            // Bambu Lab bed positioning based on model
            if (brand.includes('bambu')) {
                if (model.includes('a1')) {
                    // A1 is sling bed - use Y positioning
                    gcode = 'G90\nG1 Y170 F600';
                    logger.info(`[OrchestratorService] Positioning Bambu A1 sling bed to Y170 for ejection`);
                } else {
                    // P1P, P1S, X1C are Z-bed - use Z positioning
                    gcode = 'G90\nG1 Z200 F600';
                    logger.info(`[OrchestratorService] Positioning Bambu ${printerInfo.model} bed to Z200 for ejection`);
                }
            } else if (brand.includes('flashforge')) {
                // FlashForge printers use Z positioning
                gcode = 'G90\nG1 Z200 F600';
                logger.info(`[OrchestratorService] Positioning FlashForge ${printerInfo.model} bed to Z200 for ejection`);
            }
            
            if (gcode) {
                const result = await printerService.commandSendGcode(printerId, gcode);
                if (result.success) {
                    logger.info(`[OrchestratorService] Bed positioning G-code sent successfully`);
                    // Wait for bed movement to complete
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } else {
                    logger.warn(`[OrchestratorService] Failed to send bed positioning G-code: ${result.message}`);
                }
            }
            
        } catch (error) {
            logger.error(`[OrchestratorService] Error positioning printer bed:`, error.message);
            // Don't throw error - continue with ejection even if bed positioning fails
        }
    }

    /**
     * Get printer information from database
     */
    async _getPrinterInfo(printerId) {
        try {
            const printer = await dbGet('SELECT name, brand, model, type FROM printers WHERE id = ?', [printerId]);
            return printer || { brand: 'Unknown', model: 'Unknown', type: 'unknown' };
        } catch (error) {
            logger.error(`[OrchestratorService] Error getting printer info for ID ${printerId}:`, error.message);
            return { brand: 'Unknown', model: 'Unknown', type: 'unknown' };
        }
    }

    /**
     * Get eject macro name for specific printer model
     */
    _getEjectMacroForPrinter(printerInfo) {
        const brand = printerInfo.brand ? printerInfo.brand.toLowerCase() : '';
        const model = printerInfo.model ? printerInfo.model.toLowerCase() : '';
        
        // Map printer models to eject macros (based on macro_names.txt)
        if (brand.includes('bambu')) {
            if (model.includes('a1')) {
                return 'EJECT_FROM_BAMBULAB_A_ONE';
            } else if (model.includes('p1s')) {
                return 'EJECT_FROM_BAMBULAB_P_ONE_S';
            } else if (model.includes('p1p')) {
                return 'EJECT_FROM_BAMBULAB_P_ONE_P';
            } else if (model.includes('x1c')) {
                return 'EJECT_FROM_BAMBULAB_P_ONE_S'; // X1C uses same as P1S
            }
        } else if (brand.includes('anycubic')) {
            if (model.includes('kobra') && model.includes('s1')) {
                return 'EJECT_FROM_ANYCUBIC_KOBRA_S_ONE';
            }
        } else if (brand.includes('elegoo')) {
            if (model.includes('centauri') || model.includes('carbon')) {
                return 'EJECT_FROM_ELEGOO_CC';
            }
        } else if (brand.includes('creality')) {
            if (model.includes('k1c')) {
                return 'EJECT_FROM_CREALITY_K_ONE_C';
            }
        } else if (brand.includes('flashforge')) {
            if (model.includes('ad5x')) {
                return 'EJECT_FROM_FLASHFORGE_AD_FIVE_X';
            }
        }
        
        // Fallback to generic macro
        logger.warn(`[OrchestratorService] Unknown printer ${brand} ${model} - using generic eject macro`);
        return `EJECT_FROM_GENERIC_PRINTER`;
    }

    /**
     * Get load macro name for specific printer model
     */
    _getLoadMacroForPrinter(printerInfo) {
        const brand = printerInfo.brand ? printerInfo.brand.toLowerCase() : '';
        const model = printerInfo.model ? printerInfo.model.toLowerCase() : '';
        
        // Map printer models to load macros (based on macro_names.txt)
        if (brand.includes('bambu')) {
            if (model.includes('a1')) {
                return 'LOAD_ONTO_BAMBULAB_A_ONE';
            } else if (model.includes('p1s')) {
                return 'LOAD_ONTO_BAMBULAB_P_ONE_S';
            } else if (model.includes('p1p')) {
                return 'LOAD_ONTO_BAMBULAB_P_ONE_P';
            } else if (model.includes('x1c')) {
                return 'LOAD_ONTO_BAMBULAB_P_ONE_S'; // X1C uses same as P1S
            }
        } else if (brand.includes('anycubic')) {
            if (model.includes('kobra') && model.includes('s1')) {
                return 'LOAD_ONTO_ANYCUBIC_KOBRA_S_ONE';
            }
        } else if (brand.includes('elegoo')) {
            if (model.includes('centauri') || model.includes('carbon')) {
                return 'LOAD_ONTO_ELEGOO_CC';
            }
        } else if (brand.includes('creality')) {
            if (model.includes('k1c')) {
                return 'LOAD_ONTO_CREALITY_K_ONE_C';
            }
        } else if (brand.includes('flashforge')) {
            if (model.includes('ad5x')) {
                return 'LOAD_ONTO_FLASHFORGE_AD_FIVE_X';
            }
        }
        
        // Fallback to generic macro
        logger.warn(`[OrchestratorService] Unknown printer ${brand} ${model} - using generic load macro`);
        return `LOAD_ONTO_GENERIC_PRINTER`;
    }

    /**
     * Check if printer has a door for closing
     */
    _printerHasDoor(printerInfo) {
        const brand = printerInfo.brand ? printerInfo.brand.toLowerCase() : '';
        const model = printerInfo.model ? printerInfo.model.toLowerCase() : '';
        
        // Only these printers have doors (based on user requirements)
        if (brand.includes('bambu')) {
            return model.includes('p1s') || model.includes('x1c');
        }
        // Note: Creality K1C and Anycubic Kobra S1 also have doors, but user said "only Bambu for now"
        
        return false;
    }

    /**
     * Get door closing macro for specific printer
     */
    _getDoorClosingMacro(printerInfo) {
        const brand = printerInfo.brand ? printerInfo.brand.toLowerCase() : '';
        const model = printerInfo.model ? printerInfo.model.toLowerCase() : '';
        
        if (brand.includes('bambu')) {
            if (model.includes('p1s')) {
                return 'CLOSE_DOOR_BAMBULAB_P_ONE_S';
            } else if (model.includes('x1c')) {
                return 'CLOSE_DOOR_BAMBULAB_P_ONE_S'; // X1C uses same as P1S
            }
        }
        
        return null;
    }

    /**
     * Get OttoEject device associated with a rack
     */
    async _getOttoejectForRack(rackId) {
        try {
            // For now, get the first available OttoEject
            // In future, racks should have ottoeject_id associations
            const ottoejects = await ottoejectService.getAllOttoejects();
            
            if (ottoejects.length > 0) {
                return ottoejects[0]; // Use first available OttoEject
            }
            
            return null;
            
        } catch (error) {
            logger.error(`[OrchestratorService] Error getting OttoEject for rack ${rackId}:`, error.message);
            return null;
        }
    }

    /**
     * Finalize job completion
     */
    async _finalizeJob(jobId) {
        try {
            await this._updateJobAssignments(jobId, {
                status: 'COMPLETED',
                orchestration_status: 'completed',
                completed_at: new Date().toISOString()
            });
            
            logger.info(`[OrchestratorService] Job ${jobId} finalized as completed`);
            
        } catch (error) {
            logger.error(`[OrchestratorService] Error finalizing job ${jobId}:`, error.message);
            throw error;
        }
    }

    // ===================================================================
    // EXISTING CONFLICT RESOLUTION METHODS
    // ===================================================================

    /**
     * Detect conflicts between manual rack changes and active print jobs
     */
    async detectAndResolveConflicts(eventPayload) {
        const { rackId, shelfId, previousState, newState } = eventPayload;
        
        // Find all active jobs that might be affected by this change
        const affectedJobs = await this._findJobsAffectedByShelfChange(rackId, shelfId, previousState, newState);
        
        if (affectedJobs.length === 0) {
            logger.debug(`[OrchestratorService] No active jobs affected by rack ${rackId} shelf ${shelfId} change`);
            return;
        }
        
        logger.warn(`[OrchestratorService] Found ${affectedJobs.length} jobs potentially affected by shelf change`);
        this.eventProcessingStats.conflicts_detected++;
        
        // Emit conflict detected event
        this.emit('conflictDetected', {
            rackId,
            shelfId,
            affectedJobs: affectedJobs.map(job => ({
                id: job.id,
                conflictType: job.conflictType,
                conflictedSlot: job.conflictedSlot
            })),
            timestamp: new Date().toISOString()
        });
        
        // Resolve each conflict
        for (const job of affectedJobs) {
            await this.conflictResolver.resolveJobConflict(job, eventPayload);
        }
    }

    /**
     * Find print jobs affected by a shelf state change
     */
    async _findJobsAffectedByShelfChange(rackId, shelfId, previousState, newState) {
        const affectedJobs = [];
        
        try {
            // Query active jobs using this rack
            const activeJobs = await dbAll(`
                SELECT pj.id, pj.assigned_rack_id, pj.assigned_store_slot, pj.assigned_grab_slot, 
                       pj.orchestration_status, pj.status,
                       pi.measurement_details_json
                FROM print_jobs pj
                LEFT JOIN print_items pi ON pj.print_item_id = pi.id
                WHERE pj.assigned_rack_id = ? 
                AND pj.status IN ('QUEUED', 'PRINTING')
                AND pj.orchestration_status IN ('waiting', 'printing', 'ejecting')
            `, [rackId]);
            
            for (const job of activeJobs) {
                // Check for store conflicts (planned to store but slot now occupied)
                if (job.assigned_store_slot === shelfId && 
                    previousState === 'empty' && 
                    newState === 'occupied') {
                    
                    affectedJobs.push({
                        ...job,
                        conflictType: 'store_destination_occupied',
                        conflictedSlot: shelfId
                    });
                }
                
                // Check for grab conflicts (planned to grab but slot now empty)
                if (job.assigned_grab_slot === shelfId && 
                    previousState === 'occupied' && 
                    newState === 'empty') {
                    
                    affectedJobs.push({
                        ...job,
                        conflictType: 'grab_source_empty',
                        conflictedSlot: shelfId
                    });
                }
            }
            
        } catch (error) {
            logger.error(`[OrchestratorService] Error finding affected jobs: ${error.message}`);
            throw error;
        }
        
        return affectedJobs;
    }

    /**
     * Get current rack state with caching
     */
    async getCurrentRackState(rackId) {
        // Check cache first
        if (this.rackStateCache.has(rackId)) {
            const cached = this.rackStateCache.get(rackId);
            const cacheAge = Date.now() - cached.timestamp;
            
            // Use cache if less than 30 seconds old during active operations
            if (cacheAge < 30000) {
                logger.debug(`[OrchestratorService] Using cached rack state for rack ${rackId} (${Math.round(cacheAge/1000)}s old)`);
                return cached.state;
            }
        }
        
        // Fetch fresh state from database
        const freshState = await this._fetchRackStateFromDatabase(rackId);
        
        // Cache the result
        this.rackStateCache.set(rackId, {
            state: freshState,
            timestamp: Date.now()
        });
        
        return freshState;
    }

    /**
     * Fetch rack state from database with proper state determination
     */
    async _fetchRackStateFromDatabase(rackId) {
        try {
            const slots = await dbAll(`
                SELECT rs.slot_number, rs.type, rs.occupied, rs.print_job_id,
                       rs.has_plate, rs.plate_state,
                       pi.measurement_details_json
                FROM rack_slots rs
                LEFT JOIN print_jobs pj ON rs.print_job_id = pj.id
                LEFT JOIN print_items pi ON pj.print_item_id = pi.id
                WHERE rs.storage_rack_id = ?
                ORDER BY rs.slot_number ASC
            `, [rackId]);
            
            const slotManager = this.slotManagers.get(rackId);
            const rackState = {};
            const printHeights = {};
            
            for (const slot of slots) {
                // Use AdvancedSlotManager to determine state if has_plate column exists
                if ('has_plate' in slot) {
                    // New database schema with plate tracking
                    rackState[slot.slot_number] = slotManager ? 
                        slotManager.determineSlotState(slot) : 
                        this._determineSlotStateFallback(slot);
                } else {
                    // Legacy database without plate tracking
                    // This is temporary until database migration
                    if (slot.occupied && slot.print_job_id) {
                        rackState[slot.slot_number] = 'occupied';
                    } else {
                        // For testing, assume some slots have plates
                        // This should be replaced with proper initialization
                        rackState[slot.slot_number] = 'empty';
                    }
                }
                
                // Track print heights for collision detection
                if (slot.measurement_details_json && slot.occupied) {
                    const height = this._extractPrintHeight(slot);
                    if (height > 0) {
                        printHeights[slot.slot_number] = height;
                    }
                }
            }
            
            // Update slot manager with print heights
            if (slotManager && Object.keys(printHeights).length > 0) {
                slotManager.setPrintHeights(printHeights);
                logger.debug(`[Orchestrator] Set print heights for rack ${rackId}:`, printHeights);
            }
            
            logger.debug(`[Orchestrator] Rack ${rackId} state:`, rackState);
            return rackState;
            
        } catch (error) {
            logger.error(`[Orchestrator] Error fetching rack state: ${error.message}`);
            throw error;
        }
    }

    /**
     * Fallback state determination if no SlotManager available
     */
    _determineSlotStateFallback(slot) {
        if (!slot.has_plate) return 'no_plate';
        if (slot.plate_state === 'with_print') return 'plate_with_print';
        if (slot.plate_state === 'empty') return 'empty_plate';
        return 'no_plate';
    }

    /**
     * Initialize rack state cache for all racks
     */
    async _initializeRackStateCache() {
        try {
            const racks = await dbAll('SELECT id FROM storage_racks');
            
            logger.info(`[OrchestratorService] Initializing cache for ${racks.length} racks`);
            
            for (const rack of racks) {
                await this.getCurrentRackState(rack.id);
            }
            
            logger.info('[OrchestratorService] Rack state cache initialized');
            
        } catch (error) {
            logger.error('[OrchestratorService] Error initializing rack state cache:', error.message);
            throw error;
        }
    }

    /**
     * Invalidate cache for a specific rack
     */
    invalidateRackCache(rackId) {
        if (this.rackStateCache.has(rackId)) {
            this.rackStateCache.delete(rackId);
            logger.debug(`[OrchestratorService] Invalidated cache for rack ${rackId}`);
        }
    }

    /**
     * Invalidate all cached rack states
     */
    invalidateAllCaches() {
        this.rackStateCache.clear();
        logger.info('[OrchestratorService] Invalidated all rack state caches');
    }

    /**
     * Get enhanced orchestrator performance statistics
     */
    getStats() {
        return {
            // Conflict resolution stats
            conflict_resolution: {
                ...this.eventProcessingStats
            },
            
            // === NEW: Job processing stats ===
            job_processing: {
                ...this.jobProcessingStats,
                printers_utilized: Array.from(this.jobProcessingStats.printers_utilized),
                active_workflows: this.activeWorkflows.size,
                processing_enabled: this.jobProcessingEnabled
            },
            
            // System stats
            system: {
                cache_size: this.rackStateCache.size,
                active_conflicts: this.activeConflictResolutions.size,
                slot_managers: this.slotManagers.size,
                is_initialized: this.isInitialized,
                uptime_seconds: process.uptime()
            }
        };
    }

    /**
     * Enable automatic job processing
     */
    enableJobProcessing() {
        if (!this.jobProcessingEnabled) {
            this.jobProcessingEnabled = true;
            logger.info('[OrchestratorService] Job processing enabled');
            
            if (this.isInitialized && !this.jobPollingInterval) {
                this._startJobProcessing();
            }
        }
    }

    /**
     * Disable automatic job processing
     */
    disableJobProcessing() {
        if (this.jobProcessingEnabled) {
            this.jobProcessingEnabled = false;
            logger.info('[OrchestratorService] Job processing disabled');
            
            // FIXED: Properly clear interval to prevent memory leaks
            if (this.jobPollingInterval) {
                clearInterval(this.jobPollingInterval);
                this.jobPollingInterval = null;
                logger.debug('[OrchestratorService] Job polling interval cleared');
            }
        }
    }

    /**
     * Get current job processing status
     */
    getJobProcessingStatus() {
        return {
            enabled: this.jobProcessingEnabled,
            polling_active: !!this.jobPollingInterval,
            active_workflows: Array.from(this.activeWorkflows.values()),
            statistics: this.jobProcessingStats
        };
    }

    /**
     * Manually trigger job processing (for debugging)
     */
    async triggerJobProcessing() {
        logger.info('[OrchestratorService] Manually triggering job processing...');
        await this.processQueuedJobs();
    }

    /**
     * Health check for orchestrator service
     */
    async healthCheck() {
        const health = {
            status: 'healthy',
            checks: {
                initialized: this.isInitialized,
                event_listener_active: rackEventEmitter.listenerCount('rackStateChanged') > 0,
                cache_size_reasonable: this.rackStateCache.size < 100,
                no_stuck_conflicts: this.activeConflictResolutions.size < 10,
                job_processing_functional: this.jobProcessingEnabled && !!this.jobPollingInterval,
                slot_managers_loaded: this.slotManagers.size > 0,
                no_stuck_workflows: this.activeWorkflows.size < 50
            },
            stats: this.getStats(),
            timestamp: new Date().toISOString()
        };
        
        // Check if any health checks failed
        const failedChecks = Object.entries(health.checks).filter(([_, status]) => !status);
        if (failedChecks.length > 0) {
            health.status = 'unhealthy';
            health.failed_checks = failedChecks.map(([check, _]) => check);
        }
        
        return health;
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        if (this.isShuttingDown) {
            logger.warn('[OrchestratorService] Shutdown already in progress');
            return;
        }

        this.isShuttingDown = true;
        logger.info('[OrchestratorService] Starting graceful shutdown...');

        try {
            // Remove event listeners
            rackEventEmitter.removeAllListeners('rackStateChanged');
            
            // === ENHANCED: Stop job processing ===
            if (this.jobPollingInterval) {
                clearInterval(this.jobPollingInterval);
                this.jobPollingInterval = null;
                logger.info('[OrchestratorService] Job polling stopped');
            }
            
            // === NEW: Stop all print monitoring intervals ===
            for (const workflow of this.activeWorkflows.values()) {
                if (workflow.monitorInterval) {
                    clearInterval(workflow.monitorInterval);
                    logger.debug(`[OrchestratorService] Stopped print monitoring for job ${workflow.jobId}`);
                }
            }
            
            // Wait for any active conflict resolutions to complete
            const maxWaitTime = 30000; // 30 seconds
            const startTime = Date.now();
            
            while (this.activeConflictResolutions.size > 0 && (Date.now() - startTime) < maxWaitTime) {
                logger.info(`[OrchestratorService] Waiting for ${this.activeConflictResolutions.size} active conflict resolutions to complete...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Clear all state
            this.invalidateAllCaches();
            this.activeWorkflows.clear();
            this.slotManagers.clear();
            
            logger.info('[OrchestratorService] Graceful shutdown completed');
            this.emit('shutdown');
            
        } catch (error) {
            logger.error('[OrchestratorService] Error during shutdown:', error.message);
            throw error;
        }
    }
}

// Create singleton instance
const orchestratorService = new OrchestratorService();

// Graceful shutdown handling
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down OrchestratorService gracefully...');
    await orchestratorService.shutdown();
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down OrchestratorService gracefully...');
    await orchestratorService.shutdown();
});

module.exports = orchestratorService;

