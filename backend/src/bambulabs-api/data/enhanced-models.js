// src/bambulabs-api/data/enhanced-models.js
// Port of Bambu Connect's comprehensive data models to Node.js

class BaseModel {
    constructor(data = {}) {
        // Only assign properties that are defined in the class
        const classFields = this._getClassFields();
        for (const [key, value] of Object.entries(data)) {
            if (classFields.has(key)) {
                this[key] = value;
            }
        }
        // Set defaults for missing fields
        this._setDefaults();
    }

    _getClassFields() {
        // Override in subclasses to define valid fields
        return new Set();
    }

    _setDefaults() {
        // Override in subclasses to set defaults
    }
}

class Upload extends BaseModel {
    constructor(data = {}) {
        super(data);
    }

    _getClassFields() {
        return new Set([
            'file_size', 'finish_size', 'status', 'progress', 'message',
            'oss_url', 'sequence_id', 'speed', 'task_id', 'time_remaining', 'trouble_id'
        ]);
    }

    _setDefaults() {
        this.file_size = this.file_size ?? null;
        this.finish_size = this.finish_size ?? null;
        this.status = this.status ?? null;
        this.progress = this.progress ?? null;
        this.message = this.message ?? null;
        this.oss_url = this.oss_url ?? null;
        this.sequence_id = this.sequence_id ?? null;
        this.speed = this.speed ?? null;
        this.task_id = this.task_id ?? null;
        this.time_remaining = this.time_remaining ?? null;
        this.trouble_id = this.trouble_id ?? null;
    }
}

class VTTray extends BaseModel {
    constructor(data = {}) {
        super(data);
    }

    _getClassFields() {
        return new Set([
            'id', 'tag_uid', 'tray_id_name', 'tray_info_idx', 'tray_type',
            'tray_sub_brands', 'tray_color', 'tray_weight', 'tray_diameter',
            'tray_temp', 'tray_time', 'bed_temp_type', 'bed_temp',
            'nozzle_temp_max', 'nozzle_temp_min', 'xcam_info', 'tray_uuid',
            'remain', 'k', 'n', 'cali_idx', 'cols', 'ctype', 'drying_temp', 'drying_time'
        ]);
    }

    _setDefaults() {
        this.id = this.id ?? null;
        this.tag_uid = this.tag_uid ?? null;
        this.tray_id_name = this.tray_id_name ?? null;
        this.tray_info_idx = this.tray_info_idx ?? null;
        this.tray_type = this.tray_type ?? null;
        this.tray_sub_brands = this.tray_sub_brands ?? null;
        this.tray_color = this.tray_color ?? null;
        this.tray_weight = this.tray_weight ?? null;
        this.tray_diameter = this.tray_diameter ?? null;
        this.tray_temp = this.tray_temp ?? null;
        this.tray_time = this.tray_time ?? null;
        this.bed_temp_type = this.bed_temp_type ?? null;
        this.bed_temp = this.bed_temp ?? null;
        this.nozzle_temp_max = this.nozzle_temp_max ?? null;
        this.nozzle_temp_min = this.nozzle_temp_min ?? null;
        this.xcam_info = this.xcam_info ?? null;
        this.tray_uuid = this.tray_uuid ?? null;
        this.remain = this.remain ?? null;
        this.k = this.k ?? null;
        this.n = this.n ?? null;
        this.cali_idx = this.cali_idx ?? null;
        this.cols = this.cols ?? null;
        this.ctype = this.ctype ?? null;
        this.drying_temp = this.drying_temp ?? null;
        this.drying_time = this.drying_time ?? null;
    }
}

class AMSEntry extends BaseModel {
    constructor(data = {}) {
        super(data);
    }

    _getClassFields() {
        return new Set(['humidity', 'id', 'temp', 'tray']);
    }

    _setDefaults() {
        this.humidity = this.humidity ?? null;
        this.id = this.id ?? null;
        this.temp = this.temp ?? null;
        this.tray = this.tray ? this.tray.map(t => new VTTray(t)) : null;
    }
}

class AMS extends BaseModel {
    constructor(data = {}) {
        super(data);
    }

    _getClassFields() {
        return new Set([
            'ams', 'ams_exist_bits', 'ams_exist_bits_raw', 'tray_exist_bits',
            'tray_is_bbl_bits', 'tray_tar', 'tray_now', 'tray_pre',
            'tray_read_done_bits', 'tray_reading_bits', 'version',
            'insert_flag', 'power_on_flag'
        ]);
    }

    _setDefaults() {
        this.ams = this.ams ? this.ams.map(a => new AMSEntry(a)) : null;
        this.ams_exist_bits = this.ams_exist_bits ?? null;
        this.ams_exist_bits_raw = this.ams_exist_bits_raw ?? null;
        this.tray_exist_bits = this.tray_exist_bits ?? null;
        this.tray_is_bbl_bits = this.tray_is_bbl_bits ?? null;
        this.tray_tar = this.tray_tar ?? null;
        this.tray_now = this.tray_now ?? null;
        this.tray_pre = this.tray_pre ?? null;
        this.tray_read_done_bits = this.tray_read_done_bits ?? null;
        this.tray_reading_bits = this.tray_reading_bits ?? null;
        this.version = this.version ?? null;
        this.insert_flag = this.insert_flag ?? null;
        this.power_on_flag = this.power_on_flag ?? null;
    }
}

class PrinterStatus extends BaseModel {
    constructor(data = {}) {
        super(data);
    }

    _getClassFields() {
        return new Set([
            // Core printing status
            'gcode_state', 'mc_print_stage', 'mc_percent', 'mc_remaining_time',
            'stg_cur', 'layer_num', 'total_layer_num',
            
            // Temperatures  
            'nozzle_temper', 'nozzle_target_temper', 'bed_temper', 'bed_target_temper',
            'chamber_temper',
            
            // Fans
            'heatbreak_fan_speed', 'cooling_fan_speed', 'big_fan1_speed', 'big_fan2_speed',
            'fan_gear',
            
            // AMS and filament
            'ams_status', 'ams_rfid_status', 'ams', 'vt_tray',
            
            // Print job info
            'project_id', 'profile_id', 'task_id', 'subtask_id', 'subtask_name',
            'gcode_file', 'print_type',
            
            // System status
            'lifecycle', 'wifi_signal', 'hw_switch_state', 'home_flag', 'print_error',
            'spd_mag', 'spd_lvl', 'sdcard', 'force_upgrade',
            
            // Queue info
            'queue_number', 'queue_total', 'queue_est', 'queue_sts',
            
            // Upload status
            'upload',
            
            // Advanced fields
            'gcode_file_prepare_percent', 'mc_print_line_number', 'mc_print_sub_stage',
            'mess_production_state', 's_obj', 'stg', 'hms',
            
            // Command info
            'command', 'msg', 'sequence_id'
        ]);
    }

    _setDefaults() {
        // Core printing status
        this.gcode_state = this.gcode_state ?? null;
        this.mc_print_stage = this.mc_print_stage ?? null;
        this.mc_percent = this.mc_percent ?? null;
        this.mc_remaining_time = this.mc_remaining_time ?? null;
        this.stg_cur = this.stg_cur ?? null;
        this.layer_num = this.layer_num ?? null;
        this.total_layer_num = this.total_layer_num ?? null;

        // Temperatures
        this.nozzle_temper = this.nozzle_temper ?? null;
        this.nozzle_target_temper = this.nozzle_target_temper ?? null;
        this.bed_temper = this.bed_temper ?? null;
        this.bed_target_temper = this.bed_target_temper ?? null;
        this.chamber_temper = this.chamber_temper ?? null;

        // Fans
        this.heatbreak_fan_speed = this.heatbreak_fan_speed ?? null;
        this.cooling_fan_speed = this.cooling_fan_speed ?? null;
        this.big_fan1_speed = this.big_fan1_speed ?? null;
        this.big_fan2_speed = this.big_fan2_speed ?? null;
        this.fan_gear = this.fan_gear ?? null;

        // AMS and filament - create objects if data exists
        this.ams_status = this.ams_status ?? null;
        this.ams_rfid_status = this.ams_rfid_status ?? null;
        this.ams = this.ams ? new AMS(this.ams) : null;
        this.vt_tray = this.vt_tray ? new VTTray(this.vt_tray) : null;

        // Print job info
        this.project_id = this.project_id ?? null;
        this.profile_id = this.profile_id ?? null;
        this.task_id = this.task_id ?? null;
        this.subtask_id = this.subtask_id ?? null;
        this.subtask_name = this.subtask_name ?? null;
        this.gcode_file = this.gcode_file ?? null;
        this.print_type = this.print_type ?? null;

        // System status
        this.lifecycle = this.lifecycle ?? null;
        this.wifi_signal = this.wifi_signal ?? null;
        this.hw_switch_state = this.hw_switch_state ?? null;
        this.home_flag = this.home_flag ?? null;
        this.print_error = this.print_error ?? null;
        this.spd_mag = this.spd_mag ?? null;
        this.spd_lvl = this.spd_lvl ?? null;
        this.sdcard = this.sdcard ?? false;
        this.force_upgrade = this.force_upgrade ?? false;

        // Queue info  
        this.queue_number = this.queue_number ?? null;
        this.queue_total = this.queue_total ?? null;
        this.queue_est = this.queue_est ?? null;
        this.queue_sts = this.queue_sts ?? null;

        // Upload status
        this.upload = this.upload ? new Upload(this.upload) : null;

        // Advanced fields
        this.gcode_file_prepare_percent = this.gcode_file_prepare_percent ?? null;
        this.mc_print_line_number = this.mc_print_line_number ?? null;
        this.mc_print_sub_stage = this.mc_print_sub_stage ?? null;
        this.mess_production_state = this.mess_production_state ?? null;
        this.s_obj = this.s_obj ?? [];
        this.stg = this.stg ?? [];
        this.hms = this.hms ?? [];

        // Command info
        this.command = this.command ?? null;
        this.msg = this.msg ?? null;
        this.sequence_id = this.sequence_id ?? null;
    }

    /**
     * Get a normalized status for your API responses
     * Maps internal printer status to your expected status format
     */
    getNormalizedStatus() {
        // Map gcode_state to your existing status format
        const statusMap = {
            'IDLE': 'IDLE',
            'PREPARE': 'PREPARING', 
            'RUNNING': 'RUNNING',
            'PAUSE': 'PAUSED',
            'FINISH': 'COMPLETED',
            'FAILED': 'ERROR'
        };

        return {
            status: statusMap[this.gcode_state] || 'UNKNOWN',
            current_stage: this.getDetailedStage(),
            progress_percent: this.mc_percent,
            remaining_time_minutes: this.mc_remaining_time,
            layer_progress: this.total_layer_num ? `${this.layer_num}/${this.total_layer_num}` : null,
            temperatures: {
                nozzle: this.nozzle_temper,
                nozzle_target: this.nozzle_target_temper,
                bed: this.bed_temper,
                bed_target: this.bed_target_temper,
                chamber: this.chamber_temper
            },
            filament: this.getCurrentFilament(),
            print_job: {
                file: this.gcode_file,
                project_id: this.project_id,
                task_id: this.task_id
            }
        };
    }

    /**
     * Get detailed current printing stage
     */
    getDetailedStage() {
        const { PrintStatus, getPrintStatusName } = require('./states');
        return getPrintStatusName(this.stg_cur);
    }

    /**
     * Get current filament information
     */
    getCurrentFilament() {
        // Priority: AMS -> VT Tray -> null
        if (this.ams && this.ams.tray_now !== null) {
            const currentAMS = this.ams.ams?.[0];
            const currentTray = currentAMS?.tray?.[parseInt(this.ams.tray_now)];
            if (currentTray) {
                return {
                    material: currentTray.tray_type,
                    color: currentTray.tray_color,
                    name: currentTray.tray_id_name,
                    source: 'AMS'
                };
            }
        }

        if (this.vt_tray && this.vt_tray.tray_type) {
            return {
                material: this.vt_tray.tray_type,
                color: this.vt_tray.tray_color,
                name: this.vt_tray.tray_id_name,
                source: 'external_spool'
            };
        }

        return {
            material: 'N/A',
            color: 'N/A',
            name: null,
            source: null
        };
    }
}

module.exports = {
    BaseModel,
    Upload,
    VTTray,
    AMSEntry,
    AMS,
    PrinterStatus
};
