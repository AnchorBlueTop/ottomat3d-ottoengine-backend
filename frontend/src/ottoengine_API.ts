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
const BASE_URL = 'http://127.0.0.1:3000';
// const BASE_URL = 'http://100.79.73.105:3000';

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

// Test printer connection without persisting (POST /api/printers/connect)
export const testPrinterConnection = async (
  payload: Partial<PrinterRegistrationRepresentation & PrinterRepresentation>
): Promise<{ status?: string; message?: string }> => {
  const response = await fetch(`${BASE_URL}/api/printers/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      brand: payload.brand,
      ip_address: payload.ip_address,
      access_code: payload.access_code,
      serial_number: payload.serial_number,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Back-end returns shape {error, message}
    const message = (data && (data.message || data.error)) || response.statusText;
    throw new Error(message);
  }
  return data;
};

//  TODO: Confirm Pause, resume, and stop printer API endpoints
export const pausePrinter = async (id: number): Promise<any> => {
  const response = await fetch(`${BASE_URL}/api/printers/${id}/pause`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Error pausing printer ID ${id}: ${response.statusText}`);
  }
  return response.json();
};

export const resumePrinter = async (id: number): Promise<any> => {
  const response = await fetch(`${BASE_URL}/api/printers/${id}/resume`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Error resuming printer ID ${id}: ${response.statusText}`);
  }
  return response.json();
};


export const cancelPrintJob = async (id: number): Promise<void> => {
  const response = await fetch(`${BASE_URL}/api/print-jobs/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Error canceling print job ID ${id}: ${response.statusText}`);
  }
};

export const uploadFile = async (file: File, fileId: number) => {
  const formdata = new FormData();
  formdata.append("file", file, file.name);
  formdata.append("id", fileId.toString());
  
  console.log("Uploading file with FormData:", [...formdata.entries()]);

  const response = await fetch(`${BASE_URL}/api/print-jobs/upload`, {
    method: "POST", 
    body: formdata,
  });
  console.log(response);
  if (!response.ok) {
    throw new Error(`Error uploading file: ${response.statusText}`);
  }
  return response.json();
};

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

// Test ottoeject connection using IP address (ad-hoc connection test)
export const testOttoejectConnection = async (
  payload: Partial<OttoejectRegistration & OttoejectDevice>
): Promise<{ connected?: boolean; message?: string }> => {
  const response = await fetch(`${BASE_URL}/api/ottoeject/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    throw new Error(`Connection test failed: ${response.statusText}`);
  }
  
  return response.json();
};

/////// PRINT JOB APIs ///////

export const createPrintJob = async (printJobData: any): Promise<any> => {
  const response = await fetch(`${BASE_URL}/api/print-jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(printJobData),
  });
  if (!response.ok) {
    throw new Error(`Error creating print job: ${response.statusText}`);
  }
  return response.json();
};

export const getAllPrintJobs = async (): Promise<any[]> => {
  const response = await fetch(`${BASE_URL}/api/print-jobs`);
  if (!response.ok) {
    throw new Error(`Error fetching print jobs: ${response.statusText}`);
  }
  return response.json();
};

export const getPrintJobById = async (id: string): Promise<any> => {
  const response = await fetch(`${BASE_URL}/api/print-jobs/${id}`);
  if (!response.ok) {
    throw new Error(`Error fetching print job with ID ${id}: ${response.statusText}`);
  }
  return response.json();
};

export const updatePrintJob = async (id: number, updateData: any): Promise<any> => {
  const response = await fetch(`${BASE_URL}/api/print-jobs/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updateData),
  });
  if (!response.ok) {
    throw new Error(`Error updating print job with ID ${id}: ${response.statusText}`);
  }
  return response.json();
};

export const deletePrintJob = async (id: number): Promise<void> => {
  const response = await fetch(`${BASE_URL}/api/print-jobs/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Error deleting print job with ID ${id}: ${response.statusText}`);
  }
};

export const startPrintJob = async (id: number | string): Promise<any> => {
  const response = await fetch(`${BASE_URL}/api/print-jobs/${id}/start`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Error starting print job with ID ${id}: ${response.statusText}`);
  }
  return response.json();
};

/////// OTTO RACK APIs ///////

// Create a new Ottorack (supports initial shelves assignment)
export const createOttorack = async (ottorackData: any): Promise<any> => {
  const response = await fetch(`${BASE_URL}/api/ottoracks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(ottorackData),
  });
  if (!response.ok) {
    throw new Error(`Error creating Ottorack: ${response.statusText}`);
  }
  return response.json();
};

// Update Ottorack metadata (name, shelf_spacing_mm, bed_size)
export const updateOttorackMeta = async (id: number, updateData: { name?: string; shelf_spacing_mm?: number; bed_size?: string; }): Promise<any> => {
  const response = await fetch(`${BASE_URL}/api/ottoracks/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updateData),
  });
  if (!response.ok) {
    throw new Error(`Error updating Ottorack ${id}: ${response.statusText}`);
  }
  return response.json();
};

// Get all Ottoracks
export const getAllOttoracks = async (): Promise<any[]> => {
  const response = await fetch(`${BASE_URL}/api/ottoracks`);
  if (!response.ok) {
    throw new Error(`Error fetching Ottoracks: ${response.statusText}`);
  }
  return response.json();
};

// Get Ottorack details by ID
export const getOttorackById = async (id: number): Promise<any> => {
  const response = await fetch(`${BASE_URL}/api/ottoracks/${id}`);
  if (!response.ok) {
    throw new Error(`Error fetching Ottorack with ID ${id}: ${response.statusText}`);
  }
  return response.json();
};

// Update a specific shelf in an Ottorack
export const updateOttorackShelf = async (rackId: number, shelfId: number, shelfData: any): Promise<any> => {
  const response = await fetch(`${BASE_URL}/api/ottoracks/${rackId}/shelves/${shelfId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(shelfData),
  });
  if (!response.ok) {
    throw new Error(`Error updating shelf ${shelfId} in Ottorack ${rackId}: ${response.statusText}`);
  }
  return response.json();
};

// Reset a specific shelf in an Ottorack
export const resetOttorackShelf = async (rackId: number, shelfId: number): Promise<any> => {
  const response = await fetch(`${BASE_URL}/api/ottoracks/${rackId}/shelves/${shelfId}/reset`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Error resetting shelf ${shelfId} in Ottorack ${rackId}: ${response.statusText}`);
  }
  return response.json();
};

// Delete an Ottorack
export const deleteOttorack = async (id: number): Promise<void> => {
  const response = await fetch(`${BASE_URL}/api/ottoracks/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Error deleting Ottorack with ID ${id}: ${response.statusText}`);
  }
};