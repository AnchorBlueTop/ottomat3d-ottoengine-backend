// src/bambulabs-api/mqtt-client.js (Properly Formatted, Arrow Funcs, Fixes)

const mqtt = require('mqtt');
const EventEmitter = require('events');
const { GcodeState, PrintStatus, getPrintStatusName } = require('./data/states');
const path = require('path'); // Needed for startPrint defaults

// Constants
const DEFAULT_MQTT_PORT = 8883;
const MQTT_USERNAME = 'bblp';
const CONNECTION_TIMEOUT = 60 * 1000; // 60 seconds

class PrinterMQTTClient extends EventEmitter {
    /**
     * Creates an instance of PrinterMQTTClient.
     * @param {object} options Configuration options
     * @param {string} options.hostname Printer IP address or hostname
     * @param {string} options.accessCode Printer access code
     * @param {string} options.serialNumber Printer serial number
     * @param {number} [options.port=8883] MQTT port
     * @param {number} [options.timeout=60] Connection timeout in seconds
     * @param {boolean} [options.pushallOnConnect=true] Request full status on connect
     * @param {boolean} [options.debug=false] Enable debug logging
     */
    constructor({
        hostname, accessCode, serialNumber, port = DEFAULT_MQTT_PORT, timeout = 60,
        pushallOnConnect = true, debug = false
    }) {
        super();
        this._hostname = hostname;
        this._accessCode = accessCode;
        this._serialNumber = serialNumber;
        this._port = port;
        this._timeout = timeout * 1000;
        this._pushallOnConnect = pushallOnConnect;
        this._debug = debug;

        this._mqttClient = null;
        this._isConnected = false;
        this._data = {}; // Internal state cache
        this._reportTopic = `device/${this._serialNumber}/report`;
        this._requestTopic = `device/${this._serialNumber}/request`;
        this._connectionPromise = null;

        // No bindings needed here as methods use arrow functions
    }

    // --- Logging Methods ---
    log = (...args) => {
        if (this._debug) {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp} MQTT DEBUG]`, ...args);
        }
    };

    info = (...args) => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp} MQTT INFO ]`, ...args);
    };

    error = (...args) => {
        const timestamp = new Date().toLocaleTimeString();
        console.error(`[${timestamp} MQTT ERROR]`, ...args);
        const errorMsg = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
        this.emit('error', errorMsg);
    };

    // --- Connection Management ---
    connect = async () => {
        if (this._isConnected) {
            this.info('Already connected.');
            return Promise.resolve();
        }
        if (this._connectionPromise) {
            this.info('Connection already in progress.');
            return this._connectionPromise;
        }

        this.info(`[JS API] Attempting MQTT connection to ${this._hostname}:${this._port} with SN ${this._serialNumber}`);
        const options = {
            port: this._port, host: this._hostname, username: MQTT_USERNAME, password: this._accessCode,
            protocol: 'mqtts', connectTimeout: this._timeout, reconnectPeriod: 5000,
            rejectUnauthorized: false, clientId: `node-mqtt-${this._serialNumber}-${Math.random().toString(16).slice(2, 10)}`
        };

        this._connectionPromise = new Promise((resolve, reject) => {
            let connectTimeoutHandle;
            try {
                if (this._mqttClient) { this._mqttClient.end(true); this._mqttClient = null; } // Clean up old client if exists
                this._mqttClient = mqtt.connect(options);

                connectTimeoutHandle = setTimeout(() => {
                    this.error(`Connection timed out after ${this._timeout / 1000} seconds.`);
                    if (this._mqttClient && !this._isConnected) this._mqttClient.end(true); // Force close
                    this._mqttClient = null;
                    this._connectionPromise = null;
                    reject(new Error('Connection Timeout'));
                }, this._timeout);

                this._mqttClient.once('connect', (connack) => {
                    clearTimeout(connectTimeoutHandle);
                    this.log(`[JS API] 'connect' event received. Connack:`, connack); // Log the connack object
                    if (!connack || connack.returnCode === 0) {
                        this.info(`[JS API] MQTT Connected successfully to SN ${this._serialNumber}.`);
                        this._isConnected = true;
                        this._setupListeners(); // Attach listeners AFTER connection
                        this._subscribeReport(); // Subscribe AFTER connection
                        if (this._pushallOnConnect) this.pushall();
                        this.emit('mqtt_connect');
                        resolve();
                    } else {
                        this.error(`[JS API] MQTT Connection FAILED for SN ${this._serialNumber}. Code: ${connack?.returnCode}, Message: ${connack?.reasonString || 'N/A'}`);
                        if(this._mqttClient) this._mqttClient.end(true); // Ensure cleanup
                        this._mqttClient = null;
                        this._connectionPromise = null;
                        reject(new Error(`MQTT Connection Failed (Code: ${connack?.returnCode})}`));
                    }
                });

                this._mqttClient.once('error', (err) => {
                    clearTimeout(connectTimeoutHandle);
                    this.error(`[JS API] MQTT 'error' event (pre-connection or during connect) for SN ${this._serialNumber}:`, err.message);
                    if (!this._isConnected) { // Only handle pre-connection errors
                        if(this._mqttClient) this._mqttClient.end(true);
                        this._mqttClient = null;
                        this._connectionPromise = null;
                        reject(err);
                    }
                    // Let the persistent _onError handler deal with errors after connection
                });

            } catch (err) {
                clearTimeout(connectTimeoutHandle);
                this.error('Error initializing MQTT connection:', err);
                this._connectionPromise = null;
                reject(err);
            }
        });
        // We return the promise, but don't nullify it here. Let resolve/reject handle that.
        return this._connectionPromise;
    }; // End connect method

    disconnect = () => {
        if (this._mqttClient) {
            this.info('Disconnecting MQTT client...');
            this._removeListeners(); // Remove listeners first
            this._mqttClient.end(true, () => { // Force close, provide callback
                 this.info('MQTT client disconnected confirmation received.');
                 // State updates handled by _onClose now
            });
            // Set state immediately for explicit disconnect
            this._isConnected = false;
            this._mqttClient = null;
            this._connectionPromise = null;
            this.emit('mqtt_close'); // Emit immediately
        } else {
            this.info('MQTT client already disconnected or not initialized.');
            this._isConnected = false; // Ensure state consistency
            this._connectionPromise = null;
        }
    }; // End disconnect method

    // --- Listeners ---
    _setupListeners = () => {
        if (!this._mqttClient) return this.error('Cannot setup listeners, client is null.');
        this._removeListeners(); // Ensure no duplicates
        // Use direct method references (which are arrow funcs with correct 'this')
        this._mqttClient.on('message', this._onMessage);
        this._mqttClient.on('error', this._onError);
        this._mqttClient.on('close', this._onClose);
        this._mqttClient.on('offline', () => this.info('MQTT client is offline.'));
        this._mqttClient.on('reconnect', () => this.info('MQTT client attempting to reconnect...'));
        this.log('MQTT event listeners attached.');
    }; // End _setupListeners method

    _removeListeners = () => {
         if (!this._mqttClient) return;
         // Use the same references used in .on()
         this._mqttClient.removeListener('message', this._onMessage);
         this._mqttClient.removeListener('error', this._onError);
         this._mqttClient.removeListener('close', this._onClose);
         this._mqttClient.removeAllListeners('offline');
         this._mqttClient.removeAllListeners('reconnect');
         this.log('MQTT event listeners removed.');
    }; // End _removeListeners method

    _subscribeReport = () => {
        if (!this._mqttClient || !this._isConnected) {
             return this.error('Cannot subscribe, MQTT not connected');
        }
        // *** ADD LOGGING HERE ***
        console.log(`[MQTTClient DEBUG] _subscribeReport: Serial Check: "${this._serialNumber}"`);
        console.log(`[MQTTClient DEBUG] _subscribeReport: Topic Check: "${this._reportTopic}"`);
        // *** END LOGGING ***
    
        this.log(`Subscribing to topic: ${this._reportTopic}`); // Keep existing log
        this._mqttClient.subscribe(this._reportTopic, { qos: 0 }, (err, granted) => {
            if (err) {
                 // Log the topic again on error
                 this.error(`Failed to subscribe to "${this._reportTopic}":`, err);
            } else {
                 this.log('Subscribed OK', granted);
            }
        });
    };

    // --- Event Handlers (Arrow Functions) ---
    _onMessage = (topic, buf) => {
        if (topic !== this._reportTopic || !this._isConnected) return; // Ignore if disconnected or wrong topic
        this.log(`Received message on topic: ${topic}`);
        let messageJson;
        try {
            const messageString = buf.toString();
            this.log(`[JS API SN:${this._serialNumber}] Raw Payload (${messageString.length} bytes): ${messageString.substring(0, 500) + (messageString.length > 500 ? '...' : '')}`);
            messageJson = JSON.parse(messageString);

            let oldState = this._data?.print?.gcode_state;
            let oldErrorCode = this._data?.print?.print_error || "0";

            // Deep merge data
            const merge=(t,s)=>{for(const k in s){ if(s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])){t[k]=t[k]||{}; merge(t[k],s[k]);} else {t[k]=s[k];}}};
            merge(this._data, messageJson);

            // Emit specific events
            if (messageJson.print) {
                 const newState = this._data?.print?.gcode_state; // Read merged state
                 const newErrorCode = this._data?.print?.print_error || "0";

                 if (newState !== undefined && newState !== oldState) {
                     this.emit('state_change', newState); // Emit string state name
                 }
                 if (newErrorCode !== "0" && newErrorCode !== oldErrorCode) {
                      this.error(`Printer reported NEW error code: ${newErrorCode}`);
                      this.emit('print_error', newErrorCode);
                 } else if (newErrorCode === "0" && oldErrorCode !== "0") {
                      this.info(`Printer error code cleared (was ${oldErrorCode}, now ${newErrorCode})`);
                 }
            }
            // Always emit general update AFTER merging
            this.emit('update', this._data);

        } catch (err) {
            this.error('Failed to parse incoming message:', err);
            this.error(`[JS API SN:${this._serialNumber}] Failed to parse payload. Original:`, buf.toString());
        }
    }; // End _onMessage

    _onError = (err) => {
        this.error('MQTT Client Runtime Error:', err.message);
        // Check error codes that indicate connection loss
        if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED' || err.message.includes('closed')) {
            this.log('Connection likely lost, attempting cleanup and relying on reconnect mechanism.');
            // Update state, but let reconnectPeriod handle actual reconnect attempts
            if (this._isConnected) {
                 this._isConnected = false;
                 this._connectionPromise = null; // Allow new external connect attempts
                 this.emit('close'); // Indicate connection is lost
            }
        }
        // Emit the error for external handling regardless
        this.emit('error', err);
    }; // End _onError

    _onClose = () => {
        // This handles unexpected closes OR closes after explicit disconnect call
        const wasConnected = this._isConnected; // Check state *before* changing it
        this._isConnected = false; // Update state first
        this._connectionPromise = null; // Allow new connection attempts

        if (wasConnected) {
            this.info('MQTT Connection closed unexpectedly.');
        } else {
            this.info('MQTT Connection closed.'); // Expected after disconnect() or failed connect
        }
        this.emit('mqtt_close'); // Ensure close event is emitted using consistent name
    }; // End _onClose

    // --- Command Publishing (Restored Promise, QoS 0) ---
    _publishCommand = async (payload) => {
        if (!this._mqttClient || !this._isConnected) {
            this.error('Cannot publish command, MQTT client not connected.');
            return false; // Return false immediately (Promise will resolve false)
        }

        const commandJson = JSON.stringify(payload);
        this.log(`Publishing command to ${this._requestTopic} (QoS 0):`, commandJson.substring(0, 200) + '...');

        // Return a new Promise
        return new Promise((resolve) => {
             this.log(`Calling _mqttClient.publish (Promise, QoS 0)...`, 'debug');
             // Use QoS 0 because QoS 1 callbacks were unreliable in tests
             this._mqttClient.publish(this._requestTopic, commandJson, { qos: 0 }, (err) => {
                  // Log inside callback
                  this.log(`PUBLISH CALLBACK EXECUTED! (Promise, QoS 0)`, 'debug');
                  if (err) {
                       this.error(`Publish command FAILED in callback:`, err);
                       resolve(false); // Resolve Promise with false on error
                  } else {
                       this.log(`Publish command reported success by MQTT library (QoS 0).`, 'debug');
                       resolve(true); // Resolve Promise with true on success
                  }
             });
             this.log(`_mqttClient.publish call made (Promise waiting for QoS 0 callback).`, 'debug');
        });
    }; // End _publishCommand

    // --- Public API Methods (Arrow Functions) ---
    pushall = async () => {
        this.info(`[JS API SN:${this._serialNumber}] Requesting full state update (pushall)...`);
        // Include info command based on previous logs showing it's sent
        return this._publishCommand({ pushing: { command: 'pushall' }, info: {command: 'get_version'} });
    };

    sendGcode = async (gcodeCommand, gcodeCheck = false) => {
        if (gcodeCheck) {
            const lines = Array.isArray(gcodeCommand) ? gcodeCommand : [gcodeCommand];
            for (const line of lines) {
                if (typeof line !== 'string' || !line.trim().match(/^[GM]/i)) {
                     this.error(`Invalid G-code format detected (basic check): "${line}"`);
                     return false;
                }
            }
        }
        const param = Array.isArray(gcodeCommand) ? gcodeCommand.join('\n') : gcodeCommand;
        const payload = { "print": { "sequence_id": "0", "command": "gcode_line", "param": param } };
        return this._publishCommand(payload);
    };

    sendCoolDown = async (nozThresh=50, bedThresh=45) => {
        const sent = await this.sendGcode(['M104 S0','M140 S0']);
        if (!sent) {
            this.error('Failed to send cooldown G-code commands.');
            return;
        }
        this.info(`Cooldown: waiting nozzle<${nozThresh}°, bed<${bedThresh}° …`);
        const sleep = ms=>new Promise(r=>setTimeout(r,ms));
        const start = Date.now();
        while (Date.now()-start < 120_000) { // 2 min safety cap
            // Use the state accessors which return null if data isn't ready
            const nozTemp = this.getNozzleTemperature();
            const bedTemp = this.getBedTemperature();
            if (nozTemp !== null && bedTemp !== null && nozTemp < nozThresh && bedTemp < bedThresh) break;
            await sleep(1000);
        }
        this.info(`Cooldown finished or timed out.`);
    };

    cleanPrintError = async (errorCodeToClear = 0, subtaskId = "0") => {
        this.info(`Attempting to clear print error code: ${errorCodeToClear} for subtask: ${subtaskId}`);
        const payload = { "print": {
                "command": "clean_print_error",
                "sequence_id": Date.now().toString().slice(-8), // Dynamic sequence ID
                "subtask_id": subtaskId.toString(),
                "print_error": parseInt(errorCodeToClear, 10)
        }};
        return this._publishCommand(payload);
    };

    stopPrint = async () => {
        this.info('Sending stop print command...');
        const payload = { "print": {
                "command": "stop",
                "param": "", // Include empty param as per docs/Orca
                "sequence_id": Date.now().toString().slice(-8) // Dynamic sequence ID
        }};
        return this._publishCommand(payload);
    };

    pausePrint = async () => {
         this.info('Sending pause print command...');
         const payload = { "print": { "command": "pause", "param": "", "sequence_id": Date.now().toString().slice(-8) }};
         return this._publishCommand(payload);
    };

    resumePrint = async () => {
         this.info('Sending resume print command...');
         const payload = { "print": { "command": "resume", "param": "", "sequence_id": Date.now().toString().slice(-8) }};
         return this._publishCommand(payload);
    };

    startPrint = async (filename, plateIdentifier = null, useAms = false, amsMapping = [0], skipObjects = null) => {
        const param = ""; // Force empty param based on successful tests
        if (plateIdentifier !== null && plateIdentifier !== undefined && plateIdentifier !== "") { this.info(`Plate identifier provided, but using required empty 'param'.`); }
        else { this.info(`Using required empty 'param'.`); }
        this.info(`Attempting print: File="${filename}", UseAMS=${useAms}, Param="${param}"`);

        const payload = {print:{
             command:'project_file', sequence_id:Date.now().toString().slice(-8), file: filename,
             url:`ftp:///${filename}`, param: param, bed_leveling:true, bed_type:'textured_plate',
             flow_cali:true, vibration_cali:true, layer_inspect:false, use_ams:useAms, ams_mapping:amsMapping,
             // Add other fields based on signing script / mqtt.md doc
             task_id: Date.now().toString().slice(-8), // Unique enough for local?
             subtask_name: path.basename(filename),
             project_id: "0", profile_id: "0", subtask_id: "0", // Defaults for local print
             timelapse: false, project_name: path.basename(filename)
        }};
        if (skipObjects?.length) payload.print.skip_objects = skipObjects;
        return this._publishCommand(payload);
    };

    // --- State Accessors (Arrow Functions) ---
    get_state = () => { const state = this._data?.print?.gcode_state; return state || GcodeState.UNKNOWN; }; // Return raw string state
    get_current_stage = () => getPrintStatusName(this._data?.print?.stg_cur);
    
    // Temperature accessors with robust parsing
    getNozzleTemperature = () => {
        const temp = this._data?.print?.nozzle_temper;
        return temp === undefined || temp === null ? null : parseFloat(temp) || null; // Handle NaN case
    };
    
    getBedTemperature = () => {
        const temp = this._data?.print?.bed_temper;
        return temp === undefined || temp === null ? null : parseFloat(temp) || null; // Handle NaN case
    };
    
    getNozzleTargetTemperature = () => {
        const temp = this._data?.print?.nozzle_target_temper;
        return temp === undefined || temp === null ? null : parseFloat(temp) || null; // Handle NaN case
    };
    
    getBedTargetTemperature = () => {
        const temp = this._data?.print?.bed_target_temper;
        return temp === undefined || temp === null ? null : parseFloat(temp) || null; // Handle NaN case
    };
    
    getPrintPercentage = () => { const p=this._data?.print?.mc_percent; const n=p==null?null:parseInt(p,10); return n===null||isNaN(n)?null:Math.max(0,Math.min(100,n));};
    getRemainingTime = () => { const t=this._data?.print?.mc_remaining_time; return t==null?null:parseInt(t,10);}; // In minutes
    getFilename = () => this._data?.print?.gcode_file || null;

    getLastFailureInfo = () => {
        const p = this._data?.print;
        if (p?.gcode_state === GcodeState.FAILED) { // Use GcodeState const
             const subtaskId = String(p.subtask_id ?? '0');
             const printError = parseInt(p.print_error ?? '0', 10);
             // Return info even if error code is 0 but state is FAILED
             this.log(`Captured failure info: state=FAILED, subtask_id=${subtaskId}, print_error=${printError}`, 'debug');
             return { subtask_id: subtaskId, print_error: printError };
        }
        return null; // Return null if not FAILED
    };

    // Added aliases for backward compatibility if index.js uses them
    getPrinterState = this.get_state;
    getCurrentStage = this.get_current_stage;
    is_connected = () => this._isConnected;
    dump = () => this._data;

} // End PrinterMQTTClient Class

module.exports = PrinterMQTTClient;