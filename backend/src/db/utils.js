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

// Export the helper functions
module.exports = {
    dbRun,
    dbGet,
    dbAll
};