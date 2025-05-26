export interface PrintJob {
    id: string;
    name: string;
    description?: string;
    lastModified: Date;
}

export interface Shelf {
    id: string;
    name: string;
    printJob: PrintJob[];
    lastModified: Date;
}

export interface Rack {
    id: string;
    name: string;
    shelves: Shelf[];
    lastModified: Date;
}

export interface OttoRacks {
    racks: Rack[];
}