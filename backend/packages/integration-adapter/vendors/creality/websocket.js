// Creality WebSocket Adapter - WebSocket communication for K1C
// Ported from ottomat3d-beta-test/src/printers/creality_printer.py

const WebSocket = require('ws');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const IPrinterAdapter = require('../../IPrinterAdapter');
const { AdapterError } = require('../../types');

/**
 * Creality Printer Adapter (K1C)
 * Uses WebSocket protocol for communication
 * NOTE: Printer must be ROOTED for WebSocket access
 */
class CrealityWebSocketAdapter extends IPrinterAdapter {
    constructor() {
        super();
        this.config = null;
        this._isAuthenticated = false;

        // WebSocket settings
        this.wsPort = 9999;
        this.wsUrl = null;
        this.wsTimeout = 10000; // 10 seconds
        this.pingInterval = 30000; // 30 seconds
        this.pingTimeout = 30000; // 30 seconds

        // Status tracking
        this.fullStatus = {}; // Persistent status across partial updates

        // Status codes mapping
        this.statusCodes = {
            0: 'IDLE',
            1: 'PRINTING',
            2: 'PAUSED',
            3: 'ERROR',
            4: 'FINISHED'
        };
    }

    // ========== Lifecycle ==========

    async authenticate(config) {
        this.config = config;
        this.wsUrl = `ws://${config.ip}:${this.wsPort}`;

        console.log(`[CrealityAdapter] Authenticating with ${config.ip}...`);
        console.log(`[CrealityAdapter] Note: Printer must be ROOTED for WebSocket access`);

        // Test WebSocket connection
        if (!await this._testConnection()) {
            throw AdapterError.AUTH('WebSocket connection test failed');
        }

        this._isAuthenticated = true;
        console.log('[CrealityAdapter] Authentication successful');
    }

    isAuthenticated() {
        return this._isAuthenticated;
    }

    async close() {
        this._isAuthenticated = false;
        this.config = null;
        this.fullStatus = {};
    }

    // ========== Connection Testing ==========

    async _testConnection() {
        return new Promise((resolve) => {
            let ws = null;
            let resolved = false;

            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    console.error('[CrealityAdapter] WebSocket connection timeout');
                    if (ws) {
                        try { ws.close(); } catch (e) {}
                    }
                    resolve(false);
                }
            }, this.wsTimeout);

            try {
                ws = new WebSocket(this.wsUrl, {
                    handshakeTimeout: this.wsTimeout
                });

                ws.on('open', async () => {
                    console.log('[CrealityAdapter] WebSocket connection established');

                    // Send initial status request
                    try {
                        ws.send(JSON.stringify({ method: 'get_status' }));

                        // Wait for response
                        const responseTimeout = setTimeout(() => {
                            if (!resolved) {
                                resolved = true;
                                clearTimeout(timeout);
                                console.error('[CrealityAdapter] No response from printer');
                                ws.close();
                                resolve(false);
                            }
                        }, 5000);

                        ws.once('message', (data) => {
                            clearTimeout(responseTimeout);
                            if (!resolved) {
                                try {
                                    const response = JSON.parse(data.toString());
                                    if (response && typeof response === 'object' && Object.keys(response).length > 0) {
                                        resolved = true;
                                        clearTimeout(timeout);
                                        console.log('[CrealityAdapter] Successfully connected to Creality printer');
                                        ws.close();
                                        resolve(true);
                                    } else {
                                        resolved = true;
                                        clearTimeout(timeout);
                                        console.error('[CrealityAdapter] Invalid response from printer');
                                        ws.close();
                                        resolve(false);
                                    }
                                } catch (e) {
                                    resolved = true;
                                    clearTimeout(timeout);
                                    console.error('[CrealityAdapter] Failed to parse response');
                                    ws.close();
                                    resolve(false);
                                }
                            }
                        });
                    } catch (e) {
                        if (!resolved) {
                            resolved = true;
                            clearTimeout(timeout);
                            console.error(`[CrealityAdapter] Error sending test command: ${e.message}`);
                            ws.close();
                            resolve(false);
                        }
                    }
                });

                ws.on('error', (error) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        console.error(`[CrealityAdapter] WebSocket error: ${error.message}`);
                        console.error('[CrealityAdapter] Ensure printer is ROOTED and WebSocket access is available');
                        resolve(false);
                    }
                });

                ws.on('close', () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        resolve(false);
                    }
                });

            } catch (error) {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    console.error(`[CrealityAdapter] Failed to connect: ${error.message}`);
                    resolve(false);
                }
            }
        });
    }

    // ========== Printer Information ==========

    async getPrinterInfo() {
        this._requireAuth();

        return {
            brand: 'Creality',
            model: 'K1C',
            ip_address: this.config.ip,
            connection_type: 'WebSocket'
        };
    }

    async getCapabilities() {
        if (this._capabilities) {
            return this._capabilities;
        }

        this._capabilities = {
            upload_file: true,   // Moonraker upload via HTTP
            start_print: true,
            pause_print: false,  // Not implemented in beta script
            resume_print: false, // Not implemented in beta script
            cancel_print: false, // Not implemented in beta script
            send_gcode: false,   // G-code via Moonraker HTTP, not WebSocket
            get_status: true,
            position_bed: false, // Creality does NOT need bed positioning
            job_history: false,
            wait_for_completion: true  // Creality-specific 99% stuck logic with WebSocket reconnection
        };

        return this._capabilities;
    }

    // ========== Status & Monitoring ==========

    async getStatus() {
        this._requireAuth();

        return new Promise((resolve, reject) => {
            let ws = null;
            let resolved = false;

            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    if (ws) {
                        try { ws.close(); } catch (e) {}
                    }
                    reject(AdapterError.TIMEOUT('Status request timeout'));
                }
            }, 5000);

            try {
                ws = new WebSocket(this.wsUrl, {
                    handshakeTimeout: this.wsTimeout
                });

                ws.on('open', () => {
                    ws.send(JSON.stringify({ method: 'get_status' }));
                });

                ws.on('message', (data) => {
                    if (!resolved) {
                        try {
                            const response = JSON.parse(data.toString());

                            // Update persistent status
                            this.fullStatus = { ...this.fullStatus, ...response };

                            // Extract relevant fields
                            const stateCode = this.fullStatus.state || -1;
                            const stateName = this.statusCodes[stateCode] || `UNKNOWN(${stateCode})`;
                            const progress = this.fullStatus.printProgress || 0;
                            const currentFile = this.fullStatus.printFileName || '';
                            const nozzleTemp = this.fullStatus.nozzleTemp || 0;
                            const bedTemp = this.fullStatus.bedTemp0 || 0;
                            const timeLeft = this.fullStatus.printLeftTime || 0;

                            resolved = true;
                            clearTimeout(timeout);
                            ws.close();

                            resolve({
                                status: stateName,
                                state_code: stateCode,
                                progress_percent: progress,
                                current_file: currentFile.split('/').pop() || 'No file',
                                nozzle_temperature: nozzleTemp,
                                bed_temperature: bedTemp,
                                remaining_time_minutes: timeLeft > 0 ? timeLeft / 60 : null,
                                raw_data: { ...this.fullStatus }
                            });
                        } catch (e) {
                            resolved = true;
                            clearTimeout(timeout);
                            ws.close();
                            reject(AdapterError.PRINTER_ERROR(`Failed to parse status: ${e.message}`));
                        }
                    }
                });

                ws.on('error', (error) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        reject(AdapterError.NETWORK(`WebSocket error: ${error.message}`));
                    }
                });

                ws.on('close', () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        reject(AdapterError.NETWORK('WebSocket closed unexpectedly'));
                    }
                });

            } catch (error) {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    reject(this._wrapError(error, 'getStatus'));
                }
            }
        });
    }

    async* getStatusStream() {
        this._requireAuth();

        let ws = null;
        let streamActive = true;

        try {
            ws = new WebSocket(this.wsUrl, {
                handshakeTimeout: this.wsTimeout
            });

            // Wait for connection
            await new Promise((resolve, reject) => {
                ws.once('open', resolve);
                ws.once('error', reject);
            });

            console.log('[CrealityAdapter] Status stream connected');

            // Send initial status request
            ws.send(JSON.stringify({ method: 'get_status' }));

            // Set up periodic status requests
            const statusInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ method: 'get_status' }));
                }
            }, 5000); // Request every 5 seconds

            // Process messages
            while (streamActive) {
                const message = await new Promise((resolve, reject) => {
                    const onMessage = (data) => {
                        ws.off('error', onError);
                        ws.off('close', onClose);
                        resolve(data);
                    };

                    const onError = (error) => {
                        ws.off('message', onMessage);
                        ws.off('close', onClose);
                        reject(error);
                    };

                    const onClose = () => {
                        ws.off('message', onMessage);
                        ws.off('error', onError);
                        streamActive = false;
                        resolve(null);
                    };

                    ws.once('message', onMessage);
                    ws.once('error', onError);
                    ws.once('close', onClose);
                });

                if (!message) break;

                try {
                    const response = JSON.parse(message.toString());
                    this.fullStatus = { ...this.fullStatus, ...response };

                    const stateCode = this.fullStatus.state || -1;
                    const stateName = this.statusCodes[stateCode] || `UNKNOWN(${stateCode})`;

                    yield {
                        status: stateName,
                        state_code: stateCode,
                        progress_percent: this.fullStatus.printProgress || 0,
                        current_file: (this.fullStatus.printFileName || '').split('/').pop() || 'No file',
                        nozzle_temperature: this.fullStatus.nozzleTemp || 0,
                        bed_temperature: this.fullStatus.bedTemp0 || 0,
                        remaining_time_minutes: this.fullStatus.printLeftTime > 0 ? this.fullStatus.printLeftTime / 60 : null,
                        raw_data: { ...this.fullStatus }
                    };
                } catch (e) {
                    console.error(`[CrealityAdapter] Error parsing status: ${e.message}`);
                }
            }

            clearInterval(statusInterval);
            ws.close();

        } catch (error) {
            if (ws) {
                try { ws.close(); } catch (e) {}
            }
            throw this._wrapError(error, 'getStatusStream');
        }
    }

    // ========== File Management ==========

    async upload(spec) {
        this._requireAuth();

        const localPath = spec.localPath;
        const filename = spec.filename || path.basename(localPath);

        console.log(`[CrealityAdapter] Uploading file: ${filename}`);

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

            // Upload to Moonraker API (rooted printer on port 4408)
            const uploadUrl = `http://${this.config.ip}:4408/server/files/upload`;

            const response = await axios.post(uploadUrl, form, {
                headers: form.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 120000 // 2 minute timeout for large files
            });

            if (response.status === 201 || response.status === 200) {
                console.log(`[CrealityAdapter] File '${filename}' uploaded successfully`);
                return { success: true, message: `File uploaded: ${filename}` };
            } else {
                return { success: false, message: `Upload failed with status ${response.status}` };
            }

        } catch (error) {
            console.error(`[CrealityAdapter] Upload error: ${error.message}`);
            throw this._wrapError(error, 'File upload');
        }
    }

    // ========== Print Control ==========

    async start(spec) {
        this._requireAuth();

        const filename = spec.filename;
        console.log(`[CrealityAdapter] Starting print: ${filename}`);

        return new Promise((resolve, reject) => {
            let ws = null;
            let resolved = false;

            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    if (ws) {
                        try { ws.close(); } catch (e) {}
                    }
                    reject(AdapterError.TIMEOUT('Print start timeout'));
                }
            }, 10000);

            try {
                ws = new WebSocket(this.wsUrl, {
                    handshakeTimeout: this.wsTimeout
                });

                ws.on('open', () => {
                    console.log('[CrealityAdapter] Connected to WebSocket for print start');

                    // Construct file path for Creality
                    const opgcodefilePath = `printprt:/usr/data/printer_data/gcodes/${filename}`;

                    const startCommand = {
                        method: 'set',
                        params: {
                            opGcodeFile: opgcodefilePath
                        }
                    };

                    ws.send(JSON.stringify(startCommand));

                    // Wait for response or timeout
                    setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            clearTimeout(timeout);
                            console.log('[CrealityAdapter] Print command sent (no immediate response)');
                            console.log(`[CrealityAdapter] Assuming print started: ${filename}`);
                            ws.close();
                            resolve({
                                success: true,
                                message: `Print started: ${filename}`
                            });
                        }
                    }, 3000);
                });

                ws.on('message', (data) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        console.log('[CrealityAdapter] Print command sent successfully');
                        ws.close();
                        resolve({
                            success: true,
                            message: `Print started: ${filename}`
                        });
                    }
                });

                ws.on('error', (error) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        console.error(`[CrealityAdapter] Failed to start print: ${error.message}`);
                        reject(AdapterError.PRINTER_ERROR(`Failed to start print: ${error.message}`));
                    }
                });

                ws.on('close', () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        // If we get here, assume success (connection closed after command sent)
                        resolve({
                            success: true,
                            message: `Print command sent: ${filename}`
                        });
                    }
                });

            } catch (error) {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    reject(this._wrapError(error, 'start'));
                }
            }
        });
    }

    async pause(jobId = null) {
        throw AdapterError.UNSUPPORTED('Pause not implemented for Creality printers');
    }

    async resume(jobId = null) {
        throw AdapterError.UNSUPPORTED('Resume not implemented for Creality printers');
    }

    async cancel(jobId = null) {
        throw AdapterError.UNSUPPORTED('Cancel not implemented for Creality printers');
    }

    // ========== Advanced Operations ==========

    async sendGcode(gcode) {
        throw AdapterError.UNSUPPORTED('G-code commands should be sent via Moonraker HTTP API (port 7125), not WebSocket');
    }

    /**
     * Position bed for ejection
     * NOTE: Creality printers DO NOT need bed positioning
     * This method is a no-op and always returns success
     */
    async positionBedForEjection() {
        this._requireAuth();

        console.log('[CrealityAdapter] Bed positioning not required for Creality printers');
        return {
            success: true,
            message: 'Bed positioning not required for Creality printers'
        };
    }

    /**
     * Wait for print completion with Creality-specific logic
     * Ported from creality_printer.py:wait_for_completion() (lines 209-320)
     *
     * Handles:
     * - 99% stuck logic: ERROR/PAUSED/IDLE at 99% = completion (not failure)
     * - WebSocket reconnection with automatic retry
     * - Failed to start detection (IDLE + 0% + no file)
     * - Throttled logging (every 10 seconds)
     */
    async waitForCompletion(progressCallback = null) {
        this._requireAuth();

        console.log('[CrealityAdapter] Starting print completion monitoring...');

        // Initial wait for print to start
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Reset persistent status
        this.fullStatus = {};
        let connectionAttempts = 0;
        let lastLogTime = 0; // Track when we last logged to console

        // Outer reconnection loop
        while (true) {
            let ws = null;
            let resolved = false;

            try {
                connectionAttempts++;
                console.log(`[CrealityAdapter] Connecting for monitoring (attempt #${connectionAttempts})...`);

                ws = new WebSocket(this.wsUrl, {
                    handshakeTimeout: this.wsTimeout
                });

                // Wait for connection
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Connection timeout')), this.wsTimeout);

                    ws.once('open', () => {
                        clearTimeout(timeout);
                        resolve();
                    });

                    ws.once('error', (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    });
                });

                console.log(`[CrealityAdapter] Connected for monitoring (attempt #${connectionAttempts})`);
                connectionAttempts = 0; // Reset on successful connection

                // Send initial status request
                try {
                    ws.send(JSON.stringify({ method: 'get_status' }));
                } catch (err) {
                    // Ignore send errors, will retry
                }

                // Inner message receiving loop
                while (true) {
                    const message = await new Promise((resolve, reject) => {
                        const onMessage = (data) => {
                            ws.off('error', onError);
                            ws.off('close', onClose);
                            resolve(data);
                        };

                        const onError = (error) => {
                            ws.off('message', onMessage);
                            ws.off('close', onClose);
                            reject(error);
                        };

                        const onClose = () => {
                            ws.off('message', onMessage);
                            ws.off('error', onError);
                            resolve(null); // null signals connection closed
                        };

                        ws.once('message', onMessage);
                        ws.once('error', onError);
                        ws.once('close', onClose);
                    });

                    // Connection closed, break to reconnect
                    if (!message) {
                        console.log('[CrealityAdapter] WebSocket connection closed - will reconnect');
                        break;
                    }

                    // Parse and process message
                    try {
                        const newData = JSON.parse(message.toString());

                        // Update persistent status
                        this.fullStatus = { ...this.fullStatus, ...newData };

                        // Get current status values
                        const stateCode = this.fullStatus.state ?? -1;
                        const currentFile = this.fullStatus.printFileName || '';
                        const progress = this.fullStatus.printProgress || 0;

                        // Map state code to name
                        const stateName = this.statusCodes[stateCode] || `UNKNOWN(${stateCode})`;
                        const filenameShort = currentFile.split('/').pop() || 'No file';

                        // Create full status object for callback
                        const status = {
                            status: stateName,
                            state_code: stateCode,
                            progress_percent: progress,
                            current_file: filenameShort,
                            nozzle_temperature: this.fullStatus.nozzleTemp || 0,
                            bed_temperature: this.fullStatus.bedTemp0 || 0,
                            remaining_time_minutes: this.fullStatus.printLeftTime > 0 ? this.fullStatus.printLeftTime / 60 : null,
                            raw_data: { ...this.fullStatus }
                        };

                        // Progress callback for orchestrator logging
                        if (progressCallback) {
                            try {
                                progressCallback(status);
                            } catch (err) {
                                console.error(`[CrealityAdapter] Progress callback error: ${err.message}`);
                            }
                        }

                        // Throttled logging (only log every 10 seconds)
                        const currentTime = Date.now();
                        if (currentTime - lastLogTime >= 10000) {
                            console.log(`[CrealityAdapter] Status: ${stateName} | Progress: ${progress}% | File: ${filenameShort}`);
                            lastLogTime = currentTime;
                        }

                        // PRIMARY: Check for FINISHED (state 4)
                        if (stateCode === 4) {
                            console.log('[CrealityAdapter] Print completed (FINISHED)');
                            if (ws) ws.close();
                            return status;
                        }

                        // SECONDARY: 99% stuck logic - ERROR at 99% = finished
                        if (stateCode === 3 && progress >= 99) {
                            console.log('[CrealityAdapter] Print completed (ERROR at 99% - stuck logic)');
                            if (ws) ws.close();
                            return status;
                        }

                        // TERTIARY: PAUSED at 99% = finished
                        if (stateCode === 2 && progress >= 99) {
                            console.log('[CrealityAdapter] Print completed (PAUSED at 99%+ progress)');
                            if (ws) ws.close();
                            return status;
                        }

                        // QUATERNARY: IDLE at 99% = finished
                        if (stateCode === 0 && progress >= 99) {
                            console.log('[CrealityAdapter] Print completed (IDLE at 99%)');
                            if (ws) ws.close();
                            return status;
                        }

                        // Failed to start detection
                        if (stateCode === 0 && progress === 0 && !currentFile) {
                            if (ws) ws.close();
                            throw new Error('No print running - may have failed to start');
                        }

                    } catch (parseError) {
                        // Ignore JSON parsing errors, continue monitoring
                        console.debug(`[CrealityAdapter] Error processing message: ${parseError.message}`);
                    }
                }

                // If we reach here, connection was closed, will reconnect

            } catch (error) {
                console.log(`[CrealityAdapter] Connection error (attempt #${connectionAttempts}): ${error.message}`);
            } finally {
                // Clean up WebSocket
                if (ws) {
                    try {
                        ws.close();
                    } catch (e) {
                        // Ignore close errors
                    }
                }
            }

            // Wait before reconnecting (exponential backoff, max 5s)
            const waitTime = Math.min(5000, connectionAttempts * 1000);
            console.log(`[CrealityAdapter] Retrying connection in ${waitTime / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

module.exports = CrealityWebSocketAdapter;
