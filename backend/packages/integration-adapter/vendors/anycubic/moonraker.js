// Anycubic Moonraker Adapter - HTTP API communication with LeviQ bed leveling
// Ported from ottomat3d-beta-test/src/printers/anycubic_printer.py

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const IPrinterAdapter = require('../../IPrinterAdapter');
const { AdapterError } = require('../../types');

/**
 * Anycubic Printer Adapter (Kobra S1)
 * Uses Moonraker HTTP API for communication
 * NOTE: Requires Rinkhals Custom Firmware
 */
class AnycubicMoonrakerAdapter extends IPrinterAdapter {
    constructor() {
        super();
        this.config = null;
        this._isAuthenticated = false;

        // Moonraker settings
        this.moonrakerPort = 7125;
        this.moonrakerBaseUrl = null;

        // Z position for ejection (fallback - should be in end G-code)
        this.zPositionForEjection = 205;

        // Status codes mapping for Moonraker
        this.statusStates = {
            'standby': 'IDLE',
            'ready': 'IDLE',
            'printing': 'PRINTING',
            'paused': 'PAUSED',
            'complete': 'COMPLETED',
            'cancelled': 'CANCELLED',
            'error': 'ERROR',
            'stopped': 'STOPPED'
        };
    }

    // ========== Lifecycle ==========

    async authenticate(config) {
        this.config = config;
        this.moonrakerBaseUrl = `http://${config.ip}:${this.moonrakerPort}`;

        console.log(`[AnycubicAdapter] Authenticating with ${config.ip}...`);
        console.log(`[AnycubicAdapter] Note: Rinkhals Custom Firmware required`);

        // Test Moonraker connection
        if (!await this._testConnection()) {
            throw AdapterError.AUTH('Moonraker connection test failed');
        }

        this._isAuthenticated = true;
        console.log('[AnycubicAdapter] Authentication successful');
    }

    isAuthenticated() {
        return this._isAuthenticated;
    }

    async close() {
        this._isAuthenticated = false;
        this.config = null;
    }

    // ========== Connection Testing ==========

    async _testConnection() {
        try {
            const url = `${this.moonrakerBaseUrl}/printer/info`;
            const response = await axios.get(url, { timeout: 10000 });

            if (response.data && response.data.result) {
                const result = response.data.result;
                const state = result.state || 'Unknown';
                const hostname = result.hostname || 'Unknown';

                console.log(`[AnycubicAdapter] Successfully connected to Anycubic printer`);
                console.log(`[AnycubicAdapter] Hostname: ${hostname}, State: ${state}`);
                return true;
            } else {
                console.error('[AnycubicAdapter] Invalid response from printer');
                return false;
            }
        } catch (error) {
            console.error(`[AnycubicAdapter] Failed to connect: ${error.message}`);
            console.error('[AnycubicAdapter] Ensure Rinkhals firmware is installed and Moonraker is running on port 7125');
            return false;
        }
    }

    // ========== Printer Information ==========

    async getPrinterInfo() {
        this._requireAuth();

        try {
            const url = `${this.moonrakerBaseUrl}/printer/info`;
            const response = await axios.get(url, { timeout: 10000 });

            if (response.data && response.data.result) {
                const result = response.data.result;
                return {
                    brand: 'Anycubic',
                    model: result.hostname || 'Kobra S1',
                    ip_address: this.config.ip,
                    connection_type: 'Moonraker API',
                    firmware: result.software_version || 'Unknown',
                    state: result.state || 'Unknown'
                };
            }

            return {
                brand: 'Anycubic',
                model: 'Kobra S1',
                ip_address: this.config.ip,
                connection_type: 'Moonraker API'
            };
        } catch (error) {
            throw this._wrapError(error, 'getPrinterInfo');
        }
    }

    async getCapabilities() {
        if (this._capabilities) {
            return this._capabilities;
        }

        this._capabilities = {
            upload_file: true,   // Moonraker upload via HTTP
            start_print: true,   // With LeviQ sequence
            pause_print: true,
            resume_print: true,
            cancel_print: true,
            send_gcode: true,
            get_status: true,
            position_bed: true,  // Fallback positioning via G-code
            job_history: false,
            file_listing: true,   // Can list files via Moonraker
            wait_for_completion: true  // Anycubic-specific completion logic with stale status handling
        };

        return this._capabilities;
    }

    // ========== Status & Monitoring ==========

    async getStatus() {
        this._requireAuth();

        try {
            // Get multiple status objects from Moonraker
            const url = `${this.moonrakerBaseUrl}/printer/objects/query?print_stats&virtual_sdcard&extruder&heater_bed&display_status`;
            const response = await axios.get(url, { timeout: 10000 });

            if (response.data && response.data.result && response.data.result.status) {
                const status = response.data.result.status;

                const printStats = status.print_stats || {};
                const virtualSdcard = status.virtual_sdcard || {};
                const extruder = status.extruder || {};
                const heaterBed = status.heater_bed || {};

                // Extract information
                const state = (printStats.state || 'unknown').toUpperCase();
                const filename = printStats.filename || 'No file';
                const progress = (virtualSdcard.progress || 0) * 100;
                const printDuration = printStats.print_duration || 0;
                const nozzleTemp = extruder.temperature || 0;
                const bedTemp = heaterBed.temperature || 0;
                const nozzleTarget = extruder.target || 0;
                const bedTarget = heaterBed.target || 0;

                return {
                    status: state,
                    progress_percent: progress,
                    current_file: filename.split('/').pop() || 'No file',
                    print_duration: printDuration,
                    nozzle_temperature: nozzleTemp,
                    bed_temperature: bedTemp,
                    nozzle_target: nozzleTarget,
                    bed_target: bedTarget,
                    raw_data: status
                };
            } else {
                throw new Error('Invalid status response from printer');
            }
        } catch (error) {
            throw this._wrapError(error, 'getStatus');
        }
    }

    async* getStatusStream() {
        this._requireAuth();

        let streamActive = true;

        try {
            while (streamActive) {
                const status = await this.getStatus();
                yield status;

                // Poll every 5 seconds
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (error) {
            throw this._wrapError(error, 'getStatusStream');
        }
    }

    // ========== File Management ==========

    async upload(spec) {
        this._requireAuth();

        const localPath = spec.localPath;
        const filename = spec.filename || path.basename(localPath);

        console.log(`[AnycubicAdapter] Uploading file: ${filename}`);

        try {
            // Read file
            if (!fs.existsSync(localPath)) {
                throw new Error(`File not found: ${localPath}`);
            }

            const fileStream = fs.createReadStream(localPath);
            const form = new FormData();

            // Moonraker multipart form data fields
            form.append('file', fileStream, {
                filename: filename,
                contentType: 'application/octet-stream'
            });
            form.append('path', ''); // Empty path means root of gcodes directory
            form.append('root', 'gcodes'); // Store in gcodes directory

            // Upload to Moonraker API
            const uploadUrl = `${this.moonrakerBaseUrl}/server/files/upload`;

            const response = await axios.post(uploadUrl, form, {
                headers: form.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 120000 // 2 minute timeout for large files
            });

            if (response.status === 201 || response.status === 200) {
                console.log(`[AnycubicAdapter] File '${filename}' uploaded successfully`);
                return { success: true, message: `File uploaded: ${filename}` };
            } else {
                return { success: false, message: `Upload failed with status ${response.status}` };
            }

        } catch (error) {
            console.error(`[AnycubicAdapter] Upload error: ${error.message}`);
            throw this._wrapError(error, 'File upload');
        }
    }

    /**
     * Get list of available G-code files
     */
    async getAvailableFiles() {
        this._requireAuth();

        try {
            const url = `${this.moonrakerBaseUrl}/server/files/list?root=gcodes`;
            const response = await axios.get(url, { timeout: 10000 });

            const files = [];

            if (response.data && response.data.result) {
                for (const fileInfo of response.data.result) {
                    const filename = fileInfo.filename || '';
                    if (filename.endsWith('.gcode') || filename.endsWith('.g') || filename.endsWith('.gc')) {
                        files.push({
                            name: filename,
                            size: fileInfo.size || 0,
                            modified: fileInfo.modified || 0
                        });
                    }
                }
            }

            return files;
        } catch (error) {
            console.error(`[AnycubicAdapter] Failed to get file list: ${error.message}`);
            return [];
        }
    }

    /**
     * Validate that a file exists on the printer
     */
    async validateFileExists(filename) {
        const files = await this.getAvailableFiles();
        const fileNames = files.map(f => f.name);

        if (fileNames.includes(filename)) {
            console.log(`[AnycubicAdapter] File '${filename}' found on printer`);
            return true;
        } else {
            console.warn(`[AnycubicAdapter] File '${filename}' not found on printer`);
            console.warn(`[AnycubicAdapter] Available files: ${fileNames.join(', ')}`);
            return false;
        }
    }

    // ========== Print Control ==========

    async start(spec) {
        this._requireAuth();

        const filename = spec.filename;
        console.log(`[AnycubicAdapter] Starting LeviQ sequence + print: ${filename}`);

        try {
            // LeviQ sequence commands (optimized from beta script)
            const commands = [
                'LEVIQ2_AUTO_ZOFFSET_ON_OFF',
                'LEVIQ2_PREHEATING',
                'LEVIQ2_WIPING',
                'LEVIQ2_PROBE',
                `SDCARD_PRINT_FILE FILENAME="${filename}"`
            ];

            console.log('[AnycubicAdapter] Executing LeviQ sequence');

            for (let i = 0; i < commands.length; i++) {
                const cmd = commands[i];
                console.log(`[AnycubicAdapter] Sending command ${i + 1}/${commands.length}: ${cmd}`);

                try {
                    await this.sendGcode(cmd);
                    console.log(`[AnycubicAdapter] Command sent: ${cmd}`);
                } catch (error) {
                    // Don't fail on timeouts for LeviQ commands - assume success
                    console.log(`[AnycubicAdapter] Command sent: ${cmd} (timeout expected)`);
                }

                // 1-second interval between commands
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log('[AnycubicAdapter] LeviQ sequence completed');

            return {
                success: true,
                message: `LeviQ sequence + print started: ${filename}`
            };
        } catch (error) {
            throw this._wrapError(error, 'start');
        }
    }

    async pause(jobId = null) {
        this._requireAuth();

        try {
            const url = `${this.moonrakerBaseUrl}/printer/print/pause`;
            await axios.post(url, {}, { timeout: 10000 });

            console.log('[AnycubicAdapter] Print paused');
            return {
                success: true,
                message: 'Print paused'
            };
        } catch (error) {
            throw this._wrapError(error, 'pause');
        }
    }

    async resume(jobId = null) {
        this._requireAuth();

        try {
            const url = `${this.moonrakerBaseUrl}/printer/print/resume`;
            await axios.post(url, {}, { timeout: 10000 });

            console.log('[AnycubicAdapter] Print resumed');
            return {
                success: true,
                message: 'Print resumed'
            };
        } catch (error) {
            throw this._wrapError(error, 'resume');
        }
    }

    async cancel(jobId = null) {
        this._requireAuth();

        try {
            const url = `${this.moonrakerBaseUrl}/printer/print/cancel`;
            await axios.post(url, {}, { timeout: 10000 });

            console.log('[AnycubicAdapter] Print cancelled');
            return {
                success: true,
                message: 'Print cancelled'
            };
        } catch (error) {
            throw this._wrapError(error, 'cancel');
        }
    }

    // ========== Advanced Operations ==========

    async sendGcode(gcode) {
        this._requireAuth();

        try {
            const url = `${this.moonrakerBaseUrl}/printer/gcode/script`;
            const data = { script: gcode };

            // Use longer timeout for commands that take time
            const isLongRunning = gcode.includes('G28') ||
                                   gcode.includes('LEVIQ') ||
                                   gcode.includes('SDCARD_PRINT_FILE');
            const timeout = isLongRunning ? 60000 : 10000;

            const response = await axios.post(url, data, { timeout });

            if (response.data && response.data.result === 'ok') {
                console.log(`[AnycubicAdapter] G-code sent: ${gcode}`);
                return {
                    success: true,
                    message: `G-code sent: ${gcode}`
                };
            } else {
                throw new Error(`G-code failed: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            // For long-running commands, timeout is expected - assume success
            if (error.code === 'ECONNABORTED' &&
                (gcode.includes('G28') || gcode.includes('LEVIQ') || gcode.includes('SDCARD_PRINT_FILE'))) {
                console.log(`[AnycubicAdapter] G-code sent (timeout expected): ${gcode}`);
                return {
                    success: true,
                    message: `G-code sent: ${gcode}`
                };
            }

            throw this._wrapError(error, 'sendGcode');
        }
    }

    /**
     * Position bed for ejection
     * NOTE: Should be handled by machine end G-code (G1 Z205)
     * This is a fallback method
     */
    async positionBedForEjection() {
        this._requireAuth();

        console.log('[AnycubicAdapter] Positioning bed for ejection (fallback method)');
        console.log('[AnycubicAdapter] Note: Bed positioning should be in machine end G-code');

        try {
            // Send Z positioning command
            await this.sendGcode(`G1 Z${this.zPositionForEjection} F3000`);
            console.log(`[AnycubicAdapter] Bed positioned to Z${this.zPositionForEjection}mm`);

            // Wait for movement to complete
            await new Promise(resolve => setTimeout(resolve, 3000));

            return {
                success: true,
                message: `Bed positioned to Z${this.zPositionForEjection}mm (fallback)`
            };
        } catch (error) {
            console.error(`[AnycubicAdapter] Fallback positioning failed: ${error.message}`);
            return {
                success: false,
                message: 'Fallback positioning failed'
            };
        }
    }

    /**
     * Wait for print completion with Anycubic-specific logic
     * Ported from anycubic_printer.py:wait_for_completion() (lines 198-314)
     *
     * Handles:
     * - Stale COMPLETE status from previous prints
     * - 60-second grace period for CANCELLED states
     * - Multiple completion conditions (COMPLETE, IDLE+99%, temperature-based)
     * - ERROR states as warnings only (false positives common)
     * - Adaptive polling intervals
     */
    async waitForCompletion(progressCallback = null) {
        this._requireAuth();

        console.log('[AnycubicAdapter] Starting print completion monitoring...');

        // Initial wait for LeviQ sequence to start
        await new Promise(resolve => setTimeout(resolve, 15000));

        // STEP 1: Handle stale COMPLETE status from previous print
        const initialStatus = await this.getStatus();
        if (initialStatus.status === 'COMPLETE' && initialStatus.progress_percent >= 99) {
            console.log('[AnycubicAdapter] Detected stale COMPLETE status from previous print - waiting for new print to start...');

            // Wait for status to transition away from COMPLETE (max 300s)
            if (!await this._waitForStatusTransition(300000)) {
                throw new Error('Failed to detect status transition from COMPLETE');
            }

            // Wait for progress to reset (max 600s)
            if (!await this._waitForProgressReset(600000)) {
                throw new Error('Failed to detect progress reset for new print');
            }

            console.log('[AnycubicAdapter] New print started successfully - proceeding with normal monitoring');
        }

        // STEP 2: Normal monitoring with grace period
        let consecutiveErrorPolls = 0;
        let lastLoggedStatus = '';
        let startupPolls = 0;
        const maxStartupPolls = 6; // 60 seconds grace period (6 x 10s polls)

        while (true) {
            let status;

            try {
                status = await this.getStatus();
                consecutiveErrorPolls = 0;
            } catch (error) {
                consecutiveErrorPolls++;
                if (consecutiveErrorPolls > 4) {
                    throw new Error('Too many status errors. Aborting wait.');
                }
                console.warn('[AnycubicAdapter] Failed to get status, retrying...');
                await new Promise(resolve => setTimeout(resolve, 10000));
                continue;
            }

            startupPolls++;
            const inGracePeriod = startupPolls <= maxStartupPolls;

            // Progress callback for orchestrator logging
            if (progressCallback) {
                try {
                    progressCallback(status);
                } catch (err) {
                    console.error(`[AnycubicAdapter] Progress callback error: ${err.message}`);
                }
            }

            // Create status line for logging
            const duration = status.print_duration || 0;
            const durationStr = duration > 0 ? `${(duration / 60).toFixed(1)} min` : 'N/A';
            const currentStatusLine = `Status: ${status.status} | Progress: ${status.progress_percent.toFixed(1)}% | ` +
                `File: ${status.current_file} | Duration: ${durationStr} | ` +
                `Nozzle: ${status.nozzle_temperature.toFixed(1)}°C | Bed: ${status.bed_temperature.toFixed(1)}°C`;

            // Log only if status changed
            if (currentStatusLine !== lastLoggedStatus) {
                console.log(`[AnycubicAdapter] ${currentStatusLine}`);
                lastLoggedStatus = currentStatusLine;
            }

            // PRIMARY: Check for completion states (most reliable)
            if (status.status === 'COMPLETE' || status.status === 'FINISHED') {
                console.log('[AnycubicAdapter] Print completed (COMPLETE/FINISHED)');
                return status;
            }

            // SECONDARY: IDLE with high progress
            if (status.status === 'IDLE' && status.progress_percent >= 99) {
                console.log('[AnycubicAdapter] Print completed (IDLE at 99%+ progress)');
                return status;
            }

            // TERTIARY: IDLE with temperatures cooling down (indicates completion)
            if (status.status === 'IDLE' &&
                status.nozzle_temperature < 50 &&
                status.bed_temperature < 40 &&
                status.progress_percent > 80) {
                console.log('[AnycubicAdapter] Print completed (IDLE with cooling temperatures)');
                return status;
            }

            // Handle CANCELLED state with startup grace period
            if (status.status === 'CANCELLED') {
                if (inGracePeriod) {
                    console.warn(`[AnycubicAdapter] Print shows CANCELLED during startup grace period (poll ${startupPolls}/${maxStartupPolls}) - continuing to monitor...`);
                    // Continue monitoring during grace period
                } else {
                    // After grace period, treat CANCELLED as actual failure
                    throw new Error(`Print cancelled - State: ${status.status}`);
                }
            } else if (status.status === 'STOPPED') {
                throw new Error(`Print stopped - State: ${status.status}`);
            }

            // For Anycubic printers, ignore ERROR states as they can be false positives
            if (status.status === 'ERROR') {
                console.warn('[AnycubicAdapter] Printer reports ERROR state (continuing monitoring - false positives common)');
                // Continue monitoring for non-critical errors
            }

            // Adaptive polling intervals based on temperature activity and progress
            let pollInterval;
            if (status.nozzle_temperature > 180 || status.bed_temperature > 50) {
                pollInterval = 10000; // Active printing, normal interval
            } else if (status.progress_percent > 95) {
                pollInterval = 5000; // Near completion, check frequently
            } else if (status.progress_percent > 80) {
                pollInterval = 8000; // Final stages
            } else {
                pollInterval = 10000; // Standard monitoring
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }

    /**
     * Wait for status to transition away from COMPLETE
     * Helper for stale status detection
     */
    async _waitForStatusTransition(maxWaitTime) {
        console.log('[AnycubicAdapter] Waiting for status to transition from COMPLETE (LeviQ sequence in progress)...');
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            try {
                const status = await this.getStatus();

                if (status.status !== 'COMPLETE') {
                    console.log(`[AnycubicAdapter] Status transitioned from COMPLETE to ${status.status}`);
                    return true;
                }
            } catch (error) {
                // Ignore errors during transition wait
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        console.warn('[AnycubicAdapter] Timeout waiting for status transition from COMPLETE');
        return false;
    }

    /**
     * Wait for progress to reset to low values
     * Helper for stale status detection
     */
    async _waitForProgressReset(maxWaitTime) {
        console.log('[AnycubicAdapter] Waiting for progress to reset (new print starting)...');
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            try {
                const status = await this.getStatus();

                // New print has started when progress drops significantly or state changes to PRINTING
                if (status.progress_percent < 10 || ['PRINTING', 'RUNNING'].includes(status.status)) {
                    console.log(`[AnycubicAdapter] New print detected: Progress: ${status.progress_percent.toFixed(1)}%, State: ${status.status}`);
                    return true;
                }
            } catch (error) {
                // Ignore errors during progress reset wait
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        console.warn('[AnycubicAdapter] Timeout waiting for progress reset');
        return false;
    }
}

module.exports = AnycubicMoonrakerAdapter;
