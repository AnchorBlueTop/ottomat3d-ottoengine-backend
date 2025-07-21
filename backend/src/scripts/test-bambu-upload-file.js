// src/scripts/test-bambu-upload-file.js

// --- Dependencies ---
// Import the main Printer class from the package index
const { Printer } = require('../bambulabs-api/index.js'); // Adjust path if your script is not in src/scripts/
const minimist = require('minimist');
const fs = require('fs').promises; // Use promises version of fs
const path = require('path');

// --- A1 Configuration ---
// Default values - can be overridden by command-line arguments
// const DEFAULT_CONFIG = {
//     ip: '192.168.68.65',         // Default to A1 IP
//     serial: '03919C461900537',   // Default to A1 Serial
//     accessCode: '48185909',     // Default to A1 Access Code
//     localfile: './Cube10.gcode.3mf' // Default LOCAL file path TO UPLOAD (relative to where you run node)
// };

// --- A1-MINI Configuration ---
// Default values - can be overridden by command-line arguments
// const DEFAULT_CONFIG = {
//     ip: '192.168.68.59',         // Default to A1-MINI IP
//     serial: '0309EA470200493',   // Default to A1-MINI Serial
//     accessCode: '14306442',     // Default to A1-MINI Access Code
//     localfile: './verify_job.gcode' // Default LOCAL file path TO UPLOAD (relative to where you run node)
// };

// --- P1S Configuration ---
// Default values - can be overridden by command-line arguments
const DEFAULT_CONFIG = {
    ip: '192.168.68.64',         // Default to P1S IP
    serial: '01P00A431300066',   // Default to P1S Serial
    accessCode: '31863230',     // Default to P1S Access Code
    localfile: './phonestand.gcode.3mf' // Default LOCAL file path TO UPLOAD (relative to where you run node)
};

// --- P1P Configuration ---
// Default values - can be overridden by command-line arguments
// const DEFAULT_CONFIG = {
//     ip: '192.168.68.52',         // Default to P1P IP
//     serial: '01S00C371700385',   // Default to P1P Serial
//     accessCode: '14358945',     // Default to P1P Access Code
//     localfile: './Cube10.gcode.3mf' // Default LOCAL file path TO UPLOAD (relative to where you run node)
// };

// --- X1-C Configuration ---
// Default values - can be overridden by command-line arguments
// const DEFAULT_CONFIG = {
//     ip: '192.168.68.67',         // Default to X1-C IP
//     serial: '00M09D492600293',   // Default to X1-C Serial
//     accessCode: 'f6a1ae72',     // Default to X1-C Access Code
//     localfile: './Cube10.gcode.3mf' // Default LOCAL file path TO UPLOAD (relative to where you run node)
// };

// --- Command Line Argument Parsing ---
const args = minimist(process.argv.slice(2));

// Resolve the local file path relative to the current working directory
const localFilePath = path.resolve(process.cwd(), args.localfile || DEFAULT_CONFIG.localfile);

const config = {
    ip: args.ip || DEFAULT_CONFIG.ip,
    serial: args.serial || DEFAULT_CONFIG.serial, // Serial IS required by the Printer class constructor
    accessCode: args.accesscode || args.accessCode || DEFAULT_CONFIG.accessCode, // Allow 'accesscode' or 'accessCode'
    localfile: localFilePath,
    // Optional: Specify a different name for the file on the printer
    remotefilename: args.remotefilename || path.basename(localFilePath),
    debug: args.debug === 'true' || false // Handle debug flag
};

// --- Helper Function ---
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Main Function ---
async function main() {
    console.log('=== Test BambuLab Upload File ===');
    console.log(`Target IP:        ${config.ip}`);
    console.log(`Serial No:        ${config.serial}`); // Log the serial being used
    console.log(`Access Code:      ${config.accessCode ? config.accessCode.substring(0, 2) + '...' : 'N/A'}`); // Mask access code
    console.log(`Local File:       ${config.localfile}`);
    console.log(`Remote Filename:  ${config.remotefilename}`);
    console.log(`Debug Mode:       ${config.debug}`);
    console.log('------------------------------------------');

    let printer;

    try {
        // 0. Check if local file exists
        console.log('\n[0] Checking if local file exists...');
        try {
            await fs.access(config.localfile, fs.constants.R_OK); // Check read access
            console.log(`   Local file "${config.localfile}" found.`);
        } catch (fileError) {
             console.error(`   Error: Local file "${config.localfile}" not found or not readable.`);
             throw fileError; // Stop execution
        }

        // 1. Initialize Printer Client
        console.log('\n[1] Initializing printer client...');
        // *** The Printer class constructor REQUIRES the serial number ***
        if (!config.serial) {
             throw new Error("Serial number argument (--serial) is required for the Printer class.");
        }
        printer = new Printer({
            ip: config.ip,
            serial: config.serial, // Pass serial
            accessCode: config.accessCode,
            debug: config.debug // Pass debug flag to Printer class constructor
        });

        // Setup event listeners for FTP (MQTT listeners less relevant here)
        printer.on('ftp_connect', () => console.log('[EVENT] FTP Connected'));
        printer.on('ftp_close', () => console.log('[EVENT] FTP Closed'));
        printer.on('ftp_error', (err) => console.error('[EVENT] FTP Error:', err.message || err));
        printer.on('upload_progress', (info) => {
            const percent = info.fileSize > 0 ? ((info.bytesOverall / info.fileSize) * 100).toFixed(1) : 0;
            // Only log progress if debug is not enabled (to avoid excessive logging from basic-ftp)
            if (!config.debug) {
                 console.log(`[EVENT] Upload Progress: ${info.bytesOverall} / ${info.fileSize} bytes (${percent}%)`);
            }
        });

        // 2. Upload File Command
        console.log(`\n[2] Attempting to upload "${config.localfile}" as "${config.remotefilename}"...`);

        // Call the upload function on the main Printer instance
        const uploadResponse = await printer.upload_file(config.localfile, config.remotefilename); // Capture the response

        console.log('   Raw upload response received by script:', uploadResponse); // Log the response object

        // Check the response object
        if (uploadResponse && typeof uploadResponse.code === 'number' && uploadResponse.code >= 200 && uploadResponse.code < 300) {
            console.log('   ✅ File uploaded successfully! (Script Check Passed)');
            // Log the response from the server
            console.log(`   Server Response: ${uploadResponse.code} ${uploadResponse.message}`);

            // Optional: Verify by listing files
            console.log('\n[3] Verifying by listing remote files...');
            await sleep(1000); // Give printer a moment
            const files = await printer.list_files('/'); // List root directory
            if (files) {
                const found = files.find(f => f.name === config.remotefilename);
                if (found) {
                    console.log(`   ✅ Verification successful: Found "${found.name}" (Size: ${found.size} bytes)`);
                } else {
                     console.warn(`   ⚠️ Verification warning: Uploaded file "${config.remotefilename}" not found in root directory list.`);
                }
            } else {
                 console.warn('   ⚠️ Could not list remote files for verification.');
            }

        } else {
             // Handle cases where uploadResponse might be null or has non-success code
             const errorCode = uploadResponse?.code || 'N/A';
             const errorMsg = uploadResponse?.message || (uploadResponse === null ? 'Upload failed due to caught error in client' : 'Upload completed with non-success code or unexpected response');
            console.error(`   ❌ File upload check failed. Code: ${errorCode}, Message: ${errorMsg} (Script Check Failed)`);
            process.exitCode = 1; // Indicate script encountered an issue
        }

        console.log('\n[4] Upload process finished.');

    } catch (error) {
        console.error(`\n[FATAL ERROR] An error occurred during the script execution: ${error.message}`);
         if (config.debug && error.stack) {
            console.error(error.stack);
        }
        process.exitCode = 1; // Indicate script encountered an error
    } finally {
        // FTP client disconnects automatically within the upload_file method call in ftp-client.js
        // No explicit disconnect needed here unless we add persistent FTP connections later.
         console.log('\n[5] FTP client should have disconnected automatically.');

        console.log('\n=== Test Finished ===');
        // Ensure process exits with the correct code if set earlier
        if(process.exitCode === 1) {
            console.log("Exiting with error code 1 due to failures during execution.");
        }
    }
}

// --- Run Script ---
main();