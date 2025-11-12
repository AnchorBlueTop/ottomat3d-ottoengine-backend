export interface PrinterRepresentation {
    id?: number;
    name?: string;
    brand?: string;
    model?: string;
    ip_address?: string;
    serial_number?: string;
    access_code?: string;
    type?: string;
    status?: string;
    current_stage?: string;
    bed_temperature?: number;
}

export interface PrinterRegistrationRepresentation {
    name?: string;
    brand?: string;
    model?: string;
    type?: string;
    ip_address?: string;
    access_code?: string;
    serial_number?: string;
}

export interface PrinterStatus {
    status?: string;
    current_stage?: string;
    remaining_time_minutes?: number;
}

export interface GCodePayload {
    gcode: string;
}

export interface StartPrintPayload {
    filename: string;
    printJobId?: string;
}

