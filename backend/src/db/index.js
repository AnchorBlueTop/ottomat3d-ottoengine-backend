// backend/src/db/index.js
const sqlite3 = require('sqlite3').verbose(); // Use verbose mode for better debugging messages
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger'); // Assuming logger exists at ../utils/logger.js

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); // Adjust path to .env if needed

const dbPath = process.env.SQLITE_DB_PATH;

if (!dbPath) {
    logger.error('SQLITE_DB_PATH environment variable is not set.');
    throw new Error('Database path not configured in .env file.');
}

// Resolve the absolute path to the database file relative to the project root
const absoluteDbPath = path.resolve(__dirname, '../../', dbPath); // Assumes db/index.js is two levels down from project root
const dbDir = path.dirname(absoluteDbPath);

// Ensure the directory for the database file exists
if (!fs.existsSync(dbDir)) {
    logger.info(`Database directory ${dbDir} does not exist, creating it.`);
    fs.mkdirSync(dbDir, { recursive: true });
}

logger.info(`Attempting to connect to SQLite database at: ${absoluteDbPath}`);

// Create a new database instance (or open existing)
// sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE => Open R/W, create if doesn't exist
const db = new sqlite3.Database(absoluteDbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        logger.error(`Error connecting to SQLite database: ${err.message}`);
        logger.error(`Full Path Attempted: ${absoluteDbPath}`);
        // Exit the process if DB connection fails on startup - crucial dependency
        process.exit(1);
    } else {
        logger.info('Successfully connected to the SQLite database.');
        // Enable foreign key constraint enforcement
        db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
            if (pragmaErr) {
                logger.error(`Failed to enable foreign keys: ${pragmaErr.message}`);
            } else {
                logger.info('Foreign key enforcement enabled for SQLite connection.');
            }
        });
    }
});

// Optional: Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            logger.error('Error closing SQLite database:', err.message);
        } else {
            logger.info('SQLite database connection closed.');
        }
        process.exit(0);
    });
});

// Export the database connection instance
module.exports = db;