// backend/src/app.js

// Load environment variables from .env file in the 'backend' directory
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path'); // path is a built-in module
const fs = require('fs');     // fs is a built-in module (only if still needed for uploads dir by a route)

const logger = require('./utils/logger');    // From src/utils/logger.js
const db = require('./db');                  // From src/db/index.js (initializes DB connection)

// --- Service Initialization ---
// PrinterStateManager now manages persistent connections for Bambu printers
const PrinterStateManager = require('./services/printerStateManager');
// EjectobotStateManager is removed for v0.1 proxy (Ejectobot status via HTTP poll)
// OrchestratorService is removed for v0.1 proxy

// --- Import Routers ---
// Ensure these files exist at these paths and export Express routers
const printerApiRoutes = require('./routes/printerApiRoutes');
const ottoejectApiRoutes = require('./routes/ottoejectApiRoutes');
// const jobApiRoutes = require('./routes/printJobApiRoutes'); // REMOVED if no job logging for v0.1
// const storageRackApiRoutes = require('./routes/storageRackApiRoutes'); // REMOVED

const app = express();
const PORT = process.env.PORT || 3000; // Or your preferred port

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Logging Middleware ---
app.use((req, res, next) => {
    logger.info(`HTTP Request: ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
    next();
});

// --- Ensure 'uploads' directory exists if any route still uses it (e.g., direct printer file upload) ---
// If NO file uploads are handled by the backend at all for v0.1, this can be removed.
// Assuming direct printer file upload proxy might still use it.
const uploadsDir = path.join(__dirname, '..', 'uploads'); // Relative to backend/
const tempDirectPrinterUploadsDir = path.join(uploadsDir, 'temp_direct_printer_uploads');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(tempDirectPrinterUploadsDir)) {
    try {
        fs.mkdirSync(tempDirectPrinterUploadsDir, { recursive: true });
        logger.info(`Created temporary directory for direct printer uploads: ${tempDirectPrinterUploadsDir}`);
    } catch (err) {
        logger.error(`Failed to create temp upload directory ${tempDirectPrinterUploadsDir}:`, err);
    }
}

// --- API Routes ---
// Base path is now /api/
logger.info('Mounting API routes for v0.1 Proxy at /api/ ...');
app.use('/api/printers', printerApiRoutes);
app.use('/api/ottoeject', ottoejectApiRoutes);
// if (jobApiRoutes) app.use('/api/print-jobs', jobApiRoutes); // REMOVED if no job functionality

// --- Basic Root Route for the API ---
app.get('/api', (req, res) => {
    res.json({ message: 'Ottomat3D Backend API Proxy v0.1 is active at /api.' });
});

// --- Basic Root Route for the server (optional) ---
app.get('/', (req, res) => {
    res.send('Ottomat3D Backend Server v0.1 (API Proxy Mode) is running.');
});


// --- Generic Error Handling Middleware ---
app.use((err, req, res, next) => {
    logger.error('Unhandled API Error:', { 
        message: err.message, 
        name: err.name,
        status: err.statusCode, 
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined // Only show stack in dev
    });
    if (res.headersSent) {
        return next(err);
    }
    res.status(err.statusCode || 500).json({
        error: err.name || 'InternalServerError',
        message: err.message || 'An unexpected error occurred on the server.',
    });
});

// --- Initialize Services and Start Server ---
async function initializeAndStartServer() {
    try {
        logger.info('v0.1 Backend: Database connection initialized (on require).');

        // Fetch all Bambu printers from DB to initialize PrinterStateManager
        // This direct DB call is okay for app startup.
        const printersFromDb = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM printers WHERE lower(brand) = 'bambu lab'", [], (err, rows) => { // Changed to check brand instead of type
                if (err) {
                    logger.error("[App Startup] Failed to fetch printers from DB for StateManager init:", err);
                    return reject(err);
                }
                resolve(rows || []);
            });
        });
        
        if (printersFromDb.length > 0) {
            logger.info(`[App Startup] Initializing PrinterStateManager with ${printersFromDb.length} Bambu printers...`);
            await PrinterStateManager.initialize(printersFromDb); // Initialize and connect instances
            logger.info('[App Startup] PrinterStateManager initialization attempt complete.');
        } else {
            logger.warn("[App Startup] No Bambu printers found in DB to initialize with PrinterStateManager.");
        }

        logger.info('v0.1 Backend: Ready to act as API Proxy.');
        app.listen(PORT, () => {
            logger.info(`Ottomat3D Backend API Proxy v0.1 listening on port ${PORT}`);
            logger.info(`Access API at http://localhost:${PORT}/api`);
        });
    } catch (error) {
        logger.error('Failed to initialize and start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown for PrinterStateManager
async function gracefulShutdownHandler(signal) {
    logger.info(`[App] Received ${signal}. Starting graceful shutdown...`);
    if (PrinterStateManager && typeof PrinterStateManager.gracefulShutdown === 'function') {
        await PrinterStateManager.gracefulShutdown();
    }
    // Close DB connection if your db module exports a close function
    if (db && typeof db.close === 'function') {
        db.close((err) => {
            if (err) logger.error('[App] Error closing SQLite database:', err.message);
            else logger.info('[App] SQLite database connection closed.');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
}

process.on('SIGINT', () => gracefulShutdownHandler('SIGINT'));
process.on('SIGTERM', () => gracefulShutdownHandler('SIGTERM'));


initializeAndStartServer();

module.exports = app; // For potential testing