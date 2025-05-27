// src/bambulabs-api/index.js

const EventEmitter = require('events');
const PrinterMQTTClient = require('./mqtt-client');
const PrinterFTPClient = require('./ftp-client');
// Import data structures/enums if needed later
const { GcodeState, PrintStatus } = require('./data/states');

class Printer extends EventEmitter {
    /**
     * Creates an instance of the main Printer API client.
     * @param {object} options Configuration options
     * @param {string} options.ip Printer IP address or hostname
     * @param {string} options.accessCode Printer access code
     * @param {string} options.serial Printer serial number
     * @param {boolean} [options.debug=false] Enable debug logging for MQTT and FTP clients
     */
    constructor({ ip, accessCode, serial, debug = false }) {
        super();
        if (!ip || !accessCode || !serial) {
            throw new Error("Missing required options: ip, accessCode, and serial are required.");
        }

        this.ipAddress = ip;
        this.accessCode = accessCode;
        this.serial = serial;
        this.debug = debug;

        // Instantiate clients
        this.mqttClient = new PrinterMQTTClient({
            hostname: this.ipAddress,
            accessCode: this.accessCode,
            serialNumber: this.serial,
            debug: this.debug
        });

        this.ftpClient = new PrinterFTPClient({
            hostname: this.ipAddress,
            accessCode: this.accessCode,
            debug: this.debug
        });

        // --- Proxy events from underlying clients ---
        // This allows users of the Printer class to listen for events directly
        this.mqttClient.on('connect', () => this.emit('mqtt_connect'));
        this.mqttClient.on('close', () => this.emit('mqtt_close'));
        this.mqttClient.on('error', (err) => this.emit('mqtt_error', err));
        this.mqttClient.on('state_change', (state) => this.emit('state_change', state));
        this.mqttClient.on('print_error', (code) => this.emit('print_error', code));
        this.mqttClient.on('update', (data) => this.emit('update', data)); // Emit full state updates

        this.ftpClient.on('connect', () => this.emit('ftp_connect'));
        this.ftpClient.on('close', () => this.emit('ftp_close'));
        this.ftpClient.on('error', (err) => this.emit('ftp_error', err));
        this.ftpClient.on('upload_progress', (info) => this.emit('upload_progress', info));
    }

    /**
     * Connects the MQTT client. FTP connects on demand.
     * @returns {Promise<void>} Resolves when MQTT connection is established.
     */
    async connect() {
        await this.mqttClient.connect();
    }

    /**
     * Disconnects the MQTT client. FTP connections are managed per operation.
     */
    disconnect() {
        this.mqttClient.disconnect();
        // FTP client closes automatically after each operation
    }

    // --- MQTT Passthrough Methods ---

    /** Get GcodeState (IDLE, RUNNING, etc.) */
    get_state() { return this.mqttClient.getPrinterState(); }
    /** Get detailed PrintStatus (e.g., AUTO_BED_LEVELING) */
    get_current_stage() { return this.mqttClient.getCurrentStage(); }
    /** Get current bed temp */
    get_bed_temperature() { return this.mqttClient.getBedTemperature(); }
    getBedTemperature() { return this.mqttClient.getBedTemperature(); } // Add camelCase alias
    /** Get target bed temp */
    get_bed_target_temperature() { return this.mqttClient.getBedTargetTemperature(); }
    getBedTargetTemperature() { return this.mqttClient.getBedTargetTemperature(); } // Add camelCase alias
    /** Get current nozzle temp */
    get_nozzle_temperature() { return this.mqttClient.getNozzleTemperature(); }
    getNozzleTemperature() { return this.mqttClient.getNozzleTemperature(); } // Add camelCase alias
    /** Get target nozzle temp */
    get_nozzle_target_temperature() { return this.mqttClient.getNozzleTargetTemperature(); }
    getNozzleTargetTemperature() { return this.mqttClient.getNozzleTargetTemperature(); } // Add camelCase alias
    /** Get print progress percentage */
    get_percentage() { return this.mqttClient.getPrintPercentage(); }
    /** Get remaining print time in minutes */
    get_time() { return this.mqttClient.getRemainingTime(); }
    /** Get filename being printed */
    get_filename() { return this.mqttClient.getFilename(); }

    // Inside Printer class

    /** Attempts to clear printer errors via MQTT */
    async cleanPrintError(errorCode = 0, subtaskId = "0") { // <<< ADD THIS METHOD
        if (this.mqttClient && typeof this.mqttClient.cleanPrintError === 'function') {
            return this.mqttClient.cleanPrintError(errorCode, subtaskId);
        } else {
             console.error("Error: cleanPrintError method not available on mqttClient.");
             return false;
        }
   } 

    /** Stop the current print */
    async stop_print() { // Use snake_case to match Python API style if preferred
        if (this.mqttClient && typeof this.mqttClient.stopPrint === 'function') {
            return this.mqttClient.stopPrint();
        } else {
             console.error("Error: stopPrint method not available on mqttClient.");
             return false;
        }
   }

    /** Start print */
    async start_print(filename, plateId, useAms = true, map = [0], skip = null) {
        return this.mqttClient.startPrint(filename, plateId, useAms, map, skip);
    }

    /** Request full status update */
    async pushall() { return this.mqttClient.pushall(); }

    /** Pause the current print */
    async pause_print() { // Use snake_case for consistency if desired
         if (this.mqttClient && typeof this.mqttClient.pausePrint === 'function') {
             return this.mqttClient.pausePrint();
         } else {
              console.error("Error: pausePrint method not available on mqttClient.");
              return false;
         }
    }

    /** Resume the current print */
    async resume_print() { // Use snake_case for consistency if desired
        if (this.mqttClient && typeof this.mqttClient.resumePrint === 'function') {
            return this.mqttClient.resumePrint();
        } else {
             console.error("Error: resumePrint method not available on mqttClient.");
             return false;
        }
   }

    /** Send G-code command(s) */
    async gcode(command, check = false) { return this.mqttClient.sendGcode(command, check); }

    // --- TODO: Add passthrough for other MQTT methods ---
    // stop_print, pause_print, resume_print, set temps, set fans, light control etc.
    // Add them here by calling the corresponding method on this.mqttClient

    // --- FTP Passthrough Methods ---

    /** Upload a local file */
    async upload_file(localPath, remoteFilename) {
        return this.ftpClient.uploadFile(localPath, remoteFilename);
    }
    /** Delete a remote file */
    async delete_file(remoteFilename) {
        return this.ftpClient.deleteFile(remoteFilename);
    }
    /** List remote files */
    async list_files(remotePath = '/') {
        return this.ftpClient.listFiles(remotePath);
    }

    // --- Other Methods ---

    /** Get all cached MQTT data */
    mqtt_dump() { return this.mqttClient._data; } // Access internal data for debugging

    /** Check if MQTT client is connected */
    is_connected() { return this.mqttClient._isConnected; }

}

// Export the main class and potentially enums/types for convenience
module.exports = {
    Printer,
    GcodeState,
    PrintStatus
    // Export other enums/types from ./data/* as needed
};