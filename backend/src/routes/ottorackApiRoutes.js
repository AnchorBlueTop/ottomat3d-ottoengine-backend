// backend/src/routes/ottorackApiRoutes.js

const express = require('express');
const router = express.Router();
const ottorackController = require('../controllers/ottorackController');
const orchestratorService = require('../services/orchestratorService');

// POST /api/ottoracks/ - Create an Ottorack
router.post('/', ottorackController.createOttorack);

// GET /api/ottoracks/ - Get all Ottoracks
router.get('/', ottorackController.getAllOttoracks);

// GET /api/ottoracks/{id} - Get Ottorack Details 
router.get('/:id', ottorackController.getOttorackById);

// PUT /api/ottoracks/{id}/shelves/{id} - Update Shelf (Occupied)
router.put('/:id/shelves/:shelf_id', ottorackController.updateShelf);

// POST /api/ottoracks/{id}/shelves/{id}/reset - Reset Shelf (Empty)
router.post('/:id/shelves/:shelf_id/reset', ottorackController.resetShelf);

// GET /api/ottoracks/orchestrator/status - Get orchestrator service status
router.get('/orchestrator/status', async (req, res) => {
    try {
        const health = await orchestratorService.healthCheck();
        const stats = orchestratorService.getStats();
        
        res.status(200).json({
            health,
            stats,
            message: 'Orchestrator service status retrieved successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get orchestrator status',
            message: error.message
        });
    }
});

// GET /api/ottoracks/orchestrator/stats - Get orchestrator performance statistics
router.get('/orchestrator/stats', (req, res) => {
    try {
        const stats = orchestratorService.getStats();
        res.status(200).json({
            stats,
            message: 'Orchestrator statistics retrieved successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get orchestrator stats',
            message: error.message
        });
    }
});

module.exports = router;