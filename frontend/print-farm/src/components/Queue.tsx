
// Define a type for your printer and otto_eject parameters if not already defined
// Assuming Printer has an 'id' and 'ottoeject_params' (if ottoeject_params are part of the printer config)
// Or, if ottoeject_params are per-job, they should be in QueueRepresentation.
// For this example, I'll assume `QueueRepresentation` includes `ottoeject_params`.
// interface Printer {
//     id: number;
//     // Add other printer properties here if needed
// }

// export interface QueueRepresentation {
//     fileName: string;
//     storageLocation: number;
//     printer?: Printer; // Make printer optional as it might be undefined initially
//     ottoeject_params?: any; // Assuming 'any' for now, define a proper interface if known
//     // Potentially add an 'id' to QueueRepresentation to match 'job_details["id"]'
//     id?: number; // Added to match Python's job_details['id']
// }


// --- Mock Functions (Replace with your actual API calls) ---
const start_Print = async (printerId: number, jobDetails: StartPrintPayload, setPrintJob: any): Promise<boolean> => {
    console.log(`Sending print command for file '${jobDetails.filename}' to printer ID ${printerId}...`);

    //TODO: UPLOAD FILE
    
    // const bedLeveling = await sendGCodeToPrinter(printerId, {gcode: "G90\nG1 Z150 F3000"});
    // await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    // //TODO: while should ping for status until changed? 
    // let bedLevelComplete = false;
    // // let result: any;

    // while (!bedLevelComplete) {
    //     await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 3 seconds
    //     // const { status } = await getOttoejectStatusById(OTTOEJECT_ID);
    //     const { status } = await getPrinterStatusById(printerId);
    //     // const { status } = await getPrinterById(printerId);
        
    //     console.log(`Task ${ bedLeveling } status: ${status}`);
        
    //     if (status === 'IDLE') {
    //         bedLevelComplete = true;
    //         // result = taskResult;
    //     } else if (status === 'FAILED') {
    //         throw new Error(`Task ${bedLeveling} failed!`);
    //     } else {
    //         // Still processing, wait a bit before polling again
            
    //         await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    //     }
    // }

    // start print
    const startedPrint = await startPrint(printerId, jobDetails);

    //TODO: while should ping for status until changed? 
    let taskComplete = false;
    // let result: any;
    

    while (!taskComplete) {
        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 3 seconds
        // const { status } = await getOttoejectStatusById(OTTOEJECT_ID);
        const { status } = await getPrinterStatusById(printerId);
        // const { status } = await getPrinterById(printerId);
        
        updateStatus(setPrintJob, jobDetails, status);

        console.log(`Task ${ startedPrint } status: ${status}`);
        if(status === 'IDLE'){
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        if (status === 'FINISH') {
            taskComplete = true;
            // result = taskResult;
        } else if (status === 'FAILED') {
            throw new Error(`Task ${startedPrint} failed!`);
        } else {
            // Still processing, wait a bit before polling again
            
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 3 seconds
        }
    }

    // Simulate API call delay and success/failure
    // await new Promise(resolve => setTimeout(resolve, 5000));
    // const success = Math.random() > 0.1; // 90% success rate

    if (startedPrint) {
        console.log(`Print command sent for ${jobDetails.filename}`);
    } else {
        console.error(`Failed to send print command for ${jobDetails.filename}`);
    }
    return startedPrint;
};

const performEjectionSequence = async (ottoejectId: number, printerId: number, params: any, queue: any): Promise<boolean> => {
    console.log(`Performing ejection sequence for OttoEject ID ${ottoejectId}, Printer ID ${printerId} with params:`, params, ` at storage Location: ${queue.storageLocation}`);

    if (queue.storageLocation >= 3 && queue.storageLocation <= 6) {
        console.log(`store the file ${queue.fileName} in slot ${queue.storageLocation}`);
    }

    //NOTE: OTTOEJECT STATUS WHEN EJECTING : ====   EJECTING
    // Simulate API call delay and success/failure
    const homeOttoeject = await sendOttoejectMacro(ottoejectId, {macro: 'OTTOEJECT_HOME'});
    const setPrinterBedHeight = await sendGCodeToPrinter(printerId, {gcode: "G90\nG1 Z150 F3000"});
    console.log(`Task ${ setPrinterBedHeight }`);

    let homeComplete = false;
    
    while (!homeComplete) {
        // const { status } = await getOttoejectStatusById(OTTOEJECT_ID);
        const { status } = await getOttoejectStatusById(ottoejectId);
        // const { status } = await getPrinterById(printerId);

        console.log(`Task ${ homeOttoeject } status: ${status}`);
        
        if (status === 'ONLINE') {
            homeComplete = true;
            // result = taskResult;
        } else if (status === 'FAILED') {
            throw new Error(`Task ${homeOttoeject} failed!`);
        } else {
            // Still processing, wait a bit before polling again
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        }
    }



    const successEjectFromPrinter = await sendOttoejectMacro(ottoejectId, {macro: 'EJECT_FROM_P1'}).then(async (e) => {
        let taskComplete = false;
    
        while (!taskComplete) {
            // const { status } = await getOttoejectStatusById(OTTOEJECT_ID);
            const { status } = await getOttoejectStatusById(ottoejectId);
            // const { status } = await getPrinterById(printerId);

            console.log(`Task ${ e } status: ${status}`);
            
            if (status === 'ONLINE') {
                taskComplete = true;
                // result = taskResult;
            } else if (status === 'FAILED') {
                throw new Error(`Task ${e} failed!`);
            } else {
                // Still processing, wait a bit before polling again
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
            }
        }


        const success = await sendOttoejectMacro(ottoejectId, {macro: `STORE_TO_SLOT_${queue.storageLocation}`}).then(async (f) => {
            let task2Complete = false; 
            while (!task2Complete) {
                // const { status } = await getOttoejectStatusById(OTTOEJECT_ID);
                const { status } = await getOttoejectStatusById(ottoejectId);
                // const { status } = await getPrinterById(printerId);

                console.log(`Task ${ f } status: ${status}`);
                
                if (status === 'ONLINE') {
                    task2Complete = true;
                    // result = taskResult;
                } else if (status === 'FAILED') {
                    throw new Error(`Task ${f} failed!`);
                } else {
                    // Still processing, wait a bit before polling again
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
                }
            }
            return f;
        });
        return e;
        
    }).catch(() => {
        // console.error(`Ejection sequence FAILED from Printer`)
        console.error(`Ejection sequence FAILED for OttoEject ID ${ottoejectId}`);

    }).finally(() => {
            // console.log(`Ejected sequence SUCCESSFUL from Printer`);
        console.log(`Ejection sequence completed for OttoEject ID ${ottoejectId}, stored at bay ${queue.storageLocation}`);

    })
    // const successEjectFromPrinter = await sendOttoejectMacro(ottoejectId, {macro: 'GRAB_FROM_SLOT_1'});

    
    // let taskComplete = false;
    
    // while (!taskComplete) {
    //     // const { status } = await getOttoejectStatusById(OTTOEJECT_ID);
    //     const { status } = await getOttoejectStatusById(ottoejectId);
    //     // const { status } = await getPrinterById(printerId);

    //     console.log(`Task ${ successEjectFromPrinter } status: ${status}`);
        
    //     if (status === 'ONLINE') {
    //         taskComplete = true;
    //         // result = taskResult;
    //     } else if (status === 'FAILED') {
    //         throw new Error(`Task ${successEjectFromPrinter} failed!`);
    //     } else {
    //         // Still processing, wait a bit before polling again
    //         await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    //     }
    // }


    // const success = await sendOttoejectMacro(ottoejectId, {macro: 'STORE_TO_SLOT_3'});

    // let task2Complete = false; 
    // while (!task2Complete) {
    //     // const { status } = await getOttoejectStatusById(OTTOEJECT_ID);
    //     const { status } = await getOttoejectStatusById(ottoejectId);
    //     // const { status } = await getPrinterById(printerId);

    //     console.log(`Task ${ successEjectFromPrinter } status: ${status}`);
        
    //     if (status === 'ONLINE') {
    //         task2Complete = true;
    //         // result = taskResult;
    //     } else if (status === 'FAILED') {
    //         throw new Error(`Task ${successEjectFromPrinter} failed!`);
    //     } else {
    //         // Still processing, wait a bit before polling again
    //         await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    //     }
    // }

    // if (successEjectFromPrinter) {
    //     console.log(`Ejected sequence SUCCESSFUL from Printer`);
    // } else {
    //     console.error(`Ejection sequence FAILED from Printer`);
    // }
    
    // await new Promise(resolve => setTimeout(resolve, 5000));
    // const success = Math.random() > 0.1; // 90% success rate
    // if (success) {
    //     console.log(`Ejection sequence completed for OttoEject ID ${ottoejectId}, stored at bay ${queue.storageLocation}`);
    // } else {
    //     console.error(`Ejection sequence FAILED for OttoEject ID ${ottoejectId}`);
    // }
    return successEjectFromPrinter;
};

const resetPrintBed = async (ottoejectId: number, job_count: number, element: any, printerId: any) => {

    const emptyBedLoc = job_count+1; 

    const bedLeveling = await sendGCodeToPrinter(printerId, {gcode: "G90\nG1 Z150 F3000"});
    console.log(`Task printer bed leveling status: ${bedLeveling}`);
    
    const successLoadToPrinter = await sendOttoejectMacro(ottoejectId, {macro: `GRAB_FROM_SLOT_${emptyBedLoc}`}).then(async (e) => {
        let taskComplete = false;
    
        while (!taskComplete) {
            // const { status } = await getOttoejectStatusById(OTTOEJECT_ID);
            const { status } = await getOttoejectStatusById(ottoejectId);
            // const { status } = await getPrinterById(printerId);

            console.log(`Task ${ e } status: ${status}`);
            
            if (status === 'ONLINE') {
                taskComplete = true;
                // result = taskResult;
            } else if (status === 'FAILED') {
                throw new Error(`Task ${e} failed!`);
            } else {
                // Still processing, wait a bit before polling again
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
            }
        }


        await sendOttoejectMacro(ottoejectId, {macro: `LOAD_ONTO_P1`}).then(async (f) => {
            let task2Complete = false; 
            while (!task2Complete) {
                // const { status } = await getOttoejectStatusById(OTTOEJECT_ID);
                const { status } = await getOttoejectStatusById(ottoejectId);
                // const { status } = await getPrinterById(printerId);

                console.log(`Task ${ f } status: ${status}`);
                
                if (status === 'ONLINE') {
                    task2Complete = true;
                    // result = taskResult;
                } else if (status === 'FAILED') {
                    throw new Error(`Task ${f} failed!`);
                } else {
                    // Still processing, wait a bit before polling again
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
                }
            }
            return f;
        });
        return e;
        
    }).catch(() => {
        // console.error(`Ejection sequence FAILED from Printer`)
        console.error(`Reset Empty print bed sequence FAILED for OttoEject ID ${ottoejectId}`);

    }).finally(() => {
            // console.log(`Ejected sequence SUCCESSFUL from Printer`);
        console.log(`Reset Empty print bed sequence COMPLETED for OttoEject ID ${ottoejectId}, Grabbed from ${emptyBedLoc}, stored loaded to Printer: ${element.printer}`);
    })
    return successLoadToPrinter;
}
// --- End Mock Functions ---


const updateStatus = (setPrintJob: any, jobDetails: any, newStatus: any) => {
    // const { setPrintJob } = useContext(JobContext);
    const targetFileID = jobDetails.printJobId;
    
    setPrintJob((prevPrintJobs: PrintJobRepresentation[]) => {
    // Check if the item exists in the array
    const jobExists = prevPrintJobs.some((job) => job.name === targetFileID);

    if (!jobExists) {
      console.warn(`Print job with file name '${targetFileID}' not found. No update performed.`);
      return prevPrintJobs;
    }

    return prevPrintJobs.map((job) => {
      if (job.name === targetFileID) {
        return {
          ...job,
          status: newStatus,
        };
      }
      return job;
    });
  });
}

import { useContext } from "react";
import { JobContext } from "../App.tsx";
import PrintJobRepresentation, { QueueRepresentation } from "../representations/printJobRepresentation.ts";
import { OttoejectDevice } from "../representations/ottoejectRepresentation.ts";
import { getOttoejectStatusById, getPrinterById, getPrinterStatusById, sendGCodeToPrinter, sendOttoejectMacro, startPrint } from "../ottoengine_API.ts";
import { StartPrintPayload } from "../representations/printerRepresentation.ts";

export default async function startQueue (queue: QueueRepresentation[], ottoeject: OttoejectDevice[], setPrintJob: any) {
    // const { ottoeject , queue} = useContext(JobContext);
    console.log('in start queue');
    // Sort the queue by storageLocation in ascending order
    queue.sort((a, b) => a.storageLocation! - b.storageLocation!);
 
    const job_count = queue.length;
    console.log(queue);
    let completed_jobs_successfully = 0;

    for (let i = 0; i < job_count; i++) {
        const element = queue[i];
        const job_id = i + 1; // Use element.id if available, otherwise use index + 1

        //TODO: ADD A DROPDOWN FOR OTTOEJECT SELECT TO GET ID
        const OTTOEJECT_ID = 1; // Replace with your actual OTTOEJECT_ID logic if it's dynamic
                                 // For now, it's a placeholder as it wasn't directly in element in the Python.
                                 // If it's part of element.printer or element itself, adjust accordingly.

        console.log(`\n>>> Processing Job ID ${job_id} of ${job_count}: File '${element.fileName}' <<<`);

        // Check for required properties before attempting API calls
        if (!element.printer || typeof element.printer.id !== 'number' || !element.fileName) {
            console.error(`   ❌ Required data missing for job ${job_id}: Printer ID or filename is invalid. Halting automation.`);
            break; // Halting automation on critical missing data
        }

        // 1. Start Print and Wait
        const printSuccess = await start_Print(element.printer.id, { filename: element.fileName, printJobId: element.printJobId }, setPrintJob);

        //TEST
        // const { printSuccess } = await sendOttoejectMacro(OTTOEJECT_ID, {macro: 'GRAB_FROM_SLOT_1'});
        
        // await new Promise(resolve => {updateStatus(setPrintJob, queue, 'Queued'), setTimeout(resolve, 3000)});
        // const printSuccess = Math.random() > 0.1; // 90% success rate
        // updateStatus(setPrintJob, queue, 'Printing');
        



        if (printSuccess) {
            console.log(`Print for job ${job_id} ('${element.fileName}') completed.`);

            // 2. Perform Ejection Sequence
            // Ensure element.ottoeject_params is available and correctly typed
            if (ottoeject) {
                const ejectionSuccess = await performEjectionSequence(OTTOEJECT_ID, element.printer.id, ottoeject[0], element);
                // const ejectionSuccess = await sendOttoejectMacro(OTTOEJECT_ID, {macro: 'STORE_TO_SLOT_3'});


                // await new Promise(resolve => setTimeout(resolve, 3000));
                // const ejectionSuccess = Math.random() > 0.1; // 90% success rate


                if (ejectionSuccess) {
                    console.log(`Ejection sequence for job ${job_id} completed.`);
                    completed_jobs_successfully += 1;
                    updateStatus(setPrintJob, element, 'Complete');
                } else {
                    console.error(`Ejection sequence FAILED for job ${job_id}. Halting automation.`);
                    break; // Halting automation on ejection failure
                }
            } else {
                console.warn(`   ⚠️ No ottoeject_params provided for job ${job_id}. Skipping ejection sequence.`);
                // Decide if you want to increment completed_jobs_successfully even without ejection
                completed_jobs_successfully += 1;
            }

        } else {
            console.error(`Print FAILED or did not complete for job ${job_id}. Halting automation.`);
            break; // Halting automation on print failure
        }

        // 3. Storage Location Logging (from your original TS)
        // This part runs AFTER the print and eject sequence, as per your original TS structure.
        // If you need it earlier or conditional, adjust its placement.
        // if (element.storageLocation === 3) {
        //     console.log(`store the file ${element.fileName} in slot 3`);
        // } else if (element.storageLocation === 4) {
        //     console.log(`store the file ${element.fileName} in slot 4`);
        // } else if (element.storageLocation === 5) {
        //     console.log(`store the file ${element.fileName} in slot 5`);
        // } else if (element.storageLocation === 6) {
        //     console.log(`store the file ${element.fileName} in slot 6`);
        // }
        // More general approach:
        // if (element.storageLocation >= 3 && element.storageLocation <= 6) {
        //     console.log(`store the file ${element.fileName} in slot ${element.storageLocation}`);
        // }


        // 4. Cooling down / pause logic
        if (job_id < job_count) { // Python's `job_details['id'] < job_count` where job_details['id'] is 1-indexed
            console.log("Cooling down and preparing for next job...");

            const resetBed = await resetPrintBed(OTTOEJECT_ID, i, element, element.printer.id);

            if (resetBed) {
                    console.log(`Ejection sequence for job ${job_id} completed.`);
                    completed_jobs_successfully += 1;
                    updateStatus(setPrintJob, queue, 'Complete');
                } else {
                    console.error(`Ejection sequence FAILED for job ${job_id}. Halting automation.`);
                    break; // Halting automation on ejection failure
                }
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15-second pause
        } else {
            console.log("Final job in sequence processed.");
        }
    }
    

    console.log(`\nAutomation finished. Successfully completed ${completed_jobs_successfully} out of ${job_count} jobs.`);
};