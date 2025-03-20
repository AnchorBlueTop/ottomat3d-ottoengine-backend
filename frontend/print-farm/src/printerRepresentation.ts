export default interface printerRepresentation {
    result: {
        state?: string,
        state_message?: string,
        hostname?: string,
        klipper_path?: string,
        python_path?: string,
        process_id?: string,
        user_id?: string,
        group_id?: string,
        log_file?: string,
        config_file?: string,
        software_version?: string,
        cpu_info?: string
    }
}