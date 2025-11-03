// backend/src/routes/ottoejectApiRoutes.js

const express = require('express');
const ottoejectController = require('../controllers/ottoejectController'); 
const logger = require('../utils/logger'); 

const router = express.Router();

// Middleware for logging requests to these Ottoeject routes
router.use((req, res, next) => {
    if (logger && typeof logger.debug === 'function') { // Ensure logger and method exist
        logger.debug(`Ottoeject API Route Access: ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
    }
    next();
});


// POST /api/ottoeject/ - Register an Ottoeject device
router.post('/', ottoejectController.registerOttoeject);

// POST /api/ottoeject/connect - Test connection to an Ottoeject device (ad-hoc)
router.post('/connect', ottoejectController.connect);

// GET /api/ottoeject - Get all Ottoeject devices
router.get('/', ottoejectController.getAllOttoejects);

// GET /api/ottoeject/{id} - Retrieve a single Ottoeject device’s details
router.get('/:id', ottoejectController.getOttoejectById);

// PUT /api/ottoeject/{id} - Update basic details of an Ottoeject (e.g., name, IP)
router.put('/:id', ottoejectController.updateOttoeject);

// DELETE /api/ottoeject/{id} - Delete an Ottoeject Device
router.delete('/:id', ottoejectController.deleteOttoeject);

// GET /api/ottoeject/{id}/status - Retrieve live status for a specific Ottoeject device
router.get('/:id/status', ottoejectController.getOttoejectLiveStatus);

// POST /api/ottoeject/{id}/macros - Execute a specific G-code macro on the Ottoeject
router.post('/:id/macros', ottoejectController.executeMacro);

module.exports = router;