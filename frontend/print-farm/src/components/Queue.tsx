import PrintJobRepresentation, { QueueRepresentation } from "../representations/printJobRepresentation.ts";
import { OttoejectDevice } from "../representations/ottoejectRepresentation.ts";
import { getOttoejectStatusById, getPrinterStatusById, sendGCodeToPrinter, sendOttoejectMacro, startPrint } from "../ottoengine_API.ts";
import { StartPrintPayload } from "../representations/printerRepresentation.ts";

export default async function startQueue(queue: QueueRepresentation[], ottoeject: OttoejectDevice[], setPrintJob: any) {
    queue.sort((a, b) => a.storageLocation! - b.storageLocation!);
    const job_count = queue.length;
    let completed_jobs_successfully = 0;

    for (let i = 0; i < job_count; i++) {
        const element = queue[i];
        const job_id = i + 1;

        //TODO: ADD A DROPDOWN FOR OTTOEJECT SELECT TO GET ID
        const OTTOEJECT_ID = 1; // Replace with your actual OTTOEJECT_ID logic if it's dynamic
        // For now, it's a placeholder as it wasn't directly in element in the Python.
        // If it's part of element.printer or element itself, adjust accordingly.

        console.log(`\n>>> Processing Job ID ${job_id} of ${job_count}: File '${element.fileName}' <<<`);

        if (!element.printer || typeof element.printer.id !== 'number' || !element.fileName) {
            console.error(`   ❌ Required data missing for job ${job_id}: Printer ID or filename is invalid. Halting automation.`);
            break;
        }

        const printSuccess = await start_Print(element.printer.id, { filename: element.fileName, printJobId: element.printJobId }, setPrintJob);

        if (printSuccess) {
            console.log(`Print for job ${job_id} ('${element.fileName}') completed.`);

            if (ottoeject) {
                const ejectionSuccess = await performEjectionSequence(OTTOEJECT_ID, element.printer.id, ottoeject[0], element);

                if (ejectionSuccess) {
                    console.log(`Ejection sequence for job ${job_id} completed.`);
                    completed_jobs_successfully += 1;
                    updateStatus(setPrintJob, element, 'Complete');
                } else {
                    console.error(`Ejection sequence FAILED for job ${job_id}. Halting automation.`);
                    break;
                }
            } else {
                console.warn(`   ⚠️ No ottoeject_params provided for job ${job_id}. Skipping ejection sequence.`);
            }

        } else {
            console.error(`Print FAILED or did not complete for job ${job_id}. Halting automation.`);
            break;
        }

        if (job_id < job_count) {
            console.log("Cooling down and preparing for next job...");
            const resetBed = await resetPrintBed(OTTOEJECT_ID, i, element, element.printer.id);

            if (resetBed) {
                console.log(`Ejection sequence for job ${job_id} completed.`);
                // completed_jobs_successfully += 1;
                updateStatus(setPrintJob, queue, 'Complete');
            } else {
                console.error(`Ejection sequence FAILED for job ${job_id}. Halting automation.`);
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15-second pause
        } else {
            console.log("Final job in sequence processed.");
        }
    }

    console.log(`\nAutomation finished. Successfully completed ${completed_jobs_successfully} out of ${job_count} jobs.`);
};

const start_Print = async (printerId: number, jobDetails: StartPrintPayload, setPrintJob: any): Promise<boolean> => {
    console.log(`Sending print command for file '${jobDetails.filename}' to printer ID ${printerId}...`);

    //TODO: UPLOAD FILE

    const startedPrint = await startPrint(printerId, jobDetails);

    //TODO: while should ping for status until changed? 
    let taskComplete = false;

    while (!taskComplete) {
        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 3 seconds
        const { status } = await getPrinterStatusById(printerId);

        updateStatus(setPrintJob, jobDetails, status);

        console.log(`Task ${startedPrint} status: ${status}`);
        if (status === 'IDLE') {
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        if (status === 'FINISH') {
            taskComplete = true;
        } else if (status === 'FAILED') {
            throw new Error(`Task ${startedPrint} failed!`);
        } else {
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 3 seconds
        }
    }

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

    const homeOttoeject = await sendOttoejectMacro(ottoejectId, { macro: 'OTTOEJECT_HOME' });
    const setPrinterBedHeight = await sendGCodeToPrinter(printerId, { gcode: "G90\nG1 Z150 F3000" });
    console.log(`Task ${setPrinterBedHeight}`);

    let homeComplete = false;

    while (!homeComplete) {
        const { status } = await getOttoejectStatusById(ottoejectId);

        console.log(`Task ${homeOttoeject} status: ${status}`);

        if (status === 'ONLINE') {
            homeComplete = true;
        } else if (status === 'FAILED') {
            throw new Error(`Task ${homeOttoeject} failed!`);
        } else {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        }
    }



    const successEjectFromPrinter = await sendOttoejectMacro(ottoejectId, { macro: 'EJECT_FROM_P1' }).then(async (e) => {
        let taskComplete = false;

        while (!taskComplete) {
            const { status } = await getOttoejectStatusById(ottoejectId);

            console.log(`Task ${e} status: ${status}`);

            if (status === 'ONLINE') {
                taskComplete = true;
            } else if (status === 'FAILED') {
                throw new Error(`Task ${e} failed!`);
            } else {
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
            }
        }

        await sendOttoejectMacro(ottoejectId, { macro: `STORE_TO_SLOT_${queue.storageLocation}` }).then(async (f) => {
            let task2Complete = false;
            while (!task2Complete) {
                const { status } = await getOttoejectStatusById(ottoejectId);

                console.log(`Task ${f} status: ${status}`);

                if (status === 'ONLINE') {
                    task2Complete = true;
                } else if (status === 'FAILED') {
                    throw new Error(`Task ${f} failed!`);
                } else {
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
                }
            }
            return f;
        });
        const parkOttoeject = await sendOttoejectMacro(ottoejectId, { macro: 'PARK_OTTOEJECT' });
        return e;

    }).catch(() => {
        console.error(`Ejection sequence FAILED for OttoEject ID ${ottoejectId}`);

    }).finally(() => {
        console.log(`Ejection sequence COMPLETED for OttoEject ID ${ottoejectId}, stored at bay ${queue.storageLocation}`);

    })

    return successEjectFromPrinter;
};

const resetPrintBed = async (ottoejectId: number, job_count: number, element: any, printerId: any) => {
    const emptyBedLoc = job_count + 1;
    const bedLeveling = await sendGCodeToPrinter(printerId, { gcode: "G90\nG1 Z150 F3000" });
    console.log(`Task printer bed leveling status: ${bedLeveling}`);

    const successLoadToPrinter = await sendOttoejectMacro(ottoejectId, { macro: `GRAB_FROM_SLOT_${emptyBedLoc}` }).then(async (e) => {
        let taskComplete = false;

        while (!taskComplete) {
            const { status } = await getOttoejectStatusById(ottoejectId);

            console.log(`Task ${e} status: ${status}`);

            if (status === 'ONLINE') {
                taskComplete = true;
            } else if (status === 'FAILED') {
                throw new Error(`Task ${e} failed!`);
            } else {
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
            }
        }


        await sendOttoejectMacro(ottoejectId, { macro: `LOAD_ONTO_P1` }).then(async (f) => {
            let task2Complete = false;
            while (!task2Complete) {
                const { status } = await getOttoejectStatusById(ottoejectId);

                console.log(`Task ${f} status: ${status}`);

                if (status === 'ONLINE') {
                    task2Complete = true;
                } else if (status === 'FAILED') {
                    throw new Error(`Task ${f} failed!`);
                } else {
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
                }
            }
            return f;
        });
        const parkOttoeject = await sendOttoejectMacro(ottoejectId, { macro: 'PARK_OTTOEJECT' });
        return e;

    }).catch(() => {
        console.error(`Reset Empty print bed sequence FAILED for OttoEject ID ${ottoejectId}`);

    }).finally(() => {
        console.log(`Reset Empty print bed sequence COMPLETED for OttoEject ID ${ottoejectId}, Grabbed from ${emptyBedLoc}, stored loaded to Printer: ${element.printer.model}`);
    })
    return successLoadToPrinter;
}

const updateStatus = (setPrintJob: any, jobDetails: any, newStatus: any) => {
    const targetFileID = jobDetails.printJobId;
    setPrintJob((prevPrintJobs: PrintJobRepresentation[]) => {
        const jobExists = prevPrintJobs.some((job) => job.id === targetFileID);

        if (!jobExists) {
            console.warn(`Print job with file name '${targetFileID}' not found. No update performed.`);
            return prevPrintJobs;
        }
        return prevPrintJobs.map((job) => {
            if (job.id === targetFileID) {
                return {
                    ...job,
                    status: newStatus,
                };
            }
            return job;
        });
    });
}
