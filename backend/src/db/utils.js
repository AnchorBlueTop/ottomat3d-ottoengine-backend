// backend/src/db/utils.js

const { db } = require('./index'); // Import the initialized DB connection from index.js
const logger = require('../utils/logger'); // Import logger

/**
 * Wraps db.run in a Promise. Resolves with { changes, lastID }.
 * @param {string} sql - The SQL query.
 * @param {Array} [params=[]] - Parameters for the SQL query.
 * @returns {Promise<{changes: number, lastID: number}>}
 */
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) { // Use function() to access 'this'
            if (err) {
                logger.error(`DB Run Error: ${err.message} | SQL: ${sql} | Params: ${params}`);
                reject(err);
            } else {
                resolve({ changes: this.changes, lastID: this.lastID });
            }
        });
    });
}

/**
 * Wraps db.get in a Promise. Resolves with the row object or undefined.
 * @param {string} sql - The SQL query.
 * @param {Array} [params=[]] - Parameters for the SQL query.
 * @returns {Promise<object|undefined>}
 */
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                logger.error(`DB Get Error: ${err.message} | SQL: ${sql} | Params: ${params}`);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
 }

/**
  * Wraps db.all in a Promise. Resolves with an array of row objects.
  * @param {string} sql - The SQL query.
  * @param {Array} [params=[]] - Parameters for the SQL query.
  * @returns {Promise<Array<object>>}
  */
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                logger.error(`DB All Error: ${err.message} | SQL: ${sql} | Params: ${params}`);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * FIXED: Add database transaction support
 * Execute multiple database operations within a transaction
 * @param {Function} callback - Async function that performs the database operations
 * @returns {Promise<any>} - Result from the callback function
 */
function dbTransaction(callback) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION", (beginErr) => {
                if (beginErr) {
                    logger.error(`DB Transaction Begin Error: ${beginErr.message}`);
                    return reject(beginErr);
                }
                
                Promise.resolve(callback())
                    .then(result => {
                        db.run("COMMIT", (commitErr) => {
                            if (commitErr) {
                                logger.error(`DB Transaction Commit Error: ${commitErr.message}`);
                                // Try to rollback on commit error
                                db.run("ROLLBACK", (rollbackErr) => {
                                    if (rollbackErr) {
                                        logger.error(`DB Transaction Rollback Error: ${rollbackErr.message}`);
                                    }
                                    reject(commitErr);
                                });
                            } else {
                                logger.debug('DB Transaction committed successfully');
                                resolve(result);
                            }
                        });
                    })
                    .catch(err => {
                        logger.error(`DB Transaction Error: ${err.message}`);
                        db.run("ROLLBACK", (rollbackErr) => {
                            if (rollbackErr) {
                                logger.error(`DB Transaction Rollback Error: ${rollbackErr.message}`);
                            } else {
                                logger.debug('DB Transaction rolled back successfully');
                            }
                            reject(err);
                        });
                    });
            });
        });
    });
}

// Export the helper functions
module.exports = {
    dbRun,
    dbGet,
    dbAll,
    dbTransaction
};