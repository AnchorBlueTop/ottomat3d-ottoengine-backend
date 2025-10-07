// packages/integration-adapter/IPrinterAdapter.js
// Interface that all printer adapters must implement

const { AdapterError } = require('./types');

/**
 * Base interface for all printer adapters
 * All adapters must implement these methods
 */
class IPrinterAdapter {
    constructor(config) {
        if (this.constructor === IPrinterAdapter) {
            throw new Error('IPrinterAdapter is an interface and cannot be instantiated directly');
        }
        this.config = config;
        this._isAuthenticated = false;
        this._capabilities = null;
    }

    // ========== Authentication ==========
    
    /**
     * Authenticate with the printer using provided config
     * @param {AuthConfig} config - Authentication configuration
     * @returns {Promise<boolean>} - Success status
     * @throws {AdapterError} - AUTH, NETWORK errors
     */
    async authenticate(config) {
        throw new Error('authenticate() must be implemented by adapter');
    }

    /**
     * Check if currently authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return this._isAuthenticated;
    }

    // ========== Printer Information ==========
    
    /**
     * Get basic printer information
     * @returns {Promise<PrinterInfo>}
     * @throws {AdapterError}
     */
    async getPrinterInfo() {
        throw new Error('getPrinterInfo() must be implemented by adapter');
    }

    /**
     * Get printer capabilities - what operations are supported
     * @returns {Promise<PrinterCapabilities>}
     */
    async getCapabilities() {
        if (this._capabilities) {
            return this._capabilities;
        }
        throw new Error('getCapabilities() must be implemented by adapter');
    }

    // ========== Status & Monitoring ==========
    
    /**
     * Get current printer status (one-time check)
     * @returns {Promise<PrinterStatus>}
     * @throws {AdapterError}
     */
    async getStatus() {
        throw new Error('getStatus() must be implemented by adapter');
    }

    /**
     * Get live status stream (AsyncIterable for real-time updates)
     * @returns {AsyncIterable<PrinterStatus>}
     * @throws {AdapterError}
     */
    async* getStatusStream() {
        throw new Error('getStatusStream() must be implemented by adapter');
    }

    // ========== File Management ==========
    
    /**
     * Upload a file to the printer
     * @param {JobSpec} spec - Job specification including filename
     * @returns {Promise<{success: boolean, message?: string}>}
     * @throws {AdapterError}
     */
    async upload(spec) {
        throw new Error('upload() must be implemented by adapter');
    }

    // ========== Print Control ==========
    
    /**
     * Start a print job
     * @param {JobSpec} spec - Complete job specification
     * @returns {Promise<{success: boolean, jobId?: string, message?: string}>}
     * @throws {AdapterError}
     */
    async start(spec) {
        throw new Error('start() must be implemented by adapter');
    }

    /**
     * Pause current print job
     * @param {string} jobId - Job identifier (optional for some adapters)
     * @returns {Promise<{success: boolean, message?: string}>}
     * @throws {AdapterError}
     */
    async pause(jobId = null) {
        const capabilities = await this.getCapabilities();
        if (!capabilities.pause_print) {
            throw AdapterError.UNSUPPORTED('Pause operation not supported by this printer adapter');
        }
        throw new Error('pause() must be implemented by adapter');
    }

    /**
     * Resume paused print job  
     * @param {string} jobId - Job identifier (optional for some adapters)
     * @returns {Promise<{success: boolean, message?: string}>}
     * @throws {AdapterError}
     */
    async resume(jobId = null) {
        const capabilities = await this.getCapabilities();
        if (!capabilities.resume_print) {
            throw AdapterError.UNSUPPORTED('Resume operation not supported by this printer adapter');
        }
        throw new Error('resume() must be implemented by adapter');
    }

    /**
     * Cancel/stop current print job
     * @param {string} jobId - Job identifier (optional for some adapters)  
     * @returns {Promise<{success: boolean, message?: string}>}
     * @throws {AdapterError}
     */
    async cancel(jobId = null) {
        const capabilities = await this.getCapabilities();
        if (!capabilities.cancel_print) {
            throw AdapterError.UNSUPPORTED('Cancel operation not supported by this printer adapter');
        }
        throw new Error('cancel() must be implemented by adapter');
    }

    // ========== Advanced Operations ==========
    
    /**
     * Send direct G-code commands
     * @param {string|string[]} gcode - G-code command(s)
     * @returns {Promise<{success: boolean, message?: string}>}
     * @throws {AdapterError}
     */
    async sendGcode(gcode) {
        const capabilities = await this.getCapabilities();
        if (!capabilities.send_gcode) {
            throw AdapterError.UNSUPPORTED('G-code sending not supported by this printer adapter');
        }
        throw new Error('sendGcode() must be implemented by adapter');
    }

    /**
     * Get job event history (if supported)
     * @param {string} jobId - Job identifier
     * @returns {Promise<JobEvent[]>}
     * @throws {AdapterError}
     */
    async getJobEvents(jobId) {
        const capabilities = await this.getCapabilities();
        if (!capabilities.job_history) {
            throw AdapterError.UNSUPPORTED('Job history not supported by this printer adapter');
        }
        throw new Error('getJobEvents() must be implemented by adapter');
    }

    // ========== Lifecycle ==========
    
    /**
     * Close connections and clean up resources
     * @returns {Promise<void>}
     */
    async close() {
        // Default implementation - can be overridden
        this._isAuthenticated = false;
    }

    // ========== Helper Methods ==========
    
    /**
     * Validate that adapter is authenticated before operations
     * @throws {AdapterError}
     */
    _requireAuth() {
        if (!this._isAuthenticated) {
            throw AdapterError.AUTH('Adapter not authenticated. Call authenticate() first.');
        }
    }

    /**
     * Wrap vendor errors in AdapterError
     * @param {Error} error - Original error
     * @param {string} operation - Operation that failed
     * @returns {AdapterError}
     */
    _wrapError(error, operation) {
        if (error instanceof AdapterError) {
            return error;
        }

        // Analyze error to determine type
        const message = error.message || error.toString();
        
        if (message.includes('ECONNREFUSED') || message.includes('timeout')) {
            return AdapterError.NETWORK(`${operation} failed: ${message}`, error);
        }
        
        if (message.includes('auth') || message.includes('unauthorized')) {
            return AdapterError.AUTH(`${operation} failed: ${message}`, error);
        }
        
        return AdapterError.PRINTER_ERROR(`${operation} failed: ${message}`, error);
    }
}

module.exports = IPrinterAdapter;
