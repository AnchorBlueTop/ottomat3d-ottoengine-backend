// packages/integration-adapter/vendors/bambu/lan.js
// BambuLanAdapter - wraps existing bambulabs-api for LAN communication

const IPrinterAdapter = require('../../IPrinterAdapter');
const { 
    AuthConfig, 
    PrinterInfo, 
    PrinterStatus, 
    JobSpec, 
    JobEvent, 
    AdapterError, 
    PrinterCapabilities 
} = require('../../types');

// Import your existing bambulabs-api (module exports { Printer, ... })
const { Printer: BambuPrinter } = require('../../../../src/bambulabs-api');

/**
 * Adapter for Bambu Lab printers using LAN/MQTT communication
 * Wraps the existing bambulabs-api implementation
 */
class BambuLanAdapter extends IPrinterAdapter {
    constructor(config) {
        super(config);
        this._printer = null;
        this._eventListeners = new Map();
        this._lastStatus = null;
        
        // Set capabilities for Bambu LAN
        this._capabilities = new PrinterCapabilities({
            upload_method: 'ftp',
            start_print: true,
            pause_print: true,
            resume_print: true,
            cancel_print: true,
            send_gcode: true,
            live_status: 'stream',
            job_history: false, // Not implemented in current bambulabs-api
            file_management: false,
            camera_stream: false // Could be added later
        });
    }

    // ========== Authentication ==========
    
    async authenticate(config) {
        try {
            // Validate required config
            if (!config || !config.ip || !config.accessCode || !config.serial) {
                throw AdapterError.AUTH('Missing required config: ip, accessCode, serial');
            }

            // Create printer instance using existing bambulabs-api
            this._printer = new BambuPrinter({
                ip: config.ip,
                accessCode: config.accessCode,
                serial: config.serial,
                debug: config.debug || false
            });

            // Test connection
            await this._printer.connect();
            
            // Wait a moment for initial status
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (!this._printer.is_connected()) {
                throw AdapterError.NETWORK('Failed to establish MQTT connection');
            }

            this._isAuthenticated = true;
            this._setupEventListeners();
            
            return true;
            
        } catch (error) {
            this._isAuthenticated = false;
            throw this._wrapError(error, 'authenticate');
        }
    }

    // ========== Printer Information ==========
    
    async getPrinterInfo() {
        this._requireAuth();
        
        try {
            // Get basic info from config and current status
            const status = await this.getStatus();
            
            return new PrinterInfo({
                id: this.config.printerId || null,
                name: this.config.name || `Bambu Printer (${this.config.serial})`,
                brand: 'Bambu Lab',
                model: this.config.model || 'Unknown',
                type: 'FDM',
                ip_address: this.config.ip,
                serial_number: this.config.serial,
                firmware_version: status.vendor_data?.info?.version || null,
                capabilities: this._capabilities
            });
            
        } catch (error) {
            throw this._wrapError(error, 'getPrinterInfo');
        }
    }

    async getCapabilities() {
        return this._capabilities;
    }

    // ========== Status & Monitoring ==========
    
    async getStatus() {
        this._requireAuth();
        
        try {
            // Use enhanced getApiStatus if available, fallback to manual mapping
            let normalizedStatus;
            
            if (typeof this._printer.getApiStatus === 'function') {
                // Use the enhanced status from our earlier improvements
                normalizedStatus = this._printer.getApiStatus();
            } else {
                // Fallback to manual status mapping
                normalizedStatus = this._mapLegacyStatus();
            }
            
            const printerStatus = new PrinterStatus({
                ...normalizedStatus,
                vendor_data: this._printer.mqtt_dump() // Include raw data for debugging
            });
            
            this._lastStatus = printerStatus;
            return printerStatus;
            
        } catch (error) {
            throw this._wrapError(error, 'getStatus');
        }
    }

    async* getStatusStream() {
        this._requireAuth();
        
        try {
            // Yield current status first
            yield await this.getStatus();
            
            // Set up event-driven streaming
            const statusQueue = [];
            let isWaiting = false;
            
            const handleUpdate = (rawData, structuredStatus) => {
                try {
                    let status;
                    if (structuredStatus && typeof structuredStatus.getNormalizedStatus === 'function') {
                        status = new PrinterStatus({
                            ...structuredStatus.getNormalizedStatus(),
                            vendor_data: rawData
                        });
                    } else {
                        status = new PrinterStatus({
                            ...this._mapLegacyStatus(),
                            vendor_data: rawData
                        });
                    }
                    
                    this._lastStatus = status;
                    statusQueue.push(status);
                } catch (err) {
                    console.error('Error processing status update:', err);
                }
            };

            this._printer.on('update', handleUpdate);
            
            try {
                // Stream status updates
                while (this._isAuthenticated && this._printer.is_connected()) {
                    if (statusQueue.length > 0) {
                        yield statusQueue.shift();
                    } else {
                        // Wait for next update
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            } finally {
                this._printer.removeListener('update', handleUpdate);
            }
            
        } catch (error) {
            throw this._wrapError(error, 'getStatusStream');
        }
    }

    // ========== File Management ==========
    
    async upload(spec) {
        this._requireAuth();
        
        try {
            if (!spec.filename) {
                throw AdapterError.PRINTER_ERROR('Filename is required for upload');
            }

            // Use existing upload_file method
            const result = await this._printer.upload_file(spec.localPath, spec.filename);
            
            if (result && result.code >= 200 && result.code < 300) {
                return {
                    success: true,
                    message: `File '${spec.filename}' uploaded successfully`
                };
            } else {
                return {
                    success: false,
                    message: result?.message || 'Upload failed'
                };
            }
            
        } catch (error) {
            throw this._wrapError(error, 'upload');
        }
    }

    // ========== Print Control ==========
    
    async start(spec) {
        this._requireAuth();
        
        try {
            if (!spec.filename) {
                throw AdapterError.PRINTER_ERROR('Filename is required to start print');
            }

            const success = await this._printer.start_print(
                spec.filename,
                spec.plate_id,
                spec.use_ams,
                spec.ams_mapping,
                spec.skip_objects
            );
            
            if (success) {
                return {
                    success: true,
                    jobId: spec.filename, // Bambu uses filename as job identifier
                    message: `Print started: ${spec.filename}`
                };
            } else {
                return {
                    success: false,
                    message: 'Failed to start print'
                };
            }
            
        } catch (error) {
            throw this._wrapError(error, 'start');
        }
    }

    async pause(jobId = null) {
        this._requireAuth();
        
        try {
            const success = await this._printer.pause_print();
            
            return {
                success: success,
                message: success ? 'Print paused' : 'Failed to pause print'
            };
            
        } catch (error) {
            throw this._wrapError(error, 'pause');
        }
    }

    async resume(jobId = null) {
        this._requireAuth();
        
        try {
            const success = await this._printer.resume_print();
            
            return {
                success: success,
                message: success ? 'Print resumed' : 'Failed to resume print'
            };
            
        } catch (error) {
            throw this._wrapError(error, 'resume');
        }
    }

    async cancel(jobId = null) {
        this._requireAuth();
        
        try {
            const success = await this._printer.stop_print();
            
            return {
                success: success,
                message: success ? 'Print cancelled' : 'Failed to cancel print'
            };
            
        } catch (error) {
            throw this._wrapError(error, 'cancel');
        }
    }

    // ========== Advanced Operations ==========
    
    async sendGcode(gcode) {
        this._requireAuth();
        
        try {
            const success = await this._printer.gcode(gcode, true); // Enable validation
            
            return {
                success: success,
                message: success ? 'G-code sent successfully' : 'Failed to send G-code'
            };
            
        } catch (error) {
            throw this._wrapError(error, 'sendGcode');
        }
    }

    async getJobEvents(jobId) {
        // Not implemented in current bambulabs-api
        throw AdapterError.UNSUPPORTED('Job history not supported by BambuLanAdapter');
    }

    // ========== Lifecycle ==========
    
    async close() {
        if (this._printer) {
            this._printer.disconnect();
            this._printer = null;
        }
        this._isAuthenticated = false;
        this._eventListeners.clear();
    }

    // ========== Helper Methods ==========
    
    /**
     * Map legacy status format to normalized format
     */
    _mapLegacyStatus() {
        if (!this._printer) return { status: 'OFFLINE' };
        
        const state = this._printer.get_state();
        const stage = this._printer.get_current_stage();
        
        // Map gcode_state to normalized status
        const statusMap = {
            'IDLE': 'IDLE',
            'PREPARE': 'PREPARING',
            'RUNNING': 'RUNNING', 
            'PAUSE': 'PAUSED',
            'FINISH': 'COMPLETED',
            'FAILED': 'ERROR',
            'UNKNOWN': 'UNKNOWN'
        };
        
        return {
            status: statusMap[state] || 'UNKNOWN',
            current_stage: stage,
            progress_percent: this._printer.get_percentage(),
            remaining_time_minutes: this._printer.get_time(),
            temperatures: {
                nozzle: this._printer.getNozzleTemperature(),
                nozzle_target: this._printer.getNozzleTargetTemperature(),
                bed: this._printer.getBedTemperature(),
                bed_target: this._printer.getBedTargetTemperature()
            },
            filament: {
                material: 'N/A',
                color: 'N/A',
                name: null,
                source: null
            },
            print_job: {
                file: this._printer.get_filename(),
                project_id: null,
                task_id: null
            },
            is_online: this._printer.is_connected()
        };
    }

    /**
     * Set up event listeners for the printer
     */
    _setupEventListeners() {
        if (!this._printer) return;
        
        // Map printer events to adapter events
        this._printer.on('mqtt_connect', () => {
            this.emit('connected');
        });
        
        this._printer.on('mqtt_close', () => {
            this.emit('disconnected');
        });
        
        this._printer.on('state_change', (newState, structuredStatus) => {
            this.emit('status_change', {
                status: newState,
                structured: structuredStatus
            });
        });
        
        this._printer.on('print_error', (errorCode, structuredStatus) => {
            this.emit('error', {
                error_code: errorCode,
                structured: structuredStatus
            });
        });
    }
}

module.exports = BambuLanAdapter;
