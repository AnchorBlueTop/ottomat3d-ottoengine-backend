// backend/src/controllers/ottorackController.js

const ottorackService = require('../services/ottorackService');
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
     * Update shelf details
     * PUT /api/ottoracks/:id/shelves/:shelf_id
     */
    async updateShelf(req, res, next) {
        try {
            const rackId = parseInt(req.params.id, 10);
            const shelfNumber = parseInt(req.params.shelf_id, 10); // shelf_id in URL = shelf_number (physical position)
            
            if (isNaN(rackId) || isNaN(shelfNumber)) {
                return res.status(400).json({ 
                    error: 'Bad Request', 
                    message: 'Rack ID and shelf number must be valid numbers.' 
                });
            }
            
            const { occupied, print_job_id } = req.body;
            
            if (typeof occupied !== 'boolean') {
                return res.status(400).json({ 
                    error: 'Bad Request', 
                    message: 'occupied must be a boolean value.' 
                });
            }
            
            const updatedShelf = await ottorackService.updateShelf(rackId, shelfNumber, {
                occupied,
                print_job_id: occupied ? print_job_id : null
            });
            
            res.status(200).json(updatedShelf);
        } catch (error) {
            logger.error(`[OttorackController] Update Shelf Error: ${error.message}`, error);
            if (error.message.includes('not found')) {
                return res.status(404).json({ 
                    error: 'Not Found', 
                    message: error.message 
                });
            }
            next(error);
        }
    },

    /**
     * Reset shelf to default state
     * POST /api/ottoracks/:id/shelves/:shelf_id/reset
     */
    async resetShelf(req, res, next) {
        try {
            const rackId = parseInt(req.params.id, 10);
            const shelfNumber = parseInt(req.params.shelf_id, 10); // shelf_id in URL = shelf_number (physical position)
            
            if (isNaN(rackId) || isNaN(shelfNumber)) {
                return res.status(400).json({ 
                    error: 'Bad Request', 
                    message: 'Rack ID and shelf number must be valid numbers.' 
                });
            }
            
            const resetShelf = await ottorackService.resetShelf(rackId, shelfNumber);
            res.status(200).json(resetShelf);
        } catch (error) {
            logger.error(`[OttorackController] Reset Shelf Error: ${error.message}`, error);
            if (error.message.includes('not found')) {
                return res.status(404).json({ 
                    error: 'Not Found', 
                    message: error.message 
                });
            }
            next(error);
        }
    }
};

module.exports = ottorackController;