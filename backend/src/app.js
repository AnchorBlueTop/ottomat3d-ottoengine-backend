// backend/src/app.js

// Load environment variables from .env file in the 'backend' directory
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const logger = require('./utils/logger');
const { db, initializeDatabase } = require('./db');

// --- Service Initialization ---
const PrinterStateManager = require('./services/printerStateManager');
const adapterStateManager = require('./services/adapterStateManager');
const orchestratorService = require('./services/orchestratorService');

// --- Import Routers ---
const printerApiRoutes = require('./routes/printerApiRoutes');
const ottoejectApiRoutes = require('./routes/ottoejectApiRoutes');
const printJobApiRoutes = require('./routes/printjobApiRoutes');
const ottorackApiRoutes = require('./routes/ottorackApiRoutes');
const orchestrationApiRoutes = require('./routes/orchestrationApiRoutes');
const orchestratorApiRoutes = require('./routes/orchestratorApiRoutes'); 

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Logging Middleware ---
app.use((req, res, next) => {
    logger.info(`HTTP Request: ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
    next();
});

// --- Ensure 'uploads' directories exist ---
const uploadsDir = path.join(__dirname, '..', 'uploads');
const tempDirectPrinterUploadsDir = path.join(uploadsDir, 'temp_direct_printer_uploads');
const tempGcodeUploadsDir = path.join(uploadsDir, 'temp_gcode_uploads'); 

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Function to create directory if it doesn't exist
const ensureDirExists = (dirPath, dirName) => {
    if (!fs.existsSync(dirPath)) {
        try {
            fs.mkdirSync(dirPath, { recursive: true });
            logger.info(`Created temporary directory for ${dirName}: ${dirPath}`);
        } catch (err) {
            logger.error(`Failed to create temp upload directory ${dirPath}:`, err);
        }
    }
};

ensureDirExists(tempDirectPrinterUploadsDir, 'direct printer uploads');
ensureDirExists(tempGcodeUploadsDir, 'G-code job uploads'); 

// --- API Routes ---
logger.info('Mounting API routes...');
app.use('/api/printers', printerApiRoutes);
app.use('/api/ottoeject', ottoejectApiRoutes);
app.use('/api/print-jobs', printJobApiRoutes);
app.use('/api/ottoracks', ottorackApiRoutes);
app.use('/api/orchestrator', orchestratorApiRoutes);
app.use('/api/orchestration', orchestrationApiRoutes); 

// --- Basic Root Route for the API ---
app.get('/api', (req, res) => {
    res.json({ message: 'Ottomat3D Backend API is active at /api.' });
});

// --- Basic Root Route for the server (optional) ---
app.get('/', (req, res) => {
    res.send('Ottomat3D Backend Server is running.');
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
        // Initialize database first
        logger.info('Initializing database...');
        await initializeDatabase();
        logger.info('Backend: Database connection and schema initialized.');
        logger.info(`Database persistence mode: ${process.env.DB_PERSIST_DATA === 'true' ? 'ENABLED' : 'DISABLED'}`);

        // Initialize adapter state manager for modern printer integration
        logger.info('Initializing adapter state manager...');
        await adapterStateManager.initializeFromDatabase();
        logger.info('Adapter state manager initialized successfully.');

        // Initialize orchestrator service for conflict resolution
        logger.info('Initializing orchestrator service...');
        await orchestratorService.initialize();
        logger.info('Orchestrator service initialized successfully.');

        const printersFromDb = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM printers WHERE lower(brand) = 'bambu lab'", [], (err, rows) => {
                if (err) {
                    logger.error("[App Startup] Failed to fetch printers from DB for StateManager init:", err);
                    return reject(err);
                }
                resolve(rows || []);
            });
        });
        
        // The server starts listening immediately.
        app.listen(PORT, () => {
            logger.info(`Ottomat3D Backend API listening on port ${PORT}`);
            logger.info(`Access API at http://localhost:${PORT}/api`);
        });

        // After the server is confirmed to be running, start connecting to devices in the background.
        // We don't `await` this, so it doesn't block the server from starting.
        if (printersFromDb.length > 0) {
            logger.info(`[App Startup] Initializing PrinterStateManager with ${printersFromDb.length} Bambu printers in the background...`);
            PrinterStateManager.initialize(printersFromDb)
                .then(() => {
                    logger.info('[App Startup] PrinterStateManager background initialization complete.');
                })
                .catch(err => {
                    logger.error(`[App Startup] An error occurred during background PrinterStateManager initialization: ${err.message}`);
                });
        } else {
            logger.warn("[App Startup] No Bambu printers found in DB to initialize with PrinterStateManager.");
        }
    } catch (error) {
        logger.error('Failed to initialize and start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
async function gracefulShutdownHandler(signal) {
    logger.info(`[App] Received ${signal}. Starting graceful shutdown...`);

    // Shutdown orchestrator service first
    if (orchestratorService && typeof orchestratorService.shutdown === 'function') {
        await orchestratorService.shutdown();
    }

    // Shutdown adapter state manager
    if (adapterStateManager && typeof adapterStateManager.shutdown === 'function') {
        await adapterStateManager.shutdown();
    }

    // Shutdown legacy PrinterStateManager (fallback)
    if (PrinterStateManager && typeof PrinterStateManager.gracefulShutdown === 'function') {
        await PrinterStateManager.gracefulShutdown();
    }

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

module.exports = app;

// FIXED: Removed duplicate Phase 3 initialization - orchestratorService already provides all functionality