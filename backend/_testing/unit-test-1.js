#!/usr/bin/env node

/**
 * OttoStudio Test Setup Script
 * Automatically configures the system with printers, ottoejects, racks, and print jobs
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/api';

// Color output helpers
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
    log(`\n[${step}] ${message}`, colors.cyan + colors.bright);
}

function logSuccess(message) {
    log(`✓ ${message}`, colors.green);
}

function logError(message) {
    log(`✗ ${message}`, colors.red);
}

function logWarning(message) {
    log(`⚠ ${message}`, colors.yellow);
}

// Configuration
const config = {
    printer: {
        name: "My_P1P",
        brand: "Bambu Lab",
        model: "P1P",
        type: "FDM",
        ip_address: "192.168.68.66",
        access_code: "22945061",
        serial_number: "01S00C371700385"
    },
    ottoeject: {
        device_name: "OttoEject-Mk1",
        ip_address: "192.168.68.65"
    },
    ottorack: {
        name: "Rack A",
        number_of_shelves: 6,
        shelf_spacing_mm: 80,
        bed_size: "256x256"
    },
    printFiles: [
        "/Users/harshilpatel/Desktop/Projects/MCP/sd-card/OTTO_LOGO_P1P_PLA_V1.gcode.3mf",
        "/Users/harshilpatel/Desktop/Projects/MCP/sd-card/ottologov1.gcode.3mf"
    ]
};

// Helper to make API calls with error handling
async function apiCall(method, endpoint, data = null, isFormData = false) {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            timeout: 30000
        };

        if (data) {
            if (isFormData) {
                config.data = data;
                config.headers = data.getHeaders();
            } else {
                config.data = data;
                config.headers = { 'Content-Type': 'application/json' };
            }
        }

        const response = await axios(config);
        return { success: true, data: response.data };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || error.message,
            status: error.response?.status
        };
    }
}

// Test script execution
async function runTestSetup() {
    log('\n' + '='.repeat(60), colors.bright);
    log('🚀 OttoStudio Test Setup Script', colors.bright + colors.blue);
    log('='.repeat(60), colors.bright);

    let printerId, ottoejectId, ottorackId;
    const printItemIds = [];

    try {
        // Step 1: Create Printer
        logStep('1/9', 'Creating printer...');
        const printerResult = await apiCall('POST', '/printers', config.printer);
        if (printerResult.success) {
            printerId = printerResult.data.id;
            logSuccess(`Printer created with ID: ${printerId}`);
            log(`   Name: ${config.printer.name} (${config.printer.brand} ${config.printer.model})`);
        } else {
            logError(`Failed to create printer: ${printerResult.error}`);
            if (printerResult.status !== 409) throw new Error('Printer creation failed');
            logWarning('Printer may already exist, continuing...');
            printerId = 1; // Assume existing printer has ID 1
        }

        // Step 2: Create OttoEject
        logStep('2/9', 'Creating OttoEject...');
        const ottoejectResult = await apiCall('POST', '/ottoeject', config.ottoeject);
        if (ottoejectResult.success) {
            ottoejectId = ottoejectResult.data.id;
            logSuccess(`OttoEject created with ID: ${ottoejectId}`);
            log(`   Name: ${config.ottoeject.device_name} @ ${config.ottoeject.ip_address}`);
        } else {
            logError(`Failed to create OttoEject: ${ottoejectResult.error}`);
            if (ottoejectResult.status !== 409) throw new Error('OttoEject creation failed');
            logWarning('OttoEject may already exist, continuing...');
            ottoejectId = 1;
        }

        // Step 3: Create OttoRack
        logStep('3/9', 'Creating OttoRack...');
        const ottorackResult = await apiCall('POST', '/ottoracks', config.ottorack);
        if (ottorackResult.success) {
            ottorackId = ottorackResult.data.id;
            logSuccess(`OttoRack created with ID: ${ottorackId}`);
            log(`   Name: ${config.ottorack.name} (${config.ottorack.number_of_shelves} shelves, ${config.ottorack.shelf_spacing_mm}mm spacing)`);
        } else {
            logError(`Failed to create OttoRack: ${ottorackResult.error}`);
            if (ottorackResult.status !== 409) throw new Error('OttoRack creation failed');
            logWarning('OttoRack may already exist, continuing...');
            ottorackId = 1;
        }

        // Step 4-6: Configure shelves with empty plates
        logStep('4-6/9', 'Configuring shelves 1-3 with empty plates...');
        for (let shelfNum = 1; shelfNum <= 3; shelfNum++) {
            const shelfData = {
                has_plate: true,
                plate_state: "empty",
                print_job_id: null
            };
            const shelfResult = await apiCall('PUT', `/ottoracks/${ottorackId}/shelves/${shelfNum}`, shelfData);
            if (shelfResult.success) {
                logSuccess(`Shelf ${shelfNum}: Empty plate configured`);
            } else {
                logWarning(`Shelf ${shelfNum}: ${shelfResult.error}`);
            }
        }

        // Step 7-8: Upload print files and create jobs
        for (let i = 0; i < config.printFiles.length; i++) {
            const filePath = config.printFiles[i];
            const stepNum = 7 + (i * 2);

            // Add delay before second print job to prevent race conditions
            if (i === 1) {
                logStep('DELAY', 'Waiting 5 seconds before submitting second job...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                logSuccess('Delay complete, continuing...');
            }

            // Upload file
            logStep(`${stepNum}/9`, `Uploading print file ${i + 1}...`);

            if (!fs.existsSync(filePath)) {
                logError(`File not found: ${filePath}`);
                logWarning('Skipping this print job...');
                continue;
            }

            const form = new FormData();
            form.append('file', fs.createReadStream(filePath));

            const uploadResult = await apiCall('POST', '/print-jobs/upload', form, true);
            if (uploadResult.success) {
                const printItemId = uploadResult.data.print_item_id;
                printItemIds.push(printItemId);
                logSuccess(`File uploaded, print_item_id: ${printItemId}`);
                log(`   File: ${path.basename(filePath)}`);
            } else {
                logError(`Failed to upload file: ${uploadResult.error}`);
                continue;
            }

            // Create print job
            logStep(`${stepNum + 1}/9`, `Creating print job ${i + 1}...`);
            const jobData = {
                print_item_id: printItemIds[i],
                printer_id: printerId,
                ottoeject_id: ottoejectId,
                auto_start: true,
                priority: 1
            };

            const jobResult = await apiCall('POST', '/print-jobs', jobData);
            if (jobResult.success) {
                logSuccess(`Print job created with ID: ${jobResult.data.id}`);
                log(`   Status: ${jobResult.data.status}, Auto-start: ${jobResult.data.auto_start ? 'Yes' : 'No'}`);
            } else {
                logError(`Failed to create print job: ${jobResult.error}`);
            }
        }

        // Summary
        log('\n' + '='.repeat(60), colors.bright);
        log('✅ Test Setup Complete!', colors.green + colors.bright);
        log('='.repeat(60), colors.bright);
        log('\nSystem Configuration:');
        log(`  • Printer ID: ${printerId}`);
        log(`  • OttoEject ID: ${ottoejectId}`);
        log(`  • OttoRack ID: ${ottorackId}`);
        log(`  • Print Jobs Created: ${printItemIds.length}`);
        log('\nNext Steps:');
        log('  1. Monitor backend logs for orchestration activity');
        log('  2. Check job status: GET /api/print-jobs');
        log('  3. View orchestrator status: GET /api/orchestrator/status');
        log('  4. Monitor rack state: GET /api/ottoracks/1\n');

    } catch (error) {
        log('\n' + '='.repeat(60), colors.bright);
        logError('❌ Test Setup Failed!');
        log('='.repeat(60), colors.bright);
        logError(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    runTestSetup().catch(error => {
        logError(`Unexpected error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { runTestSetup };
