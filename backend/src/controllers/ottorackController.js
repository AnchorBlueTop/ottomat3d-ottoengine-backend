// backend/src/controllers/ottorackController.js

const ottorackService = require('../services/ottorackService');
const rackEventEmitter = require('../services/rackEventEmitter');
const logger = require('../utils/logger');

const ottorackController = {

    /**
     * Create a new Ottorack
     * POST /api/ottoracks
     */
    async createOttorack(req, res, next) {
        try {
            const { name, number_of_shelves, shelf_spacing_mm, bed_size } = req.body;
            
            // Basic validation
            if (!name || !number_of_shelves) {
                return res.status(400).json({ 
                    error: 'Bad Request', 
                    message: 'name and number_of_shelves are required.' 
                });
            }
            
            if (number_of_shelves <= 0 || number_of_shelves > 50) {
                return res.status(400).json({ 
                    error: 'Bad Request', 
                    message: 'number_of_shelves must be between 1 and 50.' 
                });
            }
            
            const newRack = await ottorackService.createOttorack({
                name, 
                number_of_shelves, 
                shelf_spacing_mm, 
                bed_size
            });
            
            res.status(201).json(newRack);
        } catch (error) {
            logger.error(`[OttorackController] Create Error: ${error.message}`, error);
            if (error.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ 
                    error: 'Conflict', 
                    message: 'An Ottorack with this name already exists.' 
                });
            }
            next(error);
        }
    },

    /**
     * Get all Ottoracks
     * GET /api/ottoracks
     */
    async getAllOttoracks(req, res, next) {
        try {
            const racks = await ottorackService.getAllOttoracks();
            res.status(200).json(racks);
        } catch (error) {
            logger.error(`[OttorackController] Get All Error: ${error.message}`, error);
            next(error);
        }
    },

    /**
     * Get specific Ottorack by ID
     * GET /api/ottoracks/:id
     */
    async getOttorackById(req, res, next) {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                return res.status(400).json({ 
                    error: 'Bad Request', 
                    message: 'Rack ID must be a valid number.' 
                });
            }
            
            const rack = await ottorackService.getOttorackById(id);
            if (rack) {
                res.status(200).json(rack);
            } else {
                res.status(404).json({ 
                    error: 'Not Found', 
                    message: `Ottorack with ID ${id} not found.` 
                });
            }
        } catch (error) {
            logger.error(`[OttorackController] Get By ID Error: ${error.message}`, error);
            next(error);
        }
    },

    /**
     * Update shelf details with event emission
     * PUT /api/ottoracks/:id/shelves/:shelf_id
     */
    async updateShelf(req, res, next) {
        try {
            const rackId = parseInt(req.params.id, 10);
            const shelfNumber = parseInt(req.params.shelf_id, 10);
            
            if (isNaN(rackId) || isNaN(shelfNumber)) {
                return res.status(400).json({ 
                    error: 'Bad Request', 
                    message: 'Rack ID and shelf number must be valid numbers.' 
                });
            }
            
            const { has_plate, plate_state, print_job_id } = req.body;

            // Validate has_plate
            if (typeof has_plate !== 'boolean') {
            return res.status(400).json({
            error: 'Bad Request',
                message: 'has_plate must be a boolean value.'
                });
    }

    // Validate plate_state
    if (has_plate) {
        if (!plate_state || !['empty', 'with_print'].includes(plate_state)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'plate_state must be either "empty" or "with_print" when has_plate is true.'
            });
        }
    } else {
        if (plate_state !== null) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'plate_state must be null when has_plate is false.'
            });
        }
    }

    // Calculate occupied for backwards compatibility
    const occupied = has_plate && plate_state === 'with_print';
            
            // DEBUG: Log what we're passing to service
            logger.info(`[OttorackController] Passing to service:`);
            logger.info(`  has_plate: ${has_plate}`);
            logger.info(`  plate_state: ${plate_state}`);
            logger.info(`  occupied: ${occupied}`);
            logger.info(`  print_job_id: ${print_job_id}`);
            
            // Get current state BEFORE update for event emission
            let currentShelf = null;
            let previousState = 'unknown';
            
            try {
                currentShelf = await ottorackService.getShelfById(rackId, shelfNumber);
                previousState = currentShelf.occupied ? 'occupied' : 'empty';
            } catch (shelfError) {
                logger.warn(`[OttorackController] Could not get current shelf state for event: ${shelfError.message}`);
            }
            
            // Call service with ALL fields
            const result = await ottorackService.updateShelf(
                parseInt(req.params.id || req.params.ottorack_id),
                parseInt(req.params.shelf_id),
                {
                has_plate,
                plate_state,
                occupied,
                print_job_id
            });
            
            // Use the result from the first update
            const updatedShelf = result;
            
            // Emit event for orchestrator
            const newState = occupied ? 'occupied' : 'empty';
            let orchestratorNotified = false;
            
            try {
                rackEventEmitter.emitShelfUpdated({
                    rackId,
                    shelfId: shelfNumber,
                    previousState,
                    newState,
                    printJobId: print_job_id,
                    triggeredBy: 'manual_api',
                    userId: req.user?.id || 'unknown'
                });
                
                orchestratorNotified = true;
                logger.info(`[OttorackController] Shelf update event emitted: Rack ${rackId}, Shelf ${shelfNumber} -> ${newState}`);
            } catch (eventError) {
                logger.error(`[OttorackController] Failed to emit shelf update event: ${eventError.message}`);
            }
            
            // Enhanced response with orchestrator status
            res.status(200).json({
                ...updatedShelf,
                message: "Shelf updated successfully. Active orchestrator notified.",
                orchestrator_status: {
                    notified: orchestratorNotified,
                    conflicts_detected: 0,
                    conflicts_resolved: 0,
                    jobs_affected: []
                },
                ottorack_id: rackId,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            logger.error(`[OttorackController] Update Shelf Error: ${error.message}`, error);
            if (error.message.includes('not found')) {
                return res.status(404).json({ 
                    error: 'Not Found', 
                    message: error.message,
                    orchestrator_notified: false
                });
            }
            res.status(500).json({ 
                error: error.message,
                orchestrator_notified: false
            });
        }
    },

    /**
     * Reset shelf to default state with event emission
     * POST /api/ottoracks/:id/shelves/:shelf_id/reset
     */
    async resetShelf(req, res, next) {
        try {
            const rackId = parseInt(req.params.id, 10);
            const shelfNumber = parseInt(req.params.shelf_id, 10);
            
            if (isNaN(rackId) || isNaN(shelfNumber)) {
                return res.status(400).json({ 
                    error: 'Bad Request', 
                    message: 'Rack ID and shelf number must be valid numbers.' 
                });
            }
            
            // Get current state before reset for event emission
            let currentShelf = null;
            let previousState = 'unknown';
            
            try {
                currentShelf = await ottorackService.getShelfById(rackId, shelfNumber);
                previousState = currentShelf.occupied ? 'occupied' : 'empty';
            } catch (shelfError) {
                logger.warn(`[OttorackController] Could not get current shelf state for reset event: ${shelfError.message}`);
            }
            
            // Perform the reset
            const resetShelf = await ottorackService.resetShelf(rackId, shelfNumber);
            
            // Emit event for orchestrator
            let orchestratorNotified = false;
            
            try {
                rackEventEmitter.emitShelfReset({
                    rackId,
                    shelfId: shelfNumber,
                    previousState,
                    triggeredBy: 'manual_api',
                    userId: req.user?.id || 'unknown'
                });
                
                orchestratorNotified = true;
                logger.info(`[OttorackController] Shelf reset event emitted: Rack ${rackId}, Shelf ${shelfNumber} -> empty`);
            } catch (eventError) {
                logger.error(`[OttorackController] Failed to emit shelf reset event: ${eventError.message}`);
            }
            
            res.status(200).json({
                ...resetShelf,
                message: "Shelf reset successfully. Active orchestrator notified.",
                orchestrator_status: {
                    notified: orchestratorNotified,
                    conflicts_detected: 0,
                    conflicts_resolved: 0,
                    jobs_affected: []
                },
                ottorack_id: rackId,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            logger.error(`[OttorackController] Reset Shelf Error: ${error.message}`, error);
            if (error.message.includes('not found')) {
                return res.status(404).json({ 
                    error: 'Not Found', 
                    message: error.message,
                    orchestrator_notified: false
                });
            }
            res.status(500).json({ 
                error: error.message,
                orchestrator_notified: false
            });
        }
    }
};

module.exports = ottorackController;