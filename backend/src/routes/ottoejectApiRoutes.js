// backend/src/routes/ottoejectApiRoutes.js
// Aligned with new API documentation URLs and controller method names.

const express = require('express');
// Assuming your controller file is now named ottoejectController.js
const ottoejectController = require('../controllers/ottoejectController'); 
const logger = require('../utils/logger'); // Assuming path is correct from this file's location

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

// GET /api/ottoeject - Get all Ottoeject devices
router.get('/', ottoejectController.getAllOttoejects);

// GET /api/ottoeject/{id} - Retrieve a single Ottoeject device’s details
router.get('/:id', ottoejectController.getOttoejectById);

// PUT /api/ottoeject/{id} - Update basic details of an Ottoeject (e.g., name, IP)
router.put('/:id', ottoejectController.updateOttoeject);

// DELETE /api/ottoeject/{id} - Delete an Ottoeject Device
router.delete('/:id', ottoejectController.deleteOttoeject);


// --- Core v0.1 Proxy Endpoints for Ottoeject ---

// GET /api/ottoeject/{id}/status - Retrieve live status for a specific Ottoeject device
router.get('/:id/status', ottoejectController.getOttoejectLiveStatus);

// POST /api/ottoeject/{id}/macros - Execute a specific G-code macro on the Ottoeject
// This is your generic macro execution endpoint, essential for the Python script.
router.post('/:id/macros', ottoejectController.executeMacro);

module.exports = router;