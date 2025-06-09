import { PrinterRepresentation } from "./printerRepresentation";

export default interface PrintJobRepresentation {
    id?: string,
    name?: string,
    printer?: string,
    duration?: string,
    filament?: string,
    filament_weight?: string,
    filament_length?: string,
    status?: string,
}

export interface QueueRepresentation {
    fileName?: string;
    printJobId?: string;
    storageLocation?: number;
    printer?: PrinterRepresentation;
}