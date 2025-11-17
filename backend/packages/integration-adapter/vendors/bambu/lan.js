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

            const useAMS = spec.use_ams || false;

            // If AMS is enabled, setup AMS mapping table first
            if (useAMS) {
                console.log('[BambuLanAdapter] AMS enabled - setting up filament mapping...');

                try {
                    await this.setupAMSMapping();
                } catch (error) {
                    console.error('[BambuLanAdapter] AMS setup failed:', error.message);
                    return {
                        success: false,
                        message: `AMS setup failed: ${error.message}`
                    };
                }

                console.log('[BambuLanAdapter] Starting print with AMS mapping...');
            }

            // AMS mapping: T0→Slot0, T1→Slot1, T2→Slot2, T3→Slot3
            const amsMapping = useAMS ? [0, 1, 2, 3] : (spec.ams_mapping || null);

            // Start the print
            const success = await this._printer.start_print(
                spec.filename,
                spec.plate_id || "",  // Empty string to avoid SD card errors
                useAMS,
                amsMapping,
                spec.skip_objects
            );

            if (success) {
                // Wait for initialization (longer for AMS)
                const waitTime = useAMS ? 20000 : 10000;
                console.log(`[BambuLanAdapter] Waiting ${waitTime/1000}s for print initialization...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));

                return {
                    success: true,
                    jobId: spec.filename, // Bambu uses filename as job identifier
                    message: `Print started: ${spec.filename}${useAMS ? ' (with AMS)' : ''}`
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

    // ========== Bed Positioning & AMS Support ==========

    /**
     * Position bed for ejection (model-specific: Z-bed vs Sling bed)
     * Ported from bambu_printer.py:515-579
     */
    async positionBedForEjection() {
        this._requireAuth();

        try {
            const model = (this.config.model || '').toLowerCase();
            const isSlingBed = model.includes('a1');

            let gcode, position;
            if (isSlingBed) {
                // A1 is sling bed - use Y positioning
                position = 170;
                gcode = `G90\nG1 Y${position} F600`;
                console.log(`[BambuLanAdapter] Positioning ${model} sling bed to Y${position} for ejection`);
            } else {
                // P1P, P1S, X1C are Z-bed - use Z positioning
                position = 200;
                gcode = `G90\nG1 Z${position} F600`;
                console.log(`[BambuLanAdapter] Positioning ${model} bed to Z${position} for ejection`);
            }

            // Send G-code command
            const result = await this.sendGcode(gcode);

            if (result.success) {
                console.log(`[BambuLanAdapter] Bed positioning command sent successfully`);

                // Wait for movement to complete (20s timeout)
                await this._waitForMoveCompletion(20000);
                console.log(`[BambuLanAdapter] Bed positioning completed`);

                return {
                    success: true,
                    message: `Bed positioned to ${isSlingBed ? 'Y' : 'Z'}${position}mm`
                };
            } else {
                return {
                    success: false,
                    message: 'Failed to send bed positioning command'
                };
            }

        } catch (error) {
            throw this._wrapError(error, 'positionBedForEjection');
        }
    }

    /**
     * Wait for printer movement to complete
     * Ported from bambu_printer.py:581-612
     */
    async _waitForMoveCompletion(timeout = 20000) {
        const startTime = Date.now();
        const pollInterval = 2000; // 2 seconds

        while ((Date.now() - startTime) < timeout) {
            try {
                const status = await this.getStatus();
                const state = status.status.toUpperCase();

                // Movement complete states
                if (['IDLE', 'FINISH', 'COMPLETED', 'READY'].includes(state)) {
                    console.log(`[BambuLanAdapter] Movement complete - printer state: ${state}`);
                    return true;
                }
            } catch (error) {
                // Ignore errors during movement wait
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        console.warn(`[BambuLanAdapter] Movement completion timeout after ${timeout}ms`);
        return false;
    }

    /**
     * Setup AMS filament mapping table
     * Ported from bambu_printer.py:358-416
     */
    async setupAMSMapping() {
        this._requireAuth();

        try {
            console.log('[BambuLanAdapter] Configuring AMS mapping table...');

            // Import Filament enum (handle both bambulabs-api and bambulabs_api naming)
            let Filament;
            try {
                const filamentInfo = require('../../../../src/bambulabs-api/filament-info');
                Filament = filamentInfo.Filament;
            } catch (err) {
                throw new Error('Cannot import Filament enum from bambulabs-api');
            }

            // Placeholder filament settings (matching working beta script)
            const amsSlots = [
                { slot: 0, color: '808080', name: 'PETG Gray' },    // Slot 1 = index 0
                { slot: 1, color: '000000', name: 'PETG Black' },   // Slot 2 = index 1
                { slot: 2, color: 'FF0000', name: 'PETG Red' },     // Slot 3 = index 2
                { slot: 3, color: '0000FF', name: 'PETG Blue' }     // Slot 4 = index 3
            ];

            // Configure each slot
            for (const slotInfo of amsSlots) {
                const { slot, color } = slotInfo;

                // Set filament for this slot
                const success = await this._printer.set_filament_printer(
                    color,
                    Filament.PETG,  // Use PETG filament type
                    0,              // AMS unit 0 (first AMS)
                    slot            // Tray/slot ID
                );

                if (!success) {
                    throw new Error(`Failed to configure AMS slot ${slot + 1}`);
                }

                // Small delay between slot configurations
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Wait for AMS to process the mapping table
            await new Promise(resolve => setTimeout(resolve, 5000));

            console.log('[BambuLanAdapter] AMS mapping table configured successfully');
            return true;

        } catch (error) {
            console.error('[BambuLanAdapter] AMS setup error:', error.message);
            throw this._wrapError(error, 'setupAMSMapping');
        }
    }

    /**
     * List files on printer via FTP
     * Uses existing FTP client functionality
     */
    async listFiles(remotePath = '/') {
        this._requireAuth();

        try {
            // Get FTP client from printer instance
            if (!this._printer || !this._printer._ftp) {
                throw AdapterError.PRINTER_ERROR('FTP client not available');
            }

            // Call the existing listFiles method from ftp-client.js
            const files = await this._printer._ftp.listFiles(remotePath);

            return {
                success: true,
                files: files || [],
                message: `Found ${files?.length || 0} files`
            };

        } catch (error) {
            throw this._wrapError(error, 'listFiles');
        }
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
