// backend/src/db/index.js
const sqlite3 = require('sqlite3').verbose(); // Use verbose mode for better debugging messages
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger'); // Assuming logger exists at ../utils/logger.js

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); // Adjust path to .env if needed

const dbPath = process.env.SQLITE_DB_PATH;
const persistData = process.env.DB_PERSIST_DATA === 'true';

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

// Handle database persistence setting
if (!persistData && fs.existsSync(absoluteDbPath)) {
    logger.info('DB_PERSIST_DATA is false, removing existing database file for fresh start...');
    fs.unlinkSync(absoluteDbPath);
}

logger.info(`Attempting to connect to SQLite database at: ${absoluteDbPath}`);

// Function to initialize database schema
function initializeSchema(database) {
    return new Promise((resolve, reject) => {
        const schemaPath = path.join(__dirname, '../..', 'db', 'schema.sql');
        
        if (!fs.existsSync(schemaPath)) {
            logger.error(`Schema file not found at: ${schemaPath}`);
            return reject(new Error('Schema file not found'));
        }

        fs.readFile(schemaPath, 'utf8', (err, schemaSQL) => {
            if (err) {
                logger.error(`Error reading schema file: ${err.message}`);
                return reject(err);
            }

            // Execute the schema SQL
            database.exec(schemaSQL, (execErr) => {
                if (execErr) {
                    logger.error(`Error executing schema: ${execErr.message}`);
                    return reject(execErr);
                }
                logger.info('Database schema initialized successfully.');
                resolve();
            });
        });
    });
}

// Database initialization promise
let dbInitialized = false;
let initializationPromise = null;

// Create a new database instance (or open existing)
const db = new sqlite3.Database(absoluteDbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        logger.error(`Error connecting to SQLite database: ${err.message}`);
        logger.error(`Full Path Attempted: ${absoluteDbPath}`);
        process.exit(1);
    } else {
        logger.info('Successfully connected to the SQLite database.');
    }
});

// Function to initialize the database
function initializeDatabase() {
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = new Promise((resolve, reject) => {
        // Enable foreign key constraint enforcement
        db.run('PRAGMA foreign_keys = ON;', async (pragmaErr) => {
            if (pragmaErr) {
                logger.error(`Failed to enable foreign keys: ${pragmaErr.message}`);
                return reject(pragmaErr);
            } else {
                logger.info('Foreign key enforcement enabled for SQLite connection.');
            }

            // Initialize schema (always run to ensure tables exist)
            try {
                await initializeSchema(db);
                dbInitialized = true;
                resolve(db);
            } catch (schemaErr) {
                logger.error(`Failed to initialize database schema: ${schemaErr.message}`);
                reject(schemaErr);
            }
        });
    });

    return initializationPromise;
}

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

// Export the database connection instance and initialization function
module.exports = {
    db,
    initializeDatabase,
    isInitialized: () => dbInitialized
};