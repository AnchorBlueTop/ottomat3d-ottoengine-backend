export interface PrintJob {
    id?: string;
    name?: string;
    description?: string;
    lastModified?: Date;
}

export interface Shelf {
    id?: string;
    printJob?: PrintJob[]; // start with just PrintJob ID
    occupied?: boolean;
    shelfType?: string; // PrintJob - EmptyPlate - Unoccupied
    lastModified?: Date;
}

export interface OttoRack {
    id?: string;
    name: string;
    shelves?: Shelf[];
    lastModified?: Date;
}

// export interface OttoRacks {
//     racks?: Rack[];
// }

export interface OttoRackRegistration {
    id?: string;
    name?: string; 
    shelves?: Shelf[];
    shelf_spacing?: number;
    bed_size?: string;
}