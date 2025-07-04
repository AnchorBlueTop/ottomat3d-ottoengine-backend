// backend/src/utils/logger.js

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// Determine log level from environment variable or default to INFO
const currentLogLevelName = process.env.LOG_LEVEL || 'INFO';
const currentLogLevel = LOG_LEVELS[currentLogLevelName.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * Formats the log message with timestamp and level.
 * @param {string} level - The log level (e.g., 'INFO', 'ERROR').
 * @param {string} message - The message to log.
 * @param {any[]} optionalParams - Additional parameters to log.
 * @returns {string} Formatted log string.
 */
function formatMessage(level, message, optionalParams) {
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    
    const day = pad(now.getDate());
    const month = pad(now.getMonth() + 1); // Months are 0-indexed
    const year = now.getFullYear();
    
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    const timestamp = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    const levelStr = `[${level.padEnd(5)}]`.toUpperCase();
    const mainMessage = `${timestamp} ${levelStr} ${message}`;

    // Format optional parameters (handle objects/errors specifically)
    const formattedParams = optionalParams.map(param => {
        if (param instanceof Error) {
            // Include stack trace for errors
            return `\n${param.stack || param.message}`;
        }
        if (typeof param === 'object' && param !== null) {
            try {
                return JSON.stringify(param, null, 2); // Pretty print objects
            } catch (e) {
                return '[Unserializable Object]';
            }
        }
        return String(param); // Convert others to string
    }).join(' ');

    return `${mainMessage} ${formattedParams}`.trim();
}

/**
 * Logs a message if the level is sufficient.
 * @param {number} level - The numerical level of the message.
 * @param {Function} logFn - The console function to use (e.g., console.log, console.error).
 * @param {string} message - The message to log.
 * @param  {...any} optionalParams - Additional parameters.
 */
function log(level, logFn, message, ...optionalParams) {
    if (level >= currentLogLevel) {
        logFn(formatMessage(Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level), message, optionalParams));
    }
}

// --- Exported Logger Functions ---

const logger = {
    debug: (message, ...optionalParams) => log(LOG_LEVELS.DEBUG, console.log, message, ...optionalParams),
    info: (message, ...optionalParams) => log(LOG_LEVELS.INFO, console.log, message, ...optionalParams),
    warn: (message, ...optionalParams) => log(LOG_LEVELS.WARN, console.warn, message, ...optionalParams),
    error: (message, ...optionalParams) => log(LOG_LEVELS.ERROR, console.error, message, ...optionalParams),
};

module.exports = logger;