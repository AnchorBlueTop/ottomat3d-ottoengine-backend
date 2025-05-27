// src/scripts/monitor-bambu-state.js

// --- Dependencies ---
const { Printer, GcodeState } = require('../bambulabs-api/index.js'); // Use the main package export
const minimist = require('minimist');

// --- Configuration ---
// Define DEFAULT_CONFIG for the printer you want to monitor
// Make sure only one block is uncommented!

// // --- A1 Config ---
// DEFAULT_CONFIG = { ip: '192.168.68.65', serial: '03919C461900537', accessCode: '48185909' };
// // --- A1-Mini Config ---
// const DEFAULT_CONFIG = { ip: '192.168.68.59', serial: '0309EA470200493', accessCode: '14306442' };
// // --- P1S Config ---
// const DEFAULT_CONFIG = { ip: '192.168.68.68', serial: '01P00A431300066', accessCode: '31863230' };
// // --- P1P Config ---
const DEFAULT_CONFIG = { ip: '192.168.68.58', serial: '01S00C371700385', accessCode: '14358945' };
// --- X1-C Config ---
// const DEFAULT_CONFIG = { ip: '192.168.68.67', serial: '00M09D492600293', accessCode: 'f6a1ae72' };


// --- Command Line Argument Parsing ---
const args = minimist(process.argv.slice(2));

const config = {
    ip: args.ip || DEFAULT_CONFIG.ip,
    serial: args.serial || DEFAULT_CONFIG.serial,
    accessCode: args.accesscode || args.accessCode || DEFAULT_CONFIG.accessCode,
    debug: args.debug === 'true' || false
};

// --- Logger ---
function log(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    if (level === 'error') { console.error(`[${timestamp} ${level.toUpperCase()}] ${message}`); }
    else if (level === 'warn') { console.warn(`[${timestamp} ${level.toUpperCase()}] ${message}`); }
    else if (level === 'debug' && config.debug) { console.log(`[${timestamp} ${level.toUpperCase()}] ${message}`); }
    else if (level === 'info') { console.log(`[${timestamp} ${level.toUpperCase()}] ${message}`); }
}

// --- Main Monitoring Function ---
async function monitorPrinter() {
    log('====================================================');
    log('=== BambuLab State Monitor ===');
    log('====================================================');
    log(`Monitoring Printer IP: ${config.ip}`);
    log(`Serial No:           ${config.serial}`);
    log(`Access Code:         ${config.accessCode ? config.accessCode.substring(0, 2) + '...' : 'N/A'}`);
    log(`Debug Mode:          ${config.debug}`);
    log('----------------------------------------------------');
    log('Press Ctrl+C to stop monitoring.');

    let printer = null; // Initialize printer to null
    let isExiting = false;

    // --- Signal Handler for Ctrl+C ---
    process.on('SIGINT', async () => {
        if (isExiting) return;
        isExiting = true;
        log('\n\n[INTERRUPT] Ctrl+C detected. Shutting down monitor...', 'warn');
        if (printer && printer.is_connected()) { // Check if printer exists and is connected
            log('[INTERRUPT] Disconnecting MQTT client...', 'info');
            try { await printer.disconnect(); } catch (e) { log(`Disconnect error: ${e.message}`, 'error'); }
        } else {
            log('[INTERRUPT] MQTT client not connected or initialized.', 'warn');
        }
        log('[INTERRUPT] Exiting monitor.', 'info');
        process.exit(0);
    });

    try {
        // 1. Initialize Printer Client
        log('\n[1] Initializing printer client...');
        if (!config.serial || !config.accessCode || !config.ip) {
            throw new Error("Missing required config: ip, accessCode, and serial are required.");
        }
        // *** Assign to the printer variable declared outside ***
        printer = new Printer({
            ip: config.ip,
            serial: config.serial,
            accessCode: config.accessCode,
            debug: config.debug // Pass debug flag down
        });
        log('   Printer client initialized OK.');


        // 2. Setup Event Listeners (Focus on state/status)
        log('\n[2] Setting up event listeners...');
        let lastState = null;
        let lastStage = null;
        let lastErrorCode = "0"; // Track last error code
        let lastLoggedPercent = -1; // Track last logged progress percentage

        // *** Check printer exists before setting listeners ***
        if (!printer) {
             throw new Error("Printer object was not initialized before setting listeners.");
        }

        printer.on('mqtt_connect', () => log('[EVENT] >>> MQTT Connected <<<', 'info'));
        printer.on('mqtt_close', () => { log('[EVENT] <<< MQTT Closed >>> (Will attempt reconnect if unexpected)', 'warn'); lastState = null; lastStage = null; lastErrorCode = "0"; lastLoggedPercent = -1; });
        printer.on('mqtt_error', (err) => log(`[EVENT] !!! MQTT Error: ${err.message || err}`, 'error'));

        // Update handler using the printer instance
        printer.on('update', (data) => {
            if (isExiting || !printer) return; // Don't log if exiting or printer is somehow null

            try {
                const state = printer.get_state();
                const stage = printer.get_current_stage();
                const bedTemp = printer.get_bed_temperature()?.toFixed(1) ?? 'N/A';
                const nozzleTemp = printer.get_nozzle_temperature()?.toFixed(1) ?? 'N/A';
                const percent = printer.get_percentage(); // Get as number or null
                const remainingTime = printer.get_time() ?? 'N/A';
                const currentErrorCode = data?.print?.print_error || "0"; // Default to "0" string

                const percentStr = percent === null ? 'N/A' : `${percent}%`; // Format percentage for logging

                // Log if state, stage, or error code changes, or always in debug
                if (state !== lastState || stage !== lastStage || currentErrorCode !== lastErrorCode || config.debug) {
                    let logMsg = `--> Status: State='${state}', Stage='${stage}', Bed=${bedTemp}C, Nozzle=${nozzleTemp}C, Progress=${percentStr}, Remain=${remainingTime}m`;
                    if (currentErrorCode !== "0") {
                        logMsg += `, ErrorCode='${currentErrorCode}'`;
                        log(logMsg, 'warn'); // Log errors/warnings clearly
                    } else {
                        log(logMsg, 'info'); // Log normal status as INFO
                    }
                     // Reset progress log tracking when state/stage/error changes
                    lastLoggedPercent = -1;
                } else if (percent !== null && percent % 10 === 0 && percent !== lastLoggedPercent) {
                    // Log every 10% progress that hasn't just been logged
                    log(`--> Progress Update: ${percent}%`, 'info');
                    lastLoggedPercent = percent; // Track last logged %
                }

                // Update tracked values for next comparison
                lastState = state;
                lastStage = stage;
                lastErrorCode = currentErrorCode;
            } catch (accessError) {
                // Catch errors if trying to access properties on a potentially null 'printer' object (though unlikely here)
                log(`Error accessing printer state in update handler: ${accessError.message}`, 'error');
            }
        });

        log('   Event listeners attached OK.');


        // 3. Connect and Keep Alive
        log('\n[3] Connecting to printer via MQTT...');
        await printer.connect();
        // Check if interrupted during connection
        if (isExiting) return;

        log('   Connection established. Monitoring indefinitely...');
        log('   Start a print via Bambu Studio/Handy App/Touchscreen to observe changes.');

        // Keep the script running until Ctrl+C
        await new Promise(() => { /* Keep running forever */ });


    } catch (error) {
        if (!isExiting) {
            log(`\n[FATAL ERROR] Script execution failed: ${error.message}`, 'error');
            if (config.debug && error.stack) { console.error(error.stack); }
            process.exitCode = 1;
        }
    } finally {
        log('\n====================================================', 'info');
        log('=== Monitor Script Ending ===', 'info');
        log('====================================================', 'info');
        // SIGINT handler calls process.exit, so no need to call it here
        // unless the main loop somehow exited without SIGINT (very unlikely with the infinite promise)
        if(!isExiting) {
            process.exit(process.exitCode || 0);
        }
    }
}

// --- Run Script ---
monitorPrinter();