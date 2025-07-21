// backend/src/routes/ottorackApiRoutes.js

const express = require('express');
const router = express.Router();
const ottorackController = require('../controllers/ottorackController');

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

module.exports = router;