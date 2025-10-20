import { OttoejectDevice } from "./ottoejectRepresentation";
import { PrinterRepresentation } from "./printerRepresentation";

export default interface PrintJobRepresentation {
    id?: number;
    status?: string;
    status_message?: string;
    progress_percent?: number;
    priority?: number;
    auto_start?: number;
    print_item_id?: number;
    printer_id?: number;
    ottoeject_id?: number;
    assigned_rack_id?: number | null;
    assigned_store_slot?: number | null;
    assigned_grab_slot?: number | null;
    slot_assignment_reason?: string | null;
    effective_clearance_mm?: number | null;
    orchestration_status?: string;
    submitted_at?: string;
    started_at?: string | null;
    finished_printing_at?: string | null;
    stored_at?: string | null;
    completed_at?: string | null;
    created_at?: string;
    updated_at?: string;
    file_details_json?: string;
    measurement_details_json?: string;
    filament_details_json?: string;
    duration?: string;
}

export interface QueueRepresentation {
    fileName?: string;
    printJobId?: string;
    storageLocation?: number;
    ottoeject?: OttoejectDevice;
    printer?: PrinterRepresentation;
    ams?: any;
}