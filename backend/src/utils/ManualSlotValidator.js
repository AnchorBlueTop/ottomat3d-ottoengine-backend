// src/utils/ManualSlotValidator.js
// Manual slot validation for user-specified store and grab locations
// Based on beta testing validation logic (rack_manager.py)

const { dbGet, dbAll } = require('../db/utils');
const logger = require('./logger');

class ManualSlotValidator {
    /**
     * Validate manual store and grab slot assignments for a new print job
     * Checks against current rack state and conflicts with queued/printing jobs
     */
    async validateJobAssignment(params) {
        const { printerId, rackId, storeSlot, grabSlot, excludeJobId = null } = params;

        const errors = [];

        try {
            // 1. Validate printer
            const printerValidation = await this._validatePrinter(printerId, excludeJobId);
            if (!printerValidation.valid) {
                errors.push(printerValidation.error);
            }

            // 2. Validate rack exists
            const rack = await dbGet('SELECT * FROM storage_racks WHERE id = ?', [rackId]);
            if (!rack) {
                errors.push(`Rack ${rackId} does not exist`);
                return { valid: false, errors };
            }

            // 3. Validate store slot
            const storeValidation = await this._validateStoreSlot(rackId, storeSlot, rack, excludeJobId);
            if (!storeValidation.valid) {
                errors.push(...storeValidation.errors);
            }

            // 4. Validate grab slot
            const grabValidation = await this._validateGrabSlot(rackId, grabSlot, rack, excludeJobId);
            if (!grabValidation.valid) {
                errors.push(...grabValidation.errors);
            }

            // 5. Check same-slot conflict
            if (storeSlot === grabSlot) {
                errors.push(`Cannot store and grab from the same slot ${storeSlot}`);
            }

            // 6. Skip conflict checking for manual mode
            // In manual mode, jobs run sequentially and the user controls the workflow
            // Conflict validation is not needed because:
            // - Jobs are queued and processed one at a time
            // - By the time Job 2 starts, Job 1 has released its slots
            // - User is responsible for understanding their workflow
            // const conflictValidation = await this._validateNoConflictsWithActiveJobs(
            //     rackId,
            //     storeSlot,
            //     grabSlot,
            //     excludeJobId
            // );
            // if (!conflictValidation.valid) {
            //     errors.push(...conflictValidation.errors);
            // }

            return {
                valid: errors.length === 0,
                errors
            };

        } catch (error) {
            logger.error('[ManualSlotValidator] Validation error:', error.message);
            return {
                valid: false,
                errors: [`Validation error: ${error.message}`]
            };
        }
    }

    /**
     * Validate printer exists and is not currently in use
     */
    async _validatePrinter(printerId, excludeJobId) {
        try {
            // Check printer exists
            const printer = await dbGet('SELECT * FROM printers WHERE id = ?', [printerId]);
            if (!printer) {
                return {
                    valid: false,
                    error: `Printer ${printerId} does not exist`
                };
            }

            // In manual mode, allow queuing multiple jobs for the same printer
            // Jobs will run sequentially, so no need to block based on printer status
            // const busyJob = await dbGet(
            //     `SELECT id, status FROM print_jobs
            //      WHERE printer_id = ?
            //      AND status = 'PRINTING'
            //      AND id != ?`,
            //     [printerId, excludeJobId || -1]
            // );
            //
            // if (busyJob) {
            //     return {
            //         valid: false,
            //         error: `Printer ${printerId} is currently printing Job ${busyJob.id}`
            //     };
            // }

            return { valid: true };

        } catch (error) {
            logger.error('[ManualSlotValidator] Printer validation error:', error.message);
            return {
                valid: false,
                error: `Printer validation failed: ${error.message}`
            };
        }
    }

    /**
     * Validate store slot is available and suitable
     */
    async _validateStoreSlot(rackId, slotNumber, rack, excludeJobId) {
        const errors = [];

        try {
            // Check slot number in valid range
            if (slotNumber < 1 || slotNumber > rack.shelf_count) {
                errors.push(`Store slot ${slotNumber} out of range (rack has ${rack.shelf_count} slots)`);
                return { valid: false, errors };
            }

            // Get current slot state
            const slot = await dbGet(
                'SELECT * FROM rack_slots WHERE storage_rack_id = ? AND slot_number = ?',
                [rackId, slotNumber]
            );

            if (!slot) {
                errors.push(`Store slot ${slotNumber} does not exist in rack ${rackId}`);
                return { valid: false, errors };
            }

            // Check if slot is occupied or reserved
            if (slot.occupied || slot.print_job_id) {
                // Check if it's reserved by the job we're updating (excludeJobId)
                if (slot.print_job_id === excludeJobId) {
                    // It's our own reservation, allow it
                    return { valid: true, errors: [] };
                }

                if (slot.print_job_id) {
                    errors.push(`Store slot ${slotNumber} is reserved for Job ${slot.print_job_id}`);
                } else {
                    errors.push(`Store slot ${slotNumber} is occupied`);
                }
            }

            // Check if slot has a plate with print (plate_state check)
            if (slot.has_plate && slot.plate_state === 'with_print') {
                errors.push(`Store slot ${slotNumber} has a completed print on it`);
            }

            // TODO: Add height clearance validation (check if blocked by prints below)
            // This would require loading print heights from database
            // For MVP, we skip this - user is responsible for clearance

            return {
                valid: errors.length === 0,
                errors
            };

        } catch (error) {
            logger.error('[ManualSlotValidator] Store slot validation error:', error.message);
            return {
                valid: false,
                errors: [`Store slot validation failed: ${error.message}`]
            };
        }
    }

    /**
     * Validate grab slot has an empty plate available
     */
    async _validateGrabSlot(rackId, slotNumber, rack, excludeJobId) {
        const errors = [];

        try {
            // Check slot number in valid range
            if (slotNumber < 1 || slotNumber > rack.shelf_count) {
                errors.push(`Grab slot ${slotNumber} out of range (rack has ${rack.shelf_count} slots)`);
                return { valid: false, errors };
            }

            // Get current slot state
            const slot = await dbGet(
                'SELECT * FROM rack_slots WHERE storage_rack_id = ? AND slot_number = ?',
                [rackId, slotNumber]
            );

            if (!slot) {
                errors.push(`Grab slot ${slotNumber} does not exist in rack ${rackId}`);
                return { valid: false, errors };
            }

            // Check if slot has a plate
            if (!slot.has_plate) {
                errors.push(`Grab slot ${slotNumber} has no plate to grab`);
            }

            // Check if plate is empty (not occupied with print)
            if (slot.has_plate && slot.plate_state !== 'empty') {
                errors.push(`Grab slot ${slotNumber} does not have an empty plate (state: ${slot.plate_state})`);
            }

            return {
                valid: errors.length === 0,
                errors
            };

        } catch (error) {
            logger.error('[ManualSlotValidator] Grab slot validation error:', error.message);
            return {
                valid: false,
                errors: [`Grab slot validation failed: ${error.message}`]
            };
        }
    }

    /**
     * Check for conflicts with other queued or printing jobs
     * Simulates future rack state considering pending jobs
     */
    async _validateNoConflictsWithActiveJobs(rackId, storeSlot, grabSlot, excludeJobId) {
        const errors = [];

        try {
            // Get all actively PRINTING jobs for this rack (QUEUED jobs will run sequentially and won't conflict)
            const activeJobs = await dbAll(
                `SELECT id, assigned_store_slot, assigned_grab_slot, status
                 FROM print_jobs
                 WHERE assigned_rack_id = ?
                 AND status = 'PRINTING'
                 AND id != ?
                 ORDER BY priority ASC, submitted_at ASC`,
                [rackId, excludeJobId || -1]
            );

            for (const job of activeJobs) {
                // Check if another job is storing to our store slot
                if (job.assigned_store_slot === storeSlot) {
                    errors.push(`Conflict: Job ${job.id} is already scheduled to store in slot ${storeSlot}`);
                }

                // Check if another job is grabbing from our store slot
                // This would mean they're taking the plate we need to be empty
                if (job.assigned_grab_slot === storeSlot) {
                    errors.push(`Conflict: Job ${job.id} will grab from slot ${storeSlot}, making it unavailable for storage`);
                }

                // Check if another job is storing to our grab slot
                // This would mean the plate we want to grab will have a print on it
                if (job.assigned_store_slot === grabSlot) {
                    errors.push(`Conflict: Job ${job.id} will store to slot ${grabSlot}, blocking the plate grab`);
                }

                // Check if another job is grabbing from our grab slot
                if (job.assigned_grab_slot === grabSlot) {
                    errors.push(`Conflict: Job ${job.id} will also grab from slot ${grabSlot}`);
                }
            }

            return {
                valid: errors.length === 0,
                errors
            };

        } catch (error) {
            logger.error('[ManualSlotValidator] Conflict validation error:', error.message);
            return {
                valid: false,
                errors: [`Conflict validation failed: ${error.message}`]
            };
        }
    }
}

module.exports = new ManualSlotValidator();
