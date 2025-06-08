const mqtt = require('mqtt');
const EventEmitter = require('events');
const { GcodeState, PrintStatus, getPrintStatusName } = require('./data/states'); 
const path = require('path'); 

const DEFAULT_MQTT_PORT = 8883;
const MQTT_USERNAME = 'bblp';

class PrinterMQTTClient extends EventEmitter {
    constructor({
        hostname, accessCode, serialNumber, port = DEFAULT_MQTT_PORT, timeout = 60, // Seconds
        pushallOnConnect = true, debug = false
    }) {
        super();
        this._hostname = hostname;
        this._accessCode = accessCode;
        this._serialNumber = serialNumber;
        this._port = port;
        this._timeout = timeout * 1000; // Convert to ms
        this._pushallOnConnect = pushallOnConnect;
        this._debug = debug;

        this._mqttClient = null;
        this._isConnected = false;
        this._data = {}; 
        this._reportTopic = `device/${this._serialNumber}/report`;
        this._requestTopic = `device/${this._serialNumber}/request`;
        
        this._connectionAttemptPromise = null; // Promise for the current explicit connect() call
        this._connectTimeoutHandle = null;     // Timeout for the explicit connect() call
    }

    log = (...args) => { if (this._debug) { console.log(`[MQTT DEBUG ${this._serialNumber}]`, ...args); } };
    info = (...args) => { console.log(`[MQTT INFO  ${this._serialNumber}]`, ...args); };
    error = (...args) => {
        const errorMsgParts = args.map(arg => {
            if (arg instanceof Error) return arg.message;
            if (typeof arg === 'object' && arg !== null) return JSON.stringify(arg);
            return String(arg);
        });
        const fullErrorMsg = errorMsgParts.join(' ');
        console.error(`[MQTT ERROR ${this._serialNumber}]`, fullErrorMsg);
        this.emit('error', fullErrorMsg);
    };

    connect = async () => {
        if (this._isConnected) {
            this.info('Already connected.');
            return Promise.resolve();
        }
        if (this._connectionAttemptPromise) {
            this.info('Connection attempt already in progress. Returning existing promise.');
            return this._connectionAttemptPromise;
        }

        this.info(`Attempting MQTT connection to ${this._hostname}:${this._port}`);
        
        this._connectionAttemptPromise = new Promise((resolve, reject) => {
            // Clean up any old client and its listeners first
            if (this._mqttClient) {
                this.log('Cleaning up old MQTT client instance before new connection attempt.');
                this._removeListeners(); // Ensure listeners are removed from the old client
                this._mqttClient.end(true, () => {
                    this.log('Old MQTT client explicitly ended.');
                });
                this._mqttClient = null;
            }

            const options = {
                port: this._port, host: this._hostname, username: MQTT_USERNAME, password: this._accessCode,
                protocol: 'mqtts', connectTimeout: this._timeout, reconnectPeriod: 5000, // mqtt.js handles reconnects
                rejectUnauthorized: false, clientId: `node-mqtt-${this._serialNumber}-${Math.random().toString(16).slice(2, 10)}`
            };
            this.log('Creating new MQTT client with options:', options);
            this._mqttClient = mqtt.connect(options);
            this._setupListeners(); // Attach ALL persistent listeners, including for 'connect'

            // Specific handlers for THIS connect() call's promise
            const onInitialConnect = (connack) => { 
                if (this._connectTimeoutHandle) clearTimeout(this._connectTimeoutHandle);
                if (this._mqttClient) this._mqttClient.removeListener('error', onInitialError); 

                // The persistent _onMQTTConnect handles the actual success logic.
                // This 'once' handler is primarily to resolve or reject the promise of *this specific connect() call*.
                if (connack && connack.returnCode !== 0) {
                    const errMsg = `Initial MQTT connection failed in 'once' handler. Code: ${connack.returnCode}`;
                    this.error(errMsg);
                    this._cleanUpConnectionAttempt(true); 
                    reject(new Error(errMsg));
                } else if (!this._isConnected && (!connack || connack.returnCode === 0)) {
                    this.info('Initial connection reported by once("connect"), resolving promise.');
                    // _onMQTTConnect should set _isConnected true.
                    this._cleanUpConnectionAttempt(false); 
                    resolve();
                } else if (this._isConnected) { // _onMQTTConnect already ran and set state
                    this.info('Initial connection confirmed by _isConnected state, resolving promise.');
                    this._cleanUpConnectionAttempt(false);
                    resolve();
                } else {
                     // Should not happen if _onMQTTConnect is working
                    const errMsg = 'Initial connection in ambiguous state after once("connect").';
                    this.error(errMsg);
                    this._cleanUpConnectionAttempt(true);
                    reject(new Error(errMsg));
                }
            };
            const onInitialError = (err) => {
                if (this._connectTimeoutHandle) clearTimeout(this._connectTimeoutHandle);
                if (this._mqttClient) this._mqttClient.removeListener('connect', onInitialConnect); 
                this.error('Initial MQTT connection error in "once" handler:', err.message);
                this._cleanUpConnectionAttempt(true); 
                reject(err);
            };

            if (this._mqttClient) {
                this._mqttClient.once('connect', onInitialConnect); 
                this._mqttClient.once('error', onInitialError);     
            } else {
                // Should not happen if mqtt.connect is synchronous and doesn't throw
                const errMsg = "MQTT client was not created, cannot attach initial listeners.";
                this.error(errMsg);
                this._cleanUpConnectionAttempt(true);
                reject(new Error(errMsg));
                return; 
            }


            this._connectTimeoutHandle = setTimeout(() => {
                if (this._mqttClient) {
                    this._mqttClient.removeListener('connect', onInitialConnect);
                    this._mqttClient.removeListener('error', onInitialError);
                }
                const errMsg = 'Initial connection attempt timed out.';
                this.error(errMsg);
                this._cleanUpConnectionAttempt(true); 
                reject(new Error(errMsg));
            }, this._timeout);
        });
        return this._connectionAttemptPromise;
    };
    
    _cleanUpConnectionAttempt = (isFailure = false) => {
        if (this._connectTimeoutHandle) {
            clearTimeout(this._connectTimeoutHandle);
            this._connectTimeoutHandle = null;
        }
        this._connectionAttemptPromise = null; 
        
        if(isFailure && this._mqttClient && !this._isConnected) {
            this.log('Initial connection attempt failed, ensuring client is cleaned up if not connected.');
        }
    };

    disconnect = () => {
        this.info('Explicit disconnect called.');
        if (this._connectTimeoutHandle) { 
            clearTimeout(this._connectTimeoutHandle);
            this._connectTimeoutHandle = null;
        }
        // If there was a pending promise for a connect() call, reject it.
        if (this._connectionAttemptPromise) {
            this.log('Rejecting active connection attempt promise due to explicit disconnect.');
            this._connectionAttemptPromise = null;
        }


        if (this._mqttClient) {
            this.log('Calling _removeListeners and client.end() for explicit disconnect.');
            this._removeListeners(); // Remove our handlers
            this._mqttClient.end(true, () => { // true = force close
                this.log('MQTT client.end() callback received.');
            }); 
            this._mqttClient = null; // Destroy our reference
        }
        
        if (this._isConnected) {
            this._isConnected = false;
            this.emit('mqtt_close'); 
        } else {
            // If it wasn't connected, ensure state is consistent
            this._isConnected = false;
        }
    };

    _onMQTTConnect = (connack) => { 
        this.log('Persistent _onMQTTConnect handler triggered. Connack:', connack ? `Code: ${connack.returnCode}` : 'No connack object');
        
        // For Bambu, connack is expected and returnCode 0 means success.
        // If connack is missing, or code is non-zero, it's a failed (re)connect.
        if (!connack || connack.returnCode !== 0) {
            const rc = connack ? connack.returnCode : 'N/A';
            this.error(`MQTT (re)connection failed in persistent handler. Code: ${rc}.`);
            if (this._isConnected) { // If we thought we were connected
                this._isConnected = false; 
                this.emit('mqtt_close');   
            }
            return;
        }

        this.info('MQTT connected/reconnected successfully via persistent handler.');
        this._isConnected = true;
        
        this._subscribeReport();
        if (this._pushallOnConnect) {
            this.pushall();
        }
        this.emit('mqtt_connect');
    };

    _setupListeners = () => {
        if (!this._mqttClient) {
            this.error('Cannot setup listeners, MQTT client is null.');
            return;
        }
        this.log('Setting up persistent MQTT listeners...');
        // Remove all existing listeners from the client first to prevent duplicates if this is called multiple times on the same client instance
        this._mqttClient.removeAllListeners(); 
        
        this._mqttClient.on('connect', this._onMQTTConnect); 
        this._mqttClient.on('message', this._onMessage);
        this._mqttClient.on('error', this._onError);         
        this._mqttClient.on('close', this._onClose);         
        this._mqttClient.on('offline', this._onOffline);     
        this._mqttClient.on('reconnect', this._onReconnect); 
        this.log('Persistent MQTT listeners attached.');
    };

    _removeListeners = () => {
         if (!this._mqttClient) {
            this.log('Cannot remove listeners, MQTT client is null.');
            return;
        }
         this.log('Removing all MQTT listeners from client instance.');
         this._mqttClient.removeAllListeners();
    };

    _onMessage = (topic, buf) => { 
        if (topic !== this._reportTopic || !this._isConnected) return; 
        // this.log(`Received message on topic: ${topic}`); // Can be very verbose
        let messageJson;
        try {
            const messageString = buf.toString();
            if (this._debug && messageString.length > 0) { // Only log non-empty payloads in debug
                 this.log(`Raw Payload (${messageString.length} bytes): ${messageString.substring(0, 250) + (messageString.length > 250 ? '...' : '')}`);
            }
            messageJson = JSON.parse(messageString);

            let oldState = this._data?.print?.gcode_state;
            let oldErrorCode = this._data?.print?.print_error || "0";

            const merge=(t,s)=>{for(const k in s){ if(s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])){t[k]=t[k]||{}; merge(t[k],s[k]);} else {t[k]=s[k];}}};
            merge(this._data, messageJson);

            if (messageJson.print) {
                 const newState = this._data?.print?.gcode_state; 
                 const newErrorCode = this._data?.print?.print_error || "0";

                 if (newState !== undefined && newState !== oldState) {
                     this.emit('state_change', newState); 
                 }
                 if (newErrorCode !== "0" && newErrorCode !== oldErrorCode) {
                      this.error(`Printer reported NEW error code: ${newErrorCode}`);
                      this.emit('print_error', newErrorCode);
                 } else if (newErrorCode === "0" && oldErrorCode !== "0") {
                      this.info(`Printer error code cleared (was ${oldErrorCode}, now ${newErrorCode})`);
                 }
            }
            this.emit('update', this._data);

        } catch (err) {
            this.error('Failed to parse incoming message:', err.message);
            this.error(`Failed to parse payload. Original:`, buf.toString());
        }
    };

    _subscribeReport = () => { 
        if (!this._mqttClient || !this._isConnected) {
             return this.error('Cannot subscribe, MQTT not connected or client missing.');
        }
        this.log(`Subscribing to topic: ${this._reportTopic}`);
        this._mqttClient.subscribe(this._reportTopic, { qos: 0 }, (err, granted) => {
            if (err) {
                 this.error(`Failed to subscribe to "${this._reportTopic}":`, err.message);
            } else {
                 this.log('Subscribed OK to report topic.', granted && granted.length > 0 ? `QoS: ${granted[0].qos}` : '');
            }
        });
    };


    _onError = (err) => { 
        this.error('MQTT runtime error event:', err.message);
        if (this._isConnected) {
            this._isConnected = false;
            this.emit('mqtt_close'); 
        }
    };

    _onClose = () => { 
        this.info(`MQTT connection closed event. Was connected: ${this._isConnected}`);
        const wasConnected = this._isConnected;
        this._isConnected = false;
        
        // If an explicit connect() call was in progress and its promise not settled,
        // its timeout or specific 'error' handler for that attempt should manage rejecting its promise.
        // We ensure _connectionAttemptPromise is cleared so a new explicit connect() can be made.
        if (this._connectionAttemptPromise) {
            this.log('Clearing active connection attempt promise due to "close" event.');
            this._connectionAttemptPromise = null; 
        }
        if (this._connectTimeoutHandle) { 
            clearTimeout(this._connectTimeoutHandle);
            this._connectTimeoutHandle = null;
        }
        
        if (wasConnected) { // Only emit our mqtt_close if we thought we were connected
            this.emit('mqtt_close');
        }
    };

    _onOffline = () => {
        this.info('MQTT client went "offline". Library might attempt to reconnect.');
        if (this._isConnected) { 
             this._isConnected = false;
             this.emit('mqtt_close'); // Treat offline as a closed connection from our perspective
        }
    };
    
    _onReconnect = () => {
        this.info('MQTT client is attempting to "reconnect" (library event)...');
        // This event means the library is about to try.
        // Ensure our state reflects not connected if it isn't already.
        if (this._isConnected) {
            this._isConnected = false;
            // Don't emit mqtt_close here, as 'close' or 'error' should follow if reconnect fails,
            // or 'connect' if it succeeds.
        }
    };

    _publishCommand = async (payload) => { 
        if (!this._mqttClient || !this._isConnected) {
            this.error('Cannot publish command, MQTT client not connected or missing.');
            return false; 
        }
        const commandJson = JSON.stringify(payload);
        this.log(`Publishing command to ${this._requestTopic} (QoS 0): ${commandJson.substring(0, 120)}${commandJson.length > 120 ? '...' : ''}`);
        return new Promise((resolve) => {
             this._mqttClient.publish(this._requestTopic, commandJson, { qos: 0 }, (err) => {
                  if (err) {
                       this.error(`Publish command FAILED in callback:`, err.message);
                       resolve(false); 
                  } else {
                       this.log(`Publish command reported success by MQTT library (QoS 0).`);
                       resolve(true); 
                  }
             });
        });
    };

    pushall = async () => { 
        this.info(`Requesting full state update (pushall)...`);
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

    sendCoolDown = async (nozThresh = 50, bedThresh = 45) => { 
        const sent = await this.sendGcode(['M104 S0','M140 S0']);
        if (!sent) {
            this.error('Failed to send cooldown G-code commands.');
            return;
        }
        this.info(`Cooldown: waiting nozzle<${nozThresh}°, bed<${bedThresh}° …`);
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const start = Date.now();
        while (Date.now() - start < 120_000) { // 2 min safety cap
            const nozTemp = this.getNozzleTemperature();
            const bedTemp = this.getBedTemperature();
            if (nozTemp !== null && bedTemp !== null && nozTemp < nozThresh && bedTemp < bedThresh) break;
            await sleep(1000);
        }
        this.info(`Cooldown finished or timed out.`);
    };

    cleanPrintError = async (errorCodeToClear = 0, subtaskId = "0") => { 
        this.info(`Attempting to clear print error code: ${errorCodeToClear} for subtask: ${subtaskId}`);
        const payload = { 
            "print": {
                "command": "clean_print_error",
                "sequence_id": Date.now().toString().slice(-8), 
                "subtask_id": subtaskId.toString(),
                "print_error": parseInt(errorCodeToClear, 10)
            }
        };
        return this._publishCommand(payload);
    };

    stopPrint = async () => { 
        this.info('Sending stop print command...');
        const payload = { 
            "print": {
                "command": "stop",
                "param": "", 
                "sequence_id": Date.now().toString().slice(-8) 
            }
        };
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
        if (plateIdentifier !== null && plateIdentifier !== undefined && plateIdentifier !== "") { 
            this.info(`Plate identifier provided, but using required empty 'param'.`); 
        } else { 
            this.info(`Using required empty 'param'.`); 
        }
        this.info(`Attempting print: File="${filename}", UseAMS=${useAms}, Param="${param}"`);

        const payload = {
            print: {
                 command: 'project_file', 
                 sequence_id: Date.now().toString().slice(-8), 
                 file: filename,
                 url: `ftp:///${filename}`, 
                 param: param, 
                 bed_leveling: true, 
                 bed_type: 'textured_plate', // Default, can be parameterized if needed
                 flow_cali: true, 
                 vibration_cali: true, 
                 layer_inspect: false, 
                 use_ams: useAms, 
                 ams_mapping: amsMapping,
                 task_id: Date.now().toString().slice(-8), 
                 subtask_name: path.basename(filename),
                 project_id: "0",         // Defaults for local print
                 profile_id: "0",         // Defaults for local print
                 subtask_id: "0",         // Defaults for local print
                 timelapse: false, 
                 project_name: path.basename(filename)
            }
        };
        if (skipObjects && skipObjects.length > 0) {
            payload.print.skip_objects = skipObjects;
        }
        return this._publishCommand(payload);
    };

    // --- State Accessors ---
    get_state = () => { 
        const state = this._data?.print?.gcode_state; 
        return state || GcodeState.UNKNOWN; 
    };

    get_current_stage = () => {
        return getPrintStatusName(this._data?.print?.stg_cur);
    };

    getNozzleTemperature = () => { 
        const temp = this._data?.print?.nozzle_temper; 
        return temp === undefined || temp === null ? null : parseFloat(temp) || null; 
    };

    getBedTemperature = () => { 
        const temp = this._data?.print?.bed_temper; 
        return temp === undefined || temp === null ? null : parseFloat(temp) || null; 
    };

    getNozzleTargetTemperature = () => { 
        const temp = this._data?.print?.nozzle_target_temper; 
        return temp === undefined || temp === null ? null : parseFloat(temp) || null; 
    };

    getBedTargetTemperature = () => { 
        const temp = this._data?.print?.bed_target_temper; 
        return temp === undefined || temp === null ? null : parseFloat(temp) || null; 
    };

    getPrintPercentage = () => { 
        const p = this._data?.print?.mc_percent; 
        if (p == null) return null; 
        const n = parseInt(p, 10); 
        return isNaN(n) ? null : Math.max(0, Math.min(100, n));
    };

    getRemainingTime = () => { 
        const t = this._data?.print?.mc_remaining_time; 
        if (t == null) return null; 
        const n = parseInt(t, 10); 
        return isNaN(n) ? null : n;
    };

    getFilename = () => {
        return this._data?.print?.gcode_file || null;
    };

    getLastFailureInfo = () => { 
        const p = this._data?.print;
        if (p?.gcode_state === GcodeState.FAILED) { 
             const subtaskId = String(p.subtask_id ?? '0');
             const printError = parseInt(p.print_error ?? '0', 10);
             this.log(`Captured failure info: state=FAILED, subtask_id=${subtaskId}, print_error=${printError}`);
             return { subtask_id: subtaskId, print_error: printError };
        }
        return null; 
    };

    // Aliases for potential backward compatibility or different style preferences
    getPrinterState = this.get_state;
    getCurrentStage = this.get_current_stage;

    is_connected = () => this._isConnected;
    dump = () => JSON.parse(JSON.stringify(this._data)); // Return a deep copy
}

module.exports = PrinterMQTTClient;
