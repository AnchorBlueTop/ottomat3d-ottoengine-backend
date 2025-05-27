// src/scripts/test-bambu-print-existing.js (Final Version - Incorporates verify_job reset)

// --- Dependencies ---
const { Printer, GcodeState } = require('../bambulabs-api/index.js'); // Use the main package export
const minimist = require('minimist');
const path = require('path');
const fs = require('fs'); // Needed to check if verify_job.gcode exists

// --- Configuration ---
// Comment out all blocks EXCEPT the one for the printer you are testing!

// // --- A1 Configuration ---
// const DEFAULT_CONFIG = {
//     ip: '192.168.68.65',
//     serial: '03919C461900537',
//     accessCode: '48185909',
//     filename: 'Cube2.gcode.3mf', // Change this to match file on printer
//     monitorSeconds: 60,
//     useAms: false, // Default: A1 usually has AMS lite
//     verifyJobFile: './verify_job.gcode' // Location of the dummy gcode file
// };

// --- A1-MINI Configuration ---
// const DEFAULT_CONFIG = {
//     ip: '192.168.68.59', /
//     serial: '0309EA470200493',
//     accessCode: '14306442',
//     filename: 'Cube10.gcode.3mf', // <<< Ensure this matches file on printer
//     monitorSeconds: 60,
//     useAms: false, // <<< Defaulting useAms to false based on simple script success
//     verifyJobFile: './verify_job.gcode' // Location of the dummy gcode file
// };

// // --- P1S Configuration ---
// const DEFAULT_CONFIG = {
//     ip: '192.168.68.68',
//     serial: '01P00A431300066', 
//     accessCode: '31863230',
//     filename: 'Cube2-PETG.gcode.3mf', // Change this to match file on printer
//     monitorSeconds: 60,
//     useAms: true,
//     verifyJobFile: './verify_job.gcode'
// };

// // --- P1P Configuration ---
const DEFAULT_CONFIG = {
    ip: '192.168.68.52', // Updated IP
    serial: '01S00C371700385',
    accessCode: '14358945',
    filename: 'Cube2.gcode.3mf', // Change this to match file on printer
    monitorSeconds: 60,
    useAms: false, // Default for P1P
    verifyJobFile: './verify_job.gcode'
};

// // --- X1-C Configuration ---
// // Note: This script doesn't handle signing; use test-x1c-signed-print.js for X1C
// const DEFAULT_CONFIG = {
//     ip: '192.168.68.67',
//     serial: '00M09D492600293',
//     accessCode: 'f6a1ae72',
//     filename: 'Cube.gcode.3mf', // Change this to match file on printer
//     monitorSeconds: 60,
//     useAms: true,
//     verifyJobFile: './verify_job.gcode'
// };


// --- Command Line Argument Parsing ---
const args = minimist(process.argv.slice(2));

const config = {
    ip: args.ip || DEFAULT_CONFIG.ip,
    serial: args.serial || DEFAULT_CONFIG.serial,
    accessCode: args.accesscode || args.accessCode || DEFAULT_CONFIG.accessCode,
    filename: args.filename || DEFAULT_CONFIG.filename,
    monitorSeconds: parseInt(args.monitor || DEFAULT_CONFIG.monitorSeconds, 10),
    debug: args.debug === 'true' || false,
    useAms: args.useams !== undefined ? (args.useams.toString().toLowerCase() === 'true') : DEFAULT_CONFIG.useAms,
    // Resolve verify job path relative to current working directory
    verifyJobFile: path.resolve(process.cwd(), args.verifyjob || DEFAULT_CONFIG.verifyJobFile),
    verifyJobRemoteName: path.basename(args.verifyjob || DEFAULT_CONFIG.verifyJobFile) // Just the filename for remote path
};

// --- Helper Function ---
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// --- Logger ---
function log(message, level = 'info') { /* ... logger implementation ... */
    const timestamp = new Date().toLocaleTimeString();
    if (level === 'error') { console.error(`[${timestamp} ${level.toUpperCase()}] ${message}`); }
    else if (level === 'warn') { console.warn(`[${timestamp} ${level.toUpperCase()}] ${message}`); }
    else if (level === 'debug' && config.debug) { console.log(`[${timestamp} ${level.toUpperCase()}] ${message}`); }
    else if (level === 'info') { console.log(`[${timestamp} ${level.toUpperCase()}] ${message}`); }
}

// --- Helper to wait for IDLE state ---
async function waitForState(printer, wantedState, timeoutMs, exitFlagRef) {
    const start = Date.now();
    log(`   Waiting up to ${timeoutMs/1000}s for state to become ${wantedState}...`, 'info');
    while (Date.now() - start < timeoutMs) {
      if (exitFlagRef.exiting) { log(`   Wait aborted by exit signal.`, 'warn'); return false; } // Check exit flag
      const currentState = printer.get_state();
      log(`   Current state: ${currentState}. Waiting...`, 'debug');
      if (currentState === wantedState) {
          log(`   ✅ Reached target state: ${wantedState}`, 'info');
          return true; // Success
      }
      await sleep(500); // Check every 0.5s
    }
    log(`   ❌ Timed out waiting for ${wantedState} state. Current state: ${printer.get_state()}`, 'warn');
    return false; // Timed out
}


// --- Main Function ---
async function main() {
    log('====================================================');
    log('=== Test BambuLab Print Existing File (w/ Verify Job Reset) ==='); // Updated title
    log('====================================================');
    log(`Target IP:        ${config.ip}`);
    log(`Serial No:        ${config.serial}`);
    log(`Access Code:      ${config.accessCode ? config.accessCode.substring(0, 2) + '...' : 'N/A'}`);
    log(`File to Print:    ${config.filename}`);
    log(`Verify Job File:  ${config.verifyJobFile}`);
    log(`Verify Job Remote:${config.verifyJobRemoteName}`);
    log(`Use AMS Flag:     ${config.useAms} (Passed to MQTT client)`);
    log(`Monitor Duration: ${config.monitorSeconds} seconds`);
    log(`Debug Mode:       ${config.debug}`);
    log('----------------------------------------------------');

    let printer = null;
    // Use an object for the exit flag so helper function can see changes
    let exitFlag = { exiting: false };
    let lastLoggedPercent = -1; // For progress logging

    // --- Signal Handler for Ctrl+C ---
    process.on('SIGINT', async () => {
         if (exitFlag.exiting) return; exitFlag.exiting = true; log('\n\n[INTERRUPT] Ctrl+C detected...', 'warn');
         if (printer && printer.is_connected()) { log('[INTERRUPT] Disconnecting MQTT...', 'info'); try { await printer.disconnect(); log('[INTERRUPT] MQTT disconnect call finished.', 'info');} catch (e) { log(`Disconnect error: ${e.message}`,'error');}}
         else if (printer) { log('[INTERRUPT] Printer client initialized but not connected.', 'warn');}
         else { log('[INTERRUPT] Printer client not initialized, cannot disconnect.', 'warn');}
         log('[INTERRUPT] Exiting.', 'info'); process.exit(0);
    });


    try {
        // -1. Check if verify_job file exists locally
        log('\n[-1] Checking if verify_job file exists locally...');
        try {
            await fs.access(config.verifyJobFile, fs.constants.R_OK);
            log(`   Local verify job file "${config.verifyJobFile}" found.`);
        } catch (fileError) {
             log(`   Error: Local verify job file "${config.verifyJobFile}" not found or not readable. Reset sequence might fail if file isn't on printer SD card.`, 'warn');
             // Continue, but warn the user. Backend should ensure file is on SD card.
        }

        // 1. Initialize Printer Client
        log('\n[1] Initializing printer client...');
         if (!config.serial || !config.accessCode || !config.ip) {
             throw new Error("Missing required config: ip, accessCode, and serial are required.");
         }
        printer = new Printer({
            ip: config.ip, serial: config.serial, accessCode: config.accessCode, debug: config.debug
        });
        log('   Printer client initialized OK.');

        // 1a. Setting up event listeners
        log('\n[1a] Setting up event listeners...');
        let lastState = null; let lastStage = null; let currentErrorCode = "0";
        // ... (Keep event listener setup from previous version, capturing errors/state) ...
        printer.on('mqtt_connect', () => log('[EVENT] >>> MQTT Connected <<<', 'info'));
        printer.on('mqtt_close', () => { log('[EVENT] <<< MQTT Closed >>>', 'info'); lastState = null; lastStage = null; currentErrorCode = "0"; lastLoggedPercent = -1;});
        printer.on('mqtt_error', (err) => log(`[EVENT] !!! MQTT Error: ${err.message || err}`, 'error'));
        printer.on('state_change', (state) => { if(!exitFlag.exiting) log(`[EVENT] State Change Reported: ${state}`, 'info')});
        printer.on('update', (data) => {
            if (exitFlag.exiting || !printer) return;
            try {
                const state = printer.get_state(); const stage = printer.get_current_stage();
                const bedTemp = printer.get_bed_temperature()?.toFixed(1) ?? 'N/A';
                const nozzleTemp = printer.get_nozzle_temperature()?.toFixed(1) ?? 'N/A';
                const percent = printer.get_percentage(); const remainingTime = printer.get_time() ?? 'N/A';
                currentErrorCode = data?.print?.print_error || "0";
                const percentStr = percent === null ? 'N/A' : `${percent}%`;
                if (state !== lastState || stage !== lastStage || currentErrorCode !== "0" || config.debug ) {
                    let logMsg = `--> Status Update: State='${state}', Stage='${stage}', Bed=${bedTemp}C, Nozzle=${nozzleTemp}C, Progress=${percentStr}, Remain=${remainingTime}m`;
                    let logLevel = 'info';
                    if (currentErrorCode !== "0") { logMsg += `, ErrorCode='${currentErrorCode}'`; logLevel = 'warn'; }
                    log(logMsg, logLevel); lastLoggedPercent = -1;
                } else if (percent !== null && percent % 10 === 0 && percent !== lastLoggedPercent) { log(`--> Progress Update: ${percent}%`, 'info'); lastLoggedPercent = percent;}
                lastState = state; lastStage = stage;
            } catch (accessError) { log(`Error accessing printer state in update handler: ${accessError.message}`, 'error'); }
        });
        log('   Event listeners attached OK.');


        // 2. Connect to Printer (MQTT)
        log('\n[2] Attempting MQTT connection to printer...');
        await printer.connect();
        if (exitFlag.exiting) return;
        log('   MQTT connection attempt finished.');
        log('   Waiting 5 seconds for initial state synchronization...');
        await sleep(5000);
        if (exitFlag.exiting) return;
        try {
             const initialState = printer.get_state();
             log(`   Initial synchronization check - State: ${initialState}`, 'info');
        } catch(e) { log('   Could not get initial state after connect.', 'warn'); }


        // *** NEW SECTION 3: Check State, Recover using Verify Job if Needed ***
        let isReady = false;
        let attempts = 0;
        const maxAttempts = 2; // Only try recovery once or twice

        while (!isReady && attempts < maxAttempts && !exitFlag.exiting) {
            attempts++;
            log(`\n[3] Attempt #${attempts}: Checking printer readiness...`);
            let currentState = printer.get_state();
            let currentErrorCodeCheck = printer.mqtt_dump()?.print?.print_error || "0";

            log(`   Current Status: State='${currentState}', ErrorCode='${currentErrorCodeCheck}'`);

            if (currentState === GcodeState.IDLE || currentState === GcodeState.FINISH) {
                if (currentErrorCodeCheck === "0") {
                    log('   ✅ Printer is IDLE/FINISH and no error code. Ready to print.', 'info');
                    isReady = true;
                } else {
                     log(`   Printer is ${currentState} but error code ${currentErrorCodeCheck} is present. Attempting verify_job recovery...`, 'warn');
                     // Fall through to recovery logic
                }
            }

            // If not ready -> Try recovery (if state is FAILED or has error code)
            if (!isReady && (currentState === GcodeState.FAILED || currentErrorCodeCheck !== "0")) {
                 log(`   Printer state needs recovery. Attempting verify_job sequence...`, 'warn');

                 // 1. Send Stop first (Good practice)
                 log(`   Sending stop command...`);
                 if (typeof printer.stop_print === 'function') await printer.stop_print();
                 else log('   stop_print method not found.', 'warn');
                 await sleep(1000); if (exitFlag.exiting) break;

                 // 2. Send command to print verify_job.gcode
                 log(`   Sending command to print "${config.verifyJobRemoteName}"...`);
                 if (typeof printer.start_print !== 'function') {
                      log('   start_print method not found.', 'error'); break; // Major issue
                 }
                 // Send print command for verify job, useAms=false, no specific plate ID
                 const verifySent = await printer.start_print(config.verifyJobRemoteName, null, false);
                 if (!verifySent) {
                      log('   Failed to PUBLISH verify_job print command. Recovery might fail.', 'warn');
                      // Continue to wait state anyway
                 } else {
                      log('   verify_job print command PUBLISHED successfully.', 'info');
                 }

                 // 3. Wait for state to become IDLE (with timeout)
                 const recovered = await waitForState(printer, GcodeState.IDLE, 20000, exitFlag); // 20s timeout

                 if (recovered) {
                      log('   ✅ Printer recovered to IDLE state after verify_job!', 'info');
                      isReady = true; // Success! Exit the while loop.
                 } else {
                      log(`   Printer did not reach IDLE state after verify_job attempt (State: ${printer.get_state()}).`, 'warn');
                      if(attempts < maxAttempts) log(`   Will retry check/recovery (Attempt ${attempts+1})...`, 'warn');
                      else log('   Max recovery attempts reached.', 'error');
                 }

            } else if (!isReady) {
                 // State wasn't FAILED/IDLE/FINISH (e.g., RUNNING, PAUSED)
                 log(`   Printer is busy (State: '${currentState}'). Cannot start new print now. Waiting...`, 'warn');
                 await sleep(5000); // Wait longer before next check if busy
            }
        } // End while loop

        // Final Check after loop
        if (!isReady) {
             throw new Error(`Printer did not become ready after ${maxAttempts} attempts. Final state: ${printer.get_state()}`);
        }
        if (exitFlag.exiting) return;


        // *** Step 4: Send Actual Print Command ***
        log(`\n[4] Sending 'start_print' command for actual job via MQTT...`);
        log(`   File: "${config.filename}", Use AMS: ${config.useAms}`);
        const commandSentSuccess = await printer.start_print(config.filename, null, config.useAms);
        if (exitFlag.exiting) return;
        if (commandSentSuccess) log('   ✅ Print command sent successfully!', 'info');
        else log('   ❌ Failed to send print command.', 'error');


        // *** Step 5: Monitor Printer State ***
        log(`\n[5] Monitoring printer state changes for ${config.monitorSeconds} seconds...`);
        log(`   (Using MQTT 'update' events for status)`);
        const monitorEndTime = Date.now() + config.monitorSeconds * 1000;
        let checks = 0;

        // Rely on the update listener for logging status changes
        while (Date.now() < monitorEndTime && !exitFlag.exiting) {
            // Check if print finished or failed based on last known state from listener
            // Only break early if a failure occurs during monitoring
            if (lastState === GcodeState.FAILED) {
                log(`   Print failed during monitoring (State: ${lastState}). Stopping monitor early.`, 'error');
                process.exitCode = 1; // Indicate error
                break;
            }
            // Allow loop to continue if state is FINISH, waiting for PREPARE/RUNNING or timeout
            await sleep(1000); // Simple wait, listener does the work
            checks++;
            log(`   [Monitor loop check #${checks}]`, 'debug'); // Debug log for loop activity
        }

         if(exitFlag.exiting) { log('[Monitor] Monitoring interrupted by exit signal.', 'warn'); }
         else if (Date.now() >= monitorEndTime) { log('[Monitor] Monitoring time elapsed.', 'info'); }

        log('\n[6] Monitoring finished or print ended.', 'info'); // Renumber step
         try { log(`   Final observed state: State='${lastState}', Stage='${lastStage}'`, 'info');} // Use state from listener
         catch(e) { log("   Could not get final state details.", 'warn');}


    } catch (error) {
         if (!exitFlag.exiting) {
             log(`\n[FATAL ERROR] Script execution failed: ${error.message}`, 'error');
             if (config.debug && error.stack) { console.error(error.stack); }
              process.exitCode = 1;
         }
    } finally {
        // *** Step 7: Disconnect ***
         if (printer && !exitFlag.exiting) { log('\n[7] Disconnecting MQTT client (Final Cleanup)...', 'info'); try { printer.disconnect(); } catch (e) { log(`   Disconnect error: ${e.message}`, 'error');}} // Renumber step
         else if (!printer && !exitFlag.exiting) { log('\n[7] Printer client not initialized, skipping disconnect.', 'warn'); }
         else if (exitFlag.exiting && printer) { log('\n[7] Disconnect initiated by SIGINT handler.', 'info');}
        log('\n====================================================', 'info');
        log('=== Test Finished ===', 'info');
        log('====================================================', 'info');
        if(!exitFlag.exiting) { const exitCode = process.exitCode || 0; if (exitCode === 1) log("Exited with error code 1.", 'warn'); process.exit(exitCode);}
    }
} // End main function

// --- Run Script ---
main(); // Invoke main function