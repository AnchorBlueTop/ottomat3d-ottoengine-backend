// src/bambulabs-api/ftp-client.js

const ftp = require("basic-ftp");
const EventEmitter = require('events');

// Default FTP options for BambuLab
const DEFAULT_FTP_PORT = 990;
const FTP_USERNAME = 'bblp';

class PrinterFTPClient extends EventEmitter {
    /**
     * Creates an instance of PrinterFTPClient.
     * @param {object} options Configuration options
     * @param {string} options.hostname Printer IP address or hostname
     * @param {string} options.accessCode Printer access code (used as password)
     * @param {number} [options.port=990] FTPS port
     * @param {boolean} [options.debug=false] Enable debug logging
     */
    constructor({
        hostname,
        accessCode,
        port = DEFAULT_FTP_PORT,
        debug = false
    }) {
        super();
        this.hostname = hostname;
        this.accessCode = accessCode;
        this.port = port;
        this.debug = debug;
        this.client = null; // FTP client instance
        this.busy = false;  // Simple lock to prevent concurrent operations
    }

    log(...args) {
        if (this.debug) {
            console.log('[FTPClient]', ...args);
        }
    }

    error(...args) {
        console.error('[FTPClient ERROR]', ...args);
        this.emit('error', args.join(' '));
    }

    /**
     * Establishes a secure FTPS connection and performs an action.
     * Handles connection, login, action execution, and logout/close.
     * @param {function(client): Promise<any>} action The async function to execute with the connected client.
     * @returns {Promise<any>} The result of the action.
     * @private
     */
    async _connectAndRun(action) {
        if (this.busy) {
            this.error('FTP client is busy with another operation.');
            throw new Error('FTP client busy');
        }
        this.busy = true;
        this.client = new ftp.Client(30000); // 30 second timeout

        if (this.debug) {
            this.client.ftp.verbose = true; // Enable verbose logging from underlying ftp library
        }

        try {
            this.log(`Connecting to FTPS server ${this.hostname}:${this.port}...`);
            await this.client.access({
                host: this.hostname,
                port: this.port,
                user: FTP_USERNAME,
                password: this.accessCode,
                secure: 'implicit', // Use implicit FTPS required by BambuLab
                secureOptions: {
                    rejectUnauthorized: false // Bambu printers use self-signed certs
                }
            });
            this.log('FTPS Connected and logged in.');
            this.emit('connect');

            // Execute the provided action
            const result = await action(this.client); // Execute the function passed in (e.g., the upload logic)
            this.log('FTP action executed. Raw result:', result);
            this.emit('operation_complete', result);
            return result; // Return the result from the action function

        } catch (err) {
            this.error('FTPS Operation Failed:', err.code, err.message); // Log code too if available
            this.emit('error', err);
            throw err; // Re-throw the error
        } finally {
            if (this.client && this.client.closed === false) { // Check client exists before accessing closed property
                this.log('Closing FTPS connection...');
                // Add extra check just in case close() hangs or errors
                try {
                     await this.client.close();
                     this.log('FTPS Connection closed.');
                } catch(closeErr) {
                     this.error("Error during FTP close:", closeErr.message);
                } finally {
                     this.emit('close');
                }
            } else {
                 this.log('FTPS connection already closed or client not initialized.');
            }
            this.client = null;
            this.busy = false; // Release the lock
        }
    }

    /**
     * Uploads a file from a local path to the printer.
     * @param {string} localPath Path to the local file to upload.
     * @param {string} remoteFilename Name for the file on the printer.
     * @returns {Promise<object|null>} The FTPResponse object ({ code, message }) on success, or null on failure.
     */
    async uploadFile(localPath, remoteFilename) {
        this.log(`Uploading "${localPath}" as "${remoteFilename}"...`);
        try {
            // Use _connectAndRun, the action function performs the upload and returns the result
            // Directly return the result from _connectAndRun which should be the FTPResponse object
            const response = await this._connectAndRun(async (client) => {
                client.trackProgress(info => {
                    const percent = info.fileSize > 0 ? ((info.bytesOverall / info.fileSize) * 100).toFixed(1) : 0;
                    // Only log progress if debug is not enabled
                     if (!this.debug) {
                          this.log(`Upload Progress: ${info.bytesOverall} / ${info.fileSize} bytes (${percent}%)`);
                     }
                    this.emit('upload_progress', info);
                });

                // Perform the upload - uploadFrom returns FTPResponse on success
                const result = await client.uploadFrom(localPath, remoteFilename);
                this.log('client.uploadFrom result:', result);

                client.trackProgress(); // Stop tracking

                // Check the result *inside* the action - basic-ftp throws on critical errors,
                // but we can still check the code for confirmation.
                if (result?.code >= 200 && result?.code < 300) {
                    this.log(`Upload appears successful based on code ${result.code}`);
                    return result; // <<< Return the successful result object
                } else {
                    // This path might not be reached often if basic-ftp throws errors first
                    this.error(`Upload command finished, but code indicates potential failure: ${result?.code} ${result?.message}`);
                    throw new Error(`Upload failed or completed with non-success code ${result?.code}: ${result?.message}`);
                }
            });
            // If _connectAndRun completes without throwing, 'response' holds the object returned by the inner function
            return response;

        } catch (err) {
             // Log the error caught from _connectAndRun (which includes errors from the action)
             this.error(`UploadFile method caught error: ${err.message}`);
             return null; // Explicitly return null on any caught error
        }
    }

    /**
     * Deletes a file from the printer.
     * @param {string} remoteFilename Name of the file to delete on the printer.
     * @returns {Promise<boolean>} True if deletion was successful.
     */
    async deleteFile(remoteFilename) {
        this.log(`Deleting remote file "${remoteFilename}"...`);
        try {
            const result = await this._connectAndRun(async (client) => {
                await client.remove(remoteFilename);
                // `remove` throws an error on failure, so if we reach here, it worked.
                this.log(`Deletion successful: ${remoteFilename}`);
                return true;
            });
             return result; // Return true if no error was thrown
        } catch (err) {
             // Error logged in _connectAndRun
             // Check for specific "file not found" errors if needed (e.g., err.code === 550)
            this.error(`Deletion failed for ${remoteFilename}. Error: ${err.message}`);
            return false; // Indicate failure
        }
    }

    /**
     * Lists files in a remote directory (e.g., '/').
     * @param {string} [remotePath='/'] The directory path on the printer.
     * @returns {Promise<Array<object>|null>} Array of file objects (basic-ftp format) or null on failure.
     */
    async listFiles(remotePath = '/') {
        this.log(`Listing files in remote directory "${remotePath}"...`);
        try {
            const fileList = await this._connectAndRun(async (client) => {
                return await client.list(remotePath);
            });
            this.log(`Found ${fileList.length} items in ${remotePath}.`);
            return fileList;
        } catch (err) {
            this.error(`Failed to list files in ${remotePath}. Error: ${err.message}`);
            return null; // Indicate failure
        }
    }

    // --- TODO: Add other FTP methods if needed ---
    // e.g., downloadFile, createDirectory, etc.
}

module.exports = PrinterFTPClient;