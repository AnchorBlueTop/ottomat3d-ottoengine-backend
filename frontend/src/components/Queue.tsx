import PrintJobRepresentation, { QueueRepresentation } from "../representations/printJobRepresentation.ts";
import { getOttoejectStatusById, getPrinterStatusById, sendGCodeToPrinter, sendOttoejectMacro, startPrint } from "../ottoengine_API.ts";
import { StartPrintPayload } from "../representations/printerRepresentation.ts";

export default async function startQueue(queue: QueueRepresentation[], setPrintJob: any, _currentFiles: any) {
    queue.sort((a, b) => a.storageLocation! - b.storageLocation!);
    const job_count = queue.length;
    let completed_jobs_successfully = 0;

    for (let i = 0; i < job_count; i++) {
        const element = queue[i];
        const job_id = i + 1;

        //TODO: ADD A DROPDOWN FOR OTTOEJECT SELECT TO GET ID
        const OTTOEJECT_ID = element.ottoeject?.id || 0;
        // const OTTOEJECT_ID = 1; // Replace with your actual OTTOEJECT_ID logic if it's dynamic
        // For now, it's a placeholder as it wasn't directly in element in the Python.
        // If it's part of element.printer or element itself, adjust accordingly.

        console.log(`\n>>> Processing Job ID ${job_id} of ${job_count}: File '${element.fileName}' <<<`);

        if (!element.printer || typeof element.printer.id !== 'number' || !element.fileName) {
            console.error(`   ❌ Required data missing for job ${job_id}: Printer ID or filename is invalid. Halting automation.`);
            break;
        }

        const printSuccess = await start_Print(element.printer.id, { filename: element.fileName, printJobId: element.printJobId }, setPrintJob, currentFiles);

        if (printSuccess) {
            console.log(`Print for job ${job_id} ('${element.fileName}') completed.`);

            if (element.ottoeject) {
                const ejectionSuccess = await performEjectionSequence(OTTOEJECT_ID, element.printer.id, element.ottoeject, element, setPrintJob, { filename: element.fileName, printJobId: element.printJobId });

                if (ejectionSuccess) {
                    console.log(`Ejection sequence for job ${job_id} completed.`);
                    completed_jobs_successfully += 1;
                    updateStatus(setPrintJob, element, 'Complete', 0);
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
                updateStatus(setPrintJob, queue, 'Complete', 0);
            } else {
                console.error(`Ejection sequence FAILED for job ${job_id}. Halting automation.`);
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10-second pause
        } else {
            console.log("Final job in sequence processed.");
        }
    }

//     let overallSuccess = true; // Track if the entire process was successful
//     // let completed_jobs_successfully = 0;
//     const printPromises = [];
//     const jobElements = []; // To keep track of original element for post-processing

//     console.log("Initiating multiple prints simultaneously...");

//     for (let i = 0; i < queue.length; i++) {
//         const element = queue[i];
//         const job_id = i + 1; // Assuming job_id is 1-based index


//         if (!element.printer || typeof element.printer.id !== 'number' || !element.fileName) {
//             console.error(`Required data missing for job ${job_id}: Printer ID or filename is invalid. Halting automation.`);
//             break;
//         }

//         console.log(`Queueing print for job ${job_id} ('${element.fileName}')...`);
//         updateStatus(setPrintJob, element, 'Queued', 0); // Initial status

//         // Initiate the print but don't await it yet. Store the promise.
//         // The promise will resolve with information about the print's success
//         const printPromise = start_Print(element.printer.id, { filename: element.fileName, printJobId: element.printJobId }, setPrintJob, currentFiles)
//             .then(printSuccess => {
//                 if (printSuccess) {
//                     console.log(`Print for job ${job_id} ('${element.fileName}') completed.`);
//                     updateStatus(setPrintJob, element, 'Print Complete', 0);
//                     return { status: 'Complete', success: true, element: element, job_id: job_id };
//                 } else {
//                     console.error(`Print FAILED for job ${job_id}.`);
//                     updateStatus(setPrintJob, element, 'Print Failed', 100);
//                     return { status: 'Incomplete', success: false, element: element, job_id: job_id };
//                 }
//             })
//             .catch(error => {
//                 console.error(`Error during print for job ${job_id}:`, error);
//                 updateStatus(setPrintJob, element, 'Error', 0);
//                 return { status: 'rejected', element: element, job_id: job_id, reason: error };
//             });

//         printPromises.push(printPromise);
//         jobElements.push(element); // Store the element to access its data later
//     }

//     console.log("Waiting for all initiated prints to complete...");
//     // Wait for all print initiation promises to settle.
//     // The results here will be from the .then/.catch blocks of the individual print promises.
//     const results = await Promise.allSettled(printPromises);

//     console.log("Processing results and performing individual post-print actions...");

//     // Now, iterate through the settled results to perform ejection for each successful print
//     const postPrintActions = [];

//     for (let i = 0; i < results.length; i++) {
//         const result = results[i];
//         const originalElement = jobElements[i];
//         const originalJobId = i + 1;

//         if (result.status === 'fulfilled' && result.value.success) {
//             completed_jobs_successfully += 1;

//             if (originalElement.ottoeject) {
//                 console.log(`Job ${originalJobId} ('${originalElement.fileName}'): Initiating ejection sequence.`);
//                 updateStatus(setPrintJob, originalElement, 'Ejecting', 0);

//                 // Add ejection promise to a new array to await all ejects if desired,
//                 // or just await immediately if you want strictly sequential ejects after print batch.
//                 // For "once a print is complete", we'll just chain it to the print's outcome.
//                 const ejectionPromise = performEjectionSequence(
//                     OTTOEJECT_ID,
//                     originalElement.printer.id,
//                     originalElement.ottoeject,
//                     originalElement,
//                     setPrintJob,
//                     { filename: originalElement.fileName, printJobId: originalElement.printJobId }
//                 )
//                     .then(ejectionSuccess => {
//                         if (ejectionSuccess) {
//                             console.log(`Ejection sequence for job ${originalJobId} completed.`);
//                             updateStatus(setPrintJob, originalElement, 'Complete', 0);
//                             return true;
//                         } else {
//                             console.error(`Ejection sequence FAILED for job ${originalJobId}.`);
//                             updateStatus(setPrintJob, originalElement, 'Ejection Failed', 0);
//                             overallSuccess = false; // Mark overall as failed
//                             return false;
//                         }
//                     })
//                     .catch(error => {
//                         console.error(`Error during ejection for job ${originalJobId}:`, error);
//                         updateStatus(setPrintJob, originalElement, 'Ejection Error', 0);
//                         overallSuccess = false; // Mark overall as failed
//                         return false;
//                     });
//                 postPrintActions.push(ejectionPromise);

//             } else {
//                 console.warn(`   ⚠️ No ottoeject_params provided for job ${originalJobId}. Skipping ejection sequence.`);
//                 updateStatus(setPrintJob, originalElement, 'Complete', 0); // Mark as complete even without eject
//             }
//         } else {
//             // Print failed or rejected
//             console.error(`Job ${originalJobId} ('${originalElement.fileName}') print failed or encountered an error.`);
//             overallSuccess = false; // Mark overall as failed
//             // Status was already updated in the initial printPromise chain
//         }
//     }

//     // Wait for all ejection/post-print actions to complete
//     console.log("Waiting for all individual post-print actions (ejections) to complete...");
//     await Promise.allSettled(postPrintActions); // Use allSettled to gather all results

//     // Final cooldown and reset bed (if still desired as a global step after all individual actions)
//     if (overallSuccess) { // Only do this if everything else went well
//         console.log("All prints and individual post-print actions processed. Performing final cooldown and bed reset...");
//         await new Promise(resolve => setTimeout(resolve, 10000)); // 10-second pause

//         // This assumes resetPrintBed is a single action for a particular printer.
//         // You might need to adjust if you have multiple printers and each needs a reset.
//         const firstPrinterId = queue[0]?.printer.id; // Use the printer ID from the first job, or find a better way
//         if (firstPrinterId) {
//             const resetBedSuccess = await resetPrintBed(OTTOEJECT_ID, 0, null, firstPrinterId);
//             if (resetBedSuccess) {
//                 console.log(`Print bed reset completed.`);
//             } else {
//                 console.error(`Print bed reset FAILED.`);
//                 overallSuccess = false;
//             }
//         } else {
//             console.warn("Could not determine a printer ID for global bed reset.");
//         }
//     } else {
//         console.warn("Skipping global cooldown/bed reset due to earlier failures.");
//     }


//     console.log(`Total successful prints (before ejection checks): ${completed_jobs_successfully}`);
//     if (overallSuccess) {
//         console.log("Automation sequence completed successfully!");
//     } else {
//         console.error("Automation sequence completed with errors.");
//     }
//     return overallSuccess;
// }

console.log(`\nAutomation finished. Successfully completed ${completed_jobs_successfully} out of ${job_count} jobs.`);
};

const start_Print = async (printerId: number, jobDetails: StartPrintPayload, setPrintJob: any, _currentFiles: any): Promise<boolean> => {
    console.log(`Sending print command for file '${jobDetails.filename}' to printer ID ${printerId}...`);

    //TODO: UPLOAD FILE
    // currentFiles.find(jobDetails.filename)
    // console.log(currentFiles)
    // await uploadFile(currentFiles.find(jobDetails.filename), printerId); 
    // await uploadFile(currentFiles[0], 1);


    const startedPrint = await startPrint(printerId, jobDetails);
    console.log('task startedPrint: ', startedPrint);
    console.log(printerId, jobDetails);
    //TODO: while should ping for status until changed? 
    let taskComplete = false;

    while (!taskComplete) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        const { status, remaining_time_minutes } = await getPrinterStatusById(printerId);

        updateStatus(setPrintJob, jobDetails, status, remaining_time_minutes);

        console.log(`Task ${startedPrint} status: ${status}, remaining time: ${remaining_time_minutes} minutes`);
        if (status === 'IDLE') {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (status === 'FINISH') {
            taskComplete = true;
        } else if (status === 'FAILED') {
            throw new Error(`Task ${startedPrint} failed!`);
        } else {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        }
    }

    if (startedPrint) {
        console.log(`Print command sent for ${jobDetails.filename}`);
    } else {
        console.error(`Failed to send print command for ${jobDetails.filename}`);
    }
    return startedPrint;
};

const performEjectionSequence = async (ottoejectId: number, printerId: number, params: any, queue: any, setPrintJob: any, jobDetails: any): Promise<boolean> => {
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
        updateStatus(setPrintJob, jobDetails, status, undefined);

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
            updateStatus(setPrintJob, jobDetails, status, undefined);


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
                updateStatus(setPrintJob, jobDetails, status, undefined);

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
        const _parkOttoeject = await sendOttoejectMacro(ottoejectId, { macro: 'PARK_OTTOEJECT' });
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
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 3 seconds
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
        const _parkOttoeject = await sendOttoejectMacro(ottoejectId, { macro: 'PARK_OTTOEJECT' });
        return e;

    }).catch(() => {
        console.error(`Reset Empty print bed sequence FAILED for OttoEject ID ${ottoejectId}`);

    }).finally(() => {
        console.log(`Reset Empty print bed sequence COMPLETED for OttoEject ID ${ottoejectId}, Grabbed from ${emptyBedLoc}, stored loaded to Printer: ${element.printer.model}`);
    })
    return successLoadToPrinter;
}

const updateStatus = (setPrintJob: any, jobDetails: any, newStatus: any, remaining_time: any) => {
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
                    reamaining_time: remaining_time
                };
            }
            return job;
        });
    });
}
