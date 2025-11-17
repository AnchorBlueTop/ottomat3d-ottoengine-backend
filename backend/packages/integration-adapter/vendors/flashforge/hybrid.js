// FlashForge Hybrid Adapter - HTTP + TCP communication
// Ported from ottomat3d-beta-test/src/printers/flashforge_printer.py

const net = require('net');
const axios = require('axios');
const IPrinterAdapter = require('../../IPrinterAdapter');
const { AdapterError } = require('../../types');

/**
 * FlashForge Printer Adapter
 * Uses hybrid HTTP (port 8898) + TCP (port 8899) communication
 * HTTP: Status, authentication, print control
 * TCP: G-code commands for bed positioning
 */
class FlashForgeHybridAdapter extends IPrinterAdapter {
    constructor() {
        super();
        this.config = null;
        this._isAuthenticated = false;

        // FlashForge ports
        this.httpPort = 8898;
        this.tcpPort = 8899;

        // URLs will be set in authenticate()
        this.baseUrl = null;
        this.detailUrl = null;
        this.printGcodeUrl = null;
        this.controlUrl = null;

        // Bed positioning settings
        this.zPositionForEjection = 190;
        this.zMoveSpeed = 600;

        // TCP commands
        this.tcpLogin = '~M601 S1\n';
        this.tcpLogout = '~M602\n';
    }

    // ========== Lifecycle ==========

    async authenticate(config) {
        this.config = config;

        // Setup URLs
        this.baseUrl = `http://${config.ip}:${this.httpPort}`;
        this.detailUrl = `${this.baseUrl}/detail`;
        this.printGcodeUrl = `${this.baseUrl}/printGcode`;
        this.controlUrl = `${this.baseUrl}/control`;

        console.log(`[FlashForgeAdapter] Authenticating with ${config.ip}...`);
        console.log(`[FlashForgeAdapter] Note: LAN Mode must be ENABLED on the printer`);

        // Test HTTP connection
        if (!await this._testHttpConnection()) {
            throw AdapterError.AUTH('HTTP connection test failed');
        }

        // Test TCP connection
        if (!await this._testTcpConnection()) {
            throw AdapterError.AUTH('TCP connection test failed');
        }

        this._isAuthenticated = true;
        console.log('[FlashForgeAdapter] Authentication successful');
    }

    isAuthenticated() {
        return this._isAuthenticated;
    }

    async close() {
        this._isAuthenticated = false;
        this.config = null;
    }

    async getCapabilities() {
        if (this._capabilities) {
            return this._capabilities;
        }

        this._capabilities = {
            upload_file: false,  // File upload not implemented yet
            start_print: true,
            pause_print: true,
            resume_print: true,
            cancel_print: true,
            send_gcode: true,    // Via TCP
            get_status: true,
            position_bed: true,  // Via TCP G-code
            job_history: false,
            wait_for_completion: true  // FlashForge-specific 99.5% threshold with adaptive polling
        };

        return this._capabilities;
    }

    // ========== Connection Testing ==========

    async _testHttpConnection() {
        try {
            const authPayload = {
                serialNumber: this.config.serial,
                checkCode: this.config.checkCode
            };

            const response = await axios.post(this.detailUrl, authPayload, { timeout: 10000 });

            if (response.data && response.data.code === 0) {
                console.log('[FlashForgeAdapter] HTTP API connection successful');
                return true;
            } else {
                console.error(`[FlashForgeAdapter] HTTP API error: ${response.data?.message} (Code: ${response.data?.code})`);
                return false;
            }
        } catch (error) {
            console.error(`[FlashForgeAdapter] HTTP connection failed: ${error.message}`);
            console.error('[FlashForgeAdapter] Ensure LAN Mode is ENABLED on the FlashForge printer');
            return false;
        }
    }

    async _testTcpConnection() {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(10000);

            socket.on('timeout', () => {
                console.error('[FlashForgeAdapter] TCP connection timeout');
                socket.destroy();
                resolve(false);
            });

            socket.on('error', (err) => {
                console.error(`[FlashForgeAdapter] TCP connection error: ${err.message}`);
                socket.destroy();
                resolve(false);
            });

            socket.connect(this.tcpPort, this.config.ip, () => {
                // Send login command
                socket.write(this.tcpLogin);

                let responseData = '';
                socket.on('data', (data) => {
                    responseData += data.toString('ascii');

                    // Check for successful login
                    const responseLower = responseData.toLowerCase();
                    if (responseLower.includes('ok') && responseLower.includes('control success')) {
                        console.log('[FlashForgeAdapter] TCP connection successful');

                        // Send logout before closing
                        socket.write(this.tcpLogout);
                        socket.end();
                        resolve(true);
                    }
                });
            });

            // Fallback timeout
            setTimeout(() => {
                if (!socket.destroyed) {
                    socket.destroy();
                    resolve(false);
                }
            }, 12000);
        });
    }

    // ========== Status ==========

    async getStatus() {
        this._requireAuth();

        try {
            const authPayload = {
                serialNumber: this.config.serial,
                checkCode: this.config.checkCode
            };

            const response = await axios.post(this.detailUrl, authPayload, { timeout: 10000 });

            if (response.data && response.data.code === 0) {
                const detail = response.data.detail || {};

                // Map status to normalized format
                const rawStatus = (detail.status || 'unknown').toLowerCase();
                const statusMap = {
                    'ready': 'IDLE',
                    'printing': 'RUNNING',
                    'paused': 'PAUSED',
                    'completed': 'COMPLETED',
                    'error': 'ERROR',
                    'fault': 'ERROR'
                };

                const progressRaw = detail.printProgress || 0.0; // 0.0 to 1.0
                const progressPercent = progressRaw * 100;

                return {
                    success: true,
                    status: statusMap[rawStatus] || 'UNKNOWN',
                    progress_percent: progressPercent,
                    temperatures: {
                        nozzle: detail.nozzleTemp || 0,
                        nozzle_target: detail.nozzleTargetTemp || 0,
                        bed: detail.bedTemp || 0,
                        bed_target: detail.bedTargetTemp || 0
                    },
                    print_job: {
                        file: detail.printFileName || null
                    },
                    raw_data: detail
                };
            } else {
                throw new Error(`HTTP API error: ${response.data?.message}`);
            }
        } catch (error) {
            throw this._wrapError(error, 'getStatus');
        }
    }

    // ========== File Management ==========

    async listFiles(path = '/') {
        // FlashForge file listing not implemented in beta script
        throw AdapterError.UNSUPPORTED('File listing not supported by FlashForge adapter');
    }

    async upload(spec) {
        // FlashForge file upload requires @ghosttypes/ff-api library integration
        // Different models use different upload methods:
        // - AD5X: uploadFileAD5X() - 3MF only, with material mappings
        // - 5M Pro: uploadFile() - supports gcode, gx, 3MF
        //
        // For now, files must be manually uploaded to the printer via:
        // - USB drive
        // - FlashPrint software
        // - FlashForge Cloud
        //
        // Then use the start() method with the filename to print
        throw AdapterError.UNSUPPORTED('File upload not yet implemented for FlashForge printers. Please upload files manually to the printer, then use start() to print.');
    }

    // ========== Print Control ==========

    async start(spec) {
        this._requireAuth();

        try {
            if (!spec.filename) {
                throw AdapterError.PRINTER_ERROR('Filename is required to start print');
            }

            const useMaterialStation = spec.use_material_station || false;

            let payload;
            if (useMaterialStation) {
                // Material Station enabled (multi-color)
                payload = {
                    serialNumber: this.config.serial,
                    checkCode: this.config.checkCode,
                    fileName: spec.filename,
                    levelingBeforePrint: true,
                    flowCalibration: false,
                    useMatlStation: true,
                    gcodeToolCnt: 0,
                    materialMappings: [] // Empty - printer auto-maps
                };
                console.log('[FlashForgeAdapter] Starting print with Material Station');
            } else {
                // Single-color print
                payload = {
                    serialNumber: this.config.serial,
                    checkCode: this.config.checkCode,
                    fileName: spec.filename,
                    levelingBeforePrint: true,
                    flowCalibration: false,
                    useMatlStation: false,
                    gcodeToolCnt: 0,
                    materialMappings: []
                };
                console.log('[FlashForgeAdapter] Starting single-color print');
            }

            const response = await axios.post(this.printGcodeUrl, payload, { timeout: 20000 });

            if (response.data && response.data.code === 0) {
                console.log(`[FlashForgeAdapter] Print '${spec.filename}' started successfully`);

                // Wait for printer to start
                await new Promise(resolve => setTimeout(resolve, 10000));

                return {
                    success: true,
                    jobId: spec.filename,
                    message: `Print started: ${spec.filename}${useMaterialStation ? ' (with Material Station)' : ''}`
                };
            } else {
                return {
                    success: false,
                    message: `Failed to start print: ${response.data?.message}`
                };
            }
        } catch (error) {
            throw this._wrapError(error, 'start');
        }
    }

    async pause(jobId = null) {
        throw AdapterError.UNSUPPORTED('Pause not implemented for FlashForge adapter');
    }

    async resume(jobId = null) {
        throw AdapterError.UNSUPPORTED('Resume not implemented for FlashForge adapter');
    }

    async cancel(jobId = null) {
        throw AdapterError.UNSUPPORTED('Cancel not implemented for FlashForge adapter');
    }

    // ========== Advanced Operations ==========

    async sendGcode(gcode) {
        this._requireAuth();

        try {
            const gcodeSequence = [`~${gcode}\n`];
            const result = await this._sendTcpGcodeSequence(gcodeSequence, `Custom G-code: ${gcode}`);

            return {
                success: result,
                message: result ? 'G-code sent successfully' : 'Failed to send G-code'
            };
        } catch (error) {
            throw this._wrapError(error, 'sendGcode');
        }
    }

    async getJobEvents(jobId) {
        throw AdapterError.UNSUPPORTED('Job history not supported by FlashForge adapter');
    }

    // ========== Bed Positioning ==========

    /**
     * Position bed for ejection (clear platform first, then TCP G-code)
     * Ported from flashforge_printer.py:272-305
     */
    async positionBedForEjection() {
        this._requireAuth();

        try {
            console.log('[FlashForgeAdapter] Preparing for bed positioning...');

            // STEP 1: Check status and clear platform if needed
            const status = await this.getStatus();

            if (status.status === 'COMPLETED') {
                console.log('[FlashForgeAdapter] Printer in COMPLETED state - clearing platform first...');
                if (!await this.clearPlatformState()) {
                    throw new Error('Failed to clear platform state - cannot proceed with bed positioning');
                }
            } else if (status.status === 'IDLE') {
                console.log('[FlashForgeAdapter] Printer already in IDLE state - proceeding with bed positioning');
            } else {
                console.warn(`[FlashForgeAdapter] Printer in unexpected state '${status.status}' - attempting bed positioning anyway...`);
            }

            // STEP 2: Position bed via TCP G-code
            console.log(`[FlashForgeAdapter] Positioning bed to Z${this.zPositionForEjection}mm via TCP...`);

            const gcodeSequence = [
                '~G28 Z0\n',      // Home Z axis
                '~M400\n',        // Wait for completion
                '~G90\n',         // Absolute positioning
                `~G1 Z${this.zPositionForEjection} F${this.zMoveSpeed}\n`, // Move to position
                '~M400\n'         // Wait for completion
            ];

            if (await this._sendTcpGcodeSequence(gcodeSequence, 'Z-Positioning')) {
                console.log(`[FlashForgeAdapter] Bed positioned successfully at Z${this.zPositionForEjection}mm`);
                return {
                    success: true,
                    message: `Bed positioned to Z${this.zPositionForEjection}mm`
                };
            } else {
                return {
                    success: false,
                    message: 'Failed to position bed via TCP'
                };
            }
        } catch (error) {
            throw this._wrapError(error, 'positionBedForEjection');
        }
    }

    /**
     * Clear platform state via HTTP API
     * Ported from flashforge_printer.py:307-364
     */
    async clearPlatformState() {
        try {
            console.log('[FlashForgeAdapter] Clearing platform state...');

            // Check current status
            const status = await this.getStatus();

            if (status.status === 'IDLE') {
                console.log('[FlashForgeAdapter] Printer already in IDLE state - no clearing needed');
                return true;
            }

            if (status.status !== 'COMPLETED') {
                console.warn(`[FlashForgeAdapter] Printer in unexpected state '${status.status}' - attempting to clear platform anyway...`);
            } else {
                console.log('[FlashForgeAdapter] Printer in COMPLETED state - clearing platform to unlock printer...');
            }

            // Send clear platform command
            const payload = {
                serialNumber: this.config.serial,
                checkCode: this.config.checkCode,
                payload: {
                    cmd: 'stateCtrl_cmd',
                    args: { action: 'setClearPlatform' }
                }
            };

            const response = await axios.post(this.controlUrl, payload, { timeout: 10000 });

            if (response.data && response.data.code === 0) {
                console.log('[FlashForgeAdapter] Clear platform command sent');

                // Wait for state to change to IDLE
                for (let i = 0; i < 7; i++) {
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    const newStatus = await this.getStatus();
                    if (newStatus.status === 'IDLE') {
                        console.log('[FlashForgeAdapter] Printer transitioned to IDLE state');
                        return true;
                    }

                    console.log(`[FlashForgeAdapter] Waiting for IDLE state, current: ${newStatus.status}`);
                }

                console.warn('[FlashForgeAdapter] Printer did not quickly transition to IDLE after clear platform');
                return false;
            } else {
                console.error(`[FlashForgeAdapter] Clear platform failed: ${response.data?.message}`);
                return false;
            }
        } catch (error) {
            console.error(`[FlashForgeAdapter] Error clearing platform state: ${error.message}`);
            return false;
        }
    }

    /**
     * Send TCP G-code sequence
     * Ported from flashforge_printer.py:366-429
     */
    async _sendTcpGcodeSequence(gcodeSequence, context = 'G-code') {
        console.log(`[FlashForgeAdapter] Sending ${context} sequence via TCP...`);

        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(10000);

            let success = false;

            socket.on('timeout', () => {
                console.error(`[FlashForgeAdapter] TCP timeout during ${context}`);
                socket.destroy();
                resolve(false);
            });

            socket.on('error', (err) => {
                console.error(`[FlashForgeAdapter] TCP error during ${context}: ${err.message}`);
                socket.destroy();
                resolve(false);
            });

            socket.connect(this.tcpPort, this.config.ip, async () => {
                try {
                    console.log(`[FlashForgeAdapter] TCP connected for ${context}`);

                    // Login
                    const loginResult = await this._sendReceiveTcpCommand(socket, this.tcpLogin, 'Login', 7000);
                    if (!loginResult || !loginResult.toLowerCase().includes('ok') || !loginResult.toLowerCase().includes('control success')) {
                        console.warn(`[FlashForgeAdapter] TCP login response: '${loginResult}'. Proceeding cautiously.`);
                    } else {
                        console.log(`[FlashForgeAdapter] TCP login successful for ${context}`);
                    }

                    await new Promise(resolve => setTimeout(resolve, 200));

                    // Send G-code sequence
                    let allSuccessful = true;
                    for (const cmdLine of gcodeSequence) {
                        if (!cmdLine.trim()) continue;

                        // Set timeout based on command type
                        let timeout = 7000;
                        if (cmdLine.toUpperCase().includes('G28')) {
                            timeout = 90000; // Homing takes time
                        } else if (cmdLine.toUpperCase().includes('M400')) {
                            timeout = 60000; // Wait commands
                        }

                        const resp = await this._sendReceiveTcpCommand(socket, cmdLine, `${context}: ${cmdLine.trim()}`, timeout);

                        const isCritical = ['G0', 'G1', 'G28', 'M400'].some(x => cmdLine.toUpperCase().includes(x));

                        if (isCritical && (!resp || !resp.toLowerCase().includes('ok'))) {
                            console.error(`[FlashForgeAdapter] Critical command '${cmdLine.trim()}' failed. Response: '${resp}'`);
                            allSuccessful = false;
                            break;
                        } else if (resp && resp.toLowerCase().includes('ok')) {
                            console.log(`[FlashForgeAdapter] Command '${cmdLine.trim()}' acknowledged`);
                        } else if (!isCritical) {
                            console.log(`[FlashForgeAdapter] Non-critical command '${cmdLine.trim()}' sent. Response: '${resp}'`);
                        }
                    }

                    if (allSuccessful) {
                        console.log(`[FlashForgeAdapter] ${context} sequence completed successfully`);
                        success = true;
                    }

                    // Logout
                    await this._sendReceiveTcpCommand(socket, this.tcpLogout, 'Logout', 2000, false);
                    socket.end();
                    console.log(`[FlashForgeAdapter] TCP connection closed for ${context}`);

                    resolve(success);
                } catch (err) {
                    console.error(`[FlashForgeAdapter] Error during ${context}: ${err.message}`);
                    socket.destroy();
                    resolve(false);
                }
            });

            // Fallback timeout
            setTimeout(() => {
                if (!socket.destroyed) {
                    socket.destroy();
                    resolve(false);
                }
            }, 120000); // 2 minute max
        });
    }

    /**
     * Send TCP command and wait for response
     * Ported from flashforge_printer.py:431-483
     */
    _sendReceiveTcpCommand(socket, command, commandName = 'TCP Command', timeout = 7000, readUntilOk = true) {
        return new Promise((resolve) => {
            console.log(`[FlashForgeAdapter] TCP SEND: ${command.trim()}`);

            socket.write(command);

            if (!readUntilOk) {
                resolve('SENT_NO_READ');
                return;
            }

            let fullResponse = '';
            const startTime = Date.now();

            const dataHandler = (chunk) => {
                fullResponse += chunk.toString('ascii');

                // Check if we got "ok"
                if (fullResponse.toLowerCase().includes('\nok') || fullResponse.trim().toLowerCase().endsWith('ok')) {
                    socket.removeListener('data', dataHandler);
                    console.log(`[FlashForgeAdapter] TCP RECV (${commandName}): ${fullResponse.replace(/\n/g, ' | ').replace(/\r/g, '').substring(0, 150)}`);
                    resolve(fullResponse.trim());
                }

                // Buffer limit
                if (fullResponse.length > 2048) {
                    socket.removeListener('data', dataHandler);
                    console.warn(`[FlashForgeAdapter] TCP buffer > 2KB. Breaking.`);
                    resolve(fullResponse.trim());
                }
            };

            socket.on('data', dataHandler);

            // Timeout handler
            setTimeout(() => {
                socket.removeListener('data', dataHandler);
                if (fullResponse) {
                    console.warn(`[FlashForgeAdapter] TCP timeout (${timeout}ms) for '${commandName}'. Buffer: '${fullResponse.substring(0, 100)}'`);
                    resolve(fullResponse.trim());
                } else {
                    console.warn(`[FlashForgeAdapter] TCP timeout (${timeout}ms) for '${commandName}' with no response`);
                    resolve(null);
                }
            }, timeout);
        });
    }

    // ========== Helper Methods ==========

    _requireAuth() {
        if (!this._isAuthenticated) {
            throw AdapterError.NOT_AUTHENTICATED('FlashForge adapter not authenticated');
        }
    }

    _wrapError(error, operation) {
        console.error(`[FlashForgeAdapter] Error during ${operation}:`, error.message);

        if (error instanceof AdapterError) {
            return error;
        }

        if (error.code === 'ECONNREFUSED') {
            return AdapterError.CONNECTION_ERROR(`Connection refused during ${operation}`);
        }

        if (error.code === 'ETIMEDOUT') {
            return AdapterError.CONNECTION_ERROR(`Timeout during ${operation}`);
        }

        return AdapterError.PRINTER_ERROR(`${operation} failed: ${error.message}`);
    }

    /**
     * Wait for print completion with FlashForge-specific logic
     * Ported from flashforge_printer.py:wait_for_completion() (lines 207-266)
     *
     * Handles:
     * - 99.5% progress threshold (higher than other printers)
     * - Accepts both "ready" and "stop" states as potential completion
     * - Adaptive polling intervals (30s early, 10s late, 5s near completion)
     * - Throttled logging (only logs when status changes)
     * - Consecutive error tracking
     */
    async waitForCompletion(progressCallback = null) {
        this._requireAuth();

        console.log('[FlashForgeAdapter] Starting print completion monitoring...');

        // Initial wait for print to start
        await new Promise(resolve => setTimeout(resolve, 15000));

        let consecutiveErrorPolls = 0;
        let lastLoggedStatus = '';

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
                console.warn('[FlashForgeAdapter] Failed to get status, retrying...');
                await new Promise(resolve => setTimeout(resolve, 10000));
                continue;
            }

            // Progress callback for orchestrator logging
            if (progressCallback) {
                try {
                    progressCallback(status);
                } catch (err) {
                    console.error(`[FlashForgeAdapter] Progress callback error: ${err.message}`);
                }
            }

            // Create status line for logging
            const currentStatusLine = `Status: ${status.status} | Progress: ${status.progress_percent.toFixed(1)}% | ` +
                `File: ${status.current_file} | Nozzle: ${status.nozzle_temperature.toFixed(1)}°C | ` +
                `Bed: ${status.bed_temperature.toFixed(1)}°C`;

            // Log only if status changed
            if (currentStatusLine !== lastLoggedStatus) {
                console.log(`[FlashForgeAdapter] ${currentStatusLine}`);
                lastLoggedStatus = currentStatusLine;
            }

            // PRIMARY: Check for "completed" status
            if (status.status === 'completed') {
                console.log('[FlashForgeAdapter] Print completed (COMPLETED)');
                return status;
            }

            // SECONDARY: "ready" or "stop" with 99.5% progress
            if ((status.status === 'ready' || status.status === 'stop') && status.progress_percent >= 99.5) {
                console.log(`[FlashForgeAdapter] Print completed (${status.status.toUpperCase()} at 99.5%+ progress)`);
                return status;
            }

            // Error detection
            if (status.status === 'error' || status.status === 'fault') {
                throw new Error(`Print failed: ${status.status}`);
            }

            // Adaptive polling intervals
            let pollInterval;
            if (status.progress_percent < 90) {
                pollInterval = 30000; // 30s early print
            } else if (status.progress_percent < 99) {
                pollInterval = 10000; // 10s late print
            } else {
                pollInterval = 5000;  // 5s near completion
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }
}

module.exports = FlashForgeHybridAdapter;
