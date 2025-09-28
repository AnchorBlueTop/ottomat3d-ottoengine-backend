// packages/integration-adapter/types.js
// Core types for the printer integration adapter pattern

/**
 * Configuration required to authenticate with a printer
 */
class AuthConfig {
    constructor({ ip, accessCode, serial, port = null, ...extra } = {}) {
        this.ip = ip;
        this.accessCode = accessCode;
        this.serial = serial;
        this.port = port;
        
        // Store any additional vendor-specific config
        Object.assign(this, extra);
    }
}

/**
 * Basic printer information and capabilities
 */
class PrinterInfo {
    constructor({
        id, name, brand, model, type = 'FDM',
        ip_address = null, serial_number = null,
        firmware_version = null, capabilities = {},
        ...extra
    } = {}) {
        this.id = id;
        this.name = name;
        this.brand = brand;
        this.model = model;
        this.type = type;
        this.ip_address = ip_address;
        this.serial_number = serial_number;
        this.firmware_version = firmware_version;
        this.capabilities = capabilities;
        
        // Store any additional vendor-specific info
        Object.assign(this, extra);
    }
}

/**
 * Live printer status - normalized across all brands
 */
class PrinterStatus {
    constructor({
        status, current_stage = null, progress_percent = null,
        remaining_time_minutes = null, layer_progress = null,
        temperatures = {}, filament = {}, print_job = {},
        error_code = null, is_online = true,
        last_update = new Date().toISOString(),
        vendor_data = null,
        ...extra
    } = {}) {
        // Core status (IDLE, RUNNING, PAUSED, COMPLETED, ERROR, OFFLINE, UNKNOWN)
        this.status = status;
        this.current_stage = current_stage;
        this.progress_percent = progress_percent;
        this.remaining_time_minutes = remaining_time_minutes;
        this.layer_progress = layer_progress;
        
        // Temperature info
        this.temperatures = {
            nozzle: null,
            nozzle_target: null,
            bed: null,
            bed_target: null,
            chamber: null,
            ...temperatures
        };
        
        // Filament info
        this.filament = {
            material: 'N/A',
            color: 'N/A', 
            name: null,
            source: null, // 'AMS', 'external_spool', etc.
            ...filament
        };
        
        // Print job info
        this.print_job = {
            file: null,
            project_id: null,
            task_id: null,
            ...print_job
        };
        
        this.error_code = error_code;
        this.is_online = is_online;
        this.last_update = last_update;
        
        // Store raw vendor data for debugging/advanced use
        this.vendor_data = vendor_data;
        
        // Store any additional fields
        Object.assign(this, extra);
    }
}

/**
 * Job specification for starting prints
 */
class JobSpec {
    constructor({
        filename, plate_id = null, use_ams = false,
        ams_mapping = [0], skip_objects = null,
        bed_leveling = true, bed_type = 'textured_plate',
        flow_cali = true, vibration_cali = true,
        layer_inspect = false, timelapse = false,
        ...extra
    } = {}) {
        this.filename = filename;
        this.plate_id = plate_id;
        this.use_ams = use_ams;
        this.ams_mapping = ams_mapping;
        this.skip_objects = skip_objects;
        this.bed_leveling = bed_leveling;
        this.bed_type = bed_type;
        this.flow_cali = flow_cali;
        this.vibration_cali = vibration_cali;
        this.layer_inspect = layer_inspect;
        this.timelapse = timelapse;
        
        // Store any additional vendor-specific parameters
        Object.assign(this, extra);
    }
}

/**
 * Job events (status changes during printing)
 */
class JobEvent {
    constructor({
        event_type, timestamp = new Date().toISOString(),
        job_id = null, message = null, data = null
    } = {}) {
        this.event_type = event_type; // 'started', 'progress', 'paused', 'resumed', 'completed', 'failed'
        this.timestamp = timestamp;
        this.job_id = job_id;
        this.message = message;
        this.data = data;
    }
}

/**
 * Standardized error types for adapters
 */
class AdapterError extends Error {
    constructor(type, message, cause = null) {
        super(message);
        this.name = 'AdapterError';
        this.type = type; // 'AUTH', 'NETWORK', 'UNSUPPORTED', 'PRINTER_ERROR'
        this.cause = cause;
    }
    
    static AUTH(message, cause = null) {
        return new AdapterError('AUTH', message, cause);
    }
    
    static NETWORK(message, cause = null) {
        return new AdapterError('NETWORK', message, cause);
    }
    
    static UNSUPPORTED(message, cause = null) {
        return new AdapterError('UNSUPPORTED', message, cause);
    }
    
    static PRINTER_ERROR(message, cause = null) {
        return new AdapterError('PRINTER_ERROR', message, cause);
    }
}

/**
 * Printer capability matrix - what features each adapter supports
 */
class PrinterCapabilities {
    constructor({
        upload_method = 'ftp', // 'ftp', 'http', 'sd_card'
        start_print = true,
        pause_print = false,
        resume_print = false,
        cancel_print = false,
        send_gcode = false,
        live_status = 'stream', // 'stream', 'poll', 'none'
        job_history = false,
        file_management = false,
        camera_stream = false,
        ...extra
    } = {}) {
        this.upload_method = upload_method;
        this.start_print = start_print;
        this.pause_print = pause_print;
        this.resume_print = resume_print;
        this.cancel_print = cancel_print;
        this.send_gcode = send_gcode;
        this.live_status = live_status;
        this.job_history = job_history;
        this.file_management = file_management;
        this.camera_stream = camera_stream;
        
        // Store any additional capabilities
        Object.assign(this, extra);
    }
}

module.exports = {
    AuthConfig,
    PrinterInfo,
    PrinterStatus,
    JobSpec,
    JobEvent,
    AdapterError,
    PrinterCapabilities
};
