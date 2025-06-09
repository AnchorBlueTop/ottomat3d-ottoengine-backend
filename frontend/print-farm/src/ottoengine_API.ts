// import PrinterRegistrationRepresentation from "./representations/printerRegistrationRepresentation";
import { OttoejectRegistration, OttoejectDevice, OttoejectStatus, OttoejectMacroPayload } from "./representations/ottoejectRepresentation";
import {
    PrinterRepresentation, 
    PrinterRegistrationRepresentation,
    PrinterStatus, 
    GCodePayload,
    StartPrintPayload
} from "./representations/printerRepresentation";


// const BASE_URL = import.meta.env.BASE_URL || 'http://localhost:3000'; 
// const BASE_URL = 'http://localhost:3000';
const BASE_URL = 'http://100.79.73.105:3000';

/////// OTTO PRINTER APIs ///////
export const registerPrinter = async (printerData: PrinterRegistrationRepresentation): Promise<PrinterRepresentation> => {
    const response = await fetch(`${BASE_URL}/api/printers`, {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
        body: JSON.stringify(printerData),
    });
    if (!response.ok) {
        throw new Error(`Error registering printer: ${response.statusText}`);
    } else {
        console.log('Printer reg success');
        console.log(response);
    }
    return response.json();
};

export const getAllPrinters = async (): Promise<PrinterRepresentation[]> => {
    const response = await fetch(`${BASE_URL}/api/printers`);
    if (!response.ok) {
      throw new Error(`Error fetching printers: ${response.statusText}`);
    }
    return response.json();
};
  
export const getPrinterById = async (id: number): Promise<PrinterRepresentation> => {
    const response = await fetch(`${BASE_URL}/api/printers/${id}`);
    if (!response.ok) {
      throw new Error(`Error fetching printer with ID ${id}: ${response.statusText}`);
    }
    return response.json();
};

export const getPrinterStatusById = async (id: number): Promise<PrinterStatus> => {
    const response = await fetch(`${BASE_URL}/api/printers/${id}/status`);
    if (!response.ok) {
      throw new Error(`Error fetching printer status for ID ${id}: ${response.statusText}`);
    }
    return response.json();
};
  
export const sendGCodeToPrinter = async (id: number, gcodePayload: GCodePayload): Promise<any> => {
    const response = await fetch(`${BASE_URL}/api/printers/${id}/send-gcode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gcodePayload),
    });
    if (!response.ok) {
      throw new Error(`Error sending G-Code to printer ID ${id}: ${response.statusText}`);
    }
    return response.json();
};
  
export const startPrint = async (id: number, startPrintPayload: StartPrintPayload): Promise<any> => {
    const response = await fetch(`${BASE_URL}/api/printers/${id}/start-print`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(startPrintPayload),
    });
    if (!response.ok) {
      throw new Error(`Error starting print on printer ID ${id}: ${response.statusText}`);
    }
    return response.json();
};
  
  export const updatePrinterDetails = async (id: number, updateData: PrinterRepresentation): Promise<any> => {
    const response = await fetch(`${BASE_URL}/api/printers/${id}/`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });
    if (!response.ok) {
      throw new Error(`Error updating printer details for ID ${id}: ${response.statusText}`);
    }
    return response.json();
};

export const deletePrinter = async (id: number): Promise<void> => {
    const response = await fetch(`${BASE_URL}/api/printers/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Error deleting printer with ID ${id}: ${response.statusText}`);
    }
};

export const uploadFile = async (file: File, id: number) => {
const formdata = new FormData();
formdata.append("file", file, file.name);

  const response = await fetch(`${BASE_URL}/api/printers/${id}/upload`, {
    method: "POST",
    body: formdata,
  });
  if (!response.ok) {
    throw new Error(`Error uploading file: ${response.statusText}`);
  }
  return response.json();
}

/////// OTTO EJECT APIs ///////

export const registerOttoeject = async (ottoejectData: OttoejectRegistration): Promise<OttoejectDevice> => {
    const response = await fetch(`${BASE_URL}/api/ottoeject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ottoejectData),
    });
    if (!response.ok) {
      throw new Error(`Error registering Ottoeject device: ${response.statusText}`);
    }
    return response.json();
};
  
export const getAllOttoejectDevices = async (): Promise<OttoejectDevice[]> => {
    const response = await fetch(`${BASE_URL}/api/ottoeject`);
    if (!response.ok) {
      throw new Error(`Error fetching Ottoeject devices: ${response.statusText}`);
    }
    return response.json();
};
  
export const getOttoejectById = async (id: number): Promise<OttoejectDevice> => {
    const response = await fetch(`${BASE_URL}/api/ottoeject/${id}`);
    if (!response.ok) {
      throw new Error(`Error fetching Ottoeject device with ID ${id}: ${response.statusText}`);
    }
    return response.json();
};
  
export const getOttoejectStatusById = async (id: number): Promise<OttoejectStatus> => {
    const response = await fetch(`${BASE_URL}/api/ottoeject/${id}/status`);
    if (!response.ok) {
      throw new Error(`Error fetching Ottoeject status for ID ${id}: ${response.statusText}`);
    }
    return response.json();
};
  
export const deleteOttoeject = async (id: number): Promise<void> => {
    const response = await fetch(`${BASE_URL}/api/ottoeject/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Error deleting Ottoeject device with ID ${id}: ${response.statusText}`);
    }
};
  
export const sendOttoejectMacro = async (id: number, macroPayload: OttoejectMacroPayload): Promise<any> => {
    const response = await fetch(`${BASE_URL}/api/ottoeject/${id}/macros`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(macroPayload),
    });
    if (!response.ok) {
      throw new Error(`Error sending macro to Ottoeject device ID ${id}: ${response.statusText}`);
    }
    return response.json();
};