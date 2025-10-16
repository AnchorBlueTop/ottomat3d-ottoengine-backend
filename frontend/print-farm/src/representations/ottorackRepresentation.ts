export interface PrintJob {
    id?: string | number;
    fileName?: string;
    status?: string;
    lastModified?: Date;
}

export interface Shelf {
    id?: string | number;
    printJob?: PrintJob;
    occupied?: boolean;
    type?: string;
    lastModified?: Date;
}

export interface OttoRack {
    id?: string | number;
    name: string;
    shelves?: Shelf[];
    shelfCount?: number;
    shelfSpacingMm?: any;
    bedSize?: string;
    lastModified?: Date;
}

export interface OttoRackRegistration {
    name: string;
    number_of_shelves?: number;
    shelfSpacingMm?: any;
    bedSize?: string;
}