// src/utils/rackStateManager.js
// Utilities for managing rack state and interfacing with storage systems

const { dbGet, dbAll } = require('../db/utils');
const logger = require('./logger');

class RackStateManager {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 second default cache
        this.activeCacheTimeout = 5000; // 5 second cache during active operations
    }

    /**
     * Get current rack state with intelligent caching
     * @param {number} rackId - Rack ID to get state for
     * @param {boolean} isActiveOperation - Whether this is during active orchestration
     * @returns {Promise<Object>} - Rack state object
     */
    async getRackState(rackId, isActiveOperation = false) {
        const cacheKey = `rack_${rackId}`;
        const cached = this.cache.get(cacheKey);
        const timeout = isActiveOperation ? this.activeCacheTimeout : this.cacheTimeout;
        
        if (cached && (Date.now() - cached.timestamp) < timeout) {
            logger.debug(`[RackStateManager] Using cached state for rack ${rackId}`);
            return cached.state;
        }
        
        // Fetch fresh state from database
        const freshState = await this._fetchRackStateFromDatabase(rackId);
        
        this.cache.set(cacheKey, {
            state: freshState,
            timestamp: Date.now()
        });
        
        logger.debug(`[RackStateManager] Fetched fresh state for rack ${rackId}`);
        return freshState;
    }

    /**
     * Fetch rack state from database
     * @param {number} rackId - Rack ID
     * @returns {Promise<Object>} - Rack state
     */
    async _fetchRackStateFromDatabase(rackId) {
        try {
            // Get all slots for this rack
            const slots = await dbAll(
                'SELECT slot_number, occupied, print_job_id FROM rack_slots WHERE storage_rack_id = ? ORDER BY slot_number',
                [rackId]
            );

            const rackState = {};
            
            for (const slot of slots) {
                const slotNumber = slot.slot_number;
                
                if (slot.occupied) {
                    rackState[slotNumber] = 'occupied';
                } else {
                    // Check if this is an empty plate slot (typically slots 1-2)
                    if (slotNumber <= 2) {
                        rackState[slotNumber] = 'empty_plate';
                    } else {
                        rackState[slotNumber] = 'empty';
                    }
                }
            }

            logger.debug(`[RackStateManager] Fetched rack ${rackId} state:`, rackState);
            return rackState;
            
        } catch (error) {
            logger.error(`[RackStateManager] Error fetching rack state for rack ${rackId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get rack configuration details
     * @param {number} rackId - Rack ID
     * @returns {Promise<Object>} - Rack configuration
     */
    async getRackConfiguration(rackId) {
        try {
            const rack = await dbGet(
                'SELECT * FROM storage_racks WHERE id = ?',
                [rackId]
            );

            if (!rack) {
                throw new Error(`Rack with ID ${rackId} not found`);
            }

            return {
                id: rack.id,
                name: rack.name,
                shelf_count: rack.shelf_count,
                shelf_spacing_mm: rack.shelf_spacing_mm || 80, // Default to 80mm
                bed_size: rack.bed_size
            };
        } catch (error) {
            logger.error(`[RackStateManager] Error fetching rack configuration for rack ${rackId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get printer's assigned rack ID
     * @param {number} printerId - Printer ID
     * @returns {Promise<number>} - Rack ID assigned to this printer
     */
    async getPrinterRackAssignment(printerId) {
        try {
            // For now, assume a simple mapping - in the future this could be more sophisticated
            // You might want to add a printer_rack_assignments table
            
            // Simple fallback: use the first available rack or create default mapping
            const firstRack = await dbGet('SELECT id FROM storage_racks ORDER BY id LIMIT 1');
            
            if (!firstRack) {
                throw new Error('No storage racks available in system');
            }

            logger.debug(`[RackStateManager] Printer ${printerId} assigned to rack ${firstRack.id}`);
            return firstRack.id;
            
        } catch (error) {
            logger.error(`[RackStateManager] Error getting printer rack assignment for printer ${printerId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all queued jobs for a specific printer
     * @param {number} printerId - Printer ID
     * @returns {Promise<Array>} - Array of queued jobs with slot assignments
     */
    async getQueuedJobsForPrinter(printerId) {
        try {
            const jobs = await dbAll(`
                SELECT pj.*, pi.max_z_height_mm
                FROM print_jobs pj
                LEFT JOIN print_items pi ON pj.print_item_id = pi.id
                WHERE pj.printer_id = ? 
                AND pj.status IN ('QUEUED', 'PRINTING')
                AND pj.orchestration_status IN ('waiting', 'printing')
                ORDER BY pj.priority ASC, pj.submitted_at ASC
            `, [printerId]);

            logger.debug(`[RackStateManager] Found ${jobs.length} queued jobs for printer ${printerId}`);
            return jobs;
            
        } catch (error) {
            logger.error(`[RackStateManager] Error getting queued jobs for printer ${printerId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Simulate rack state after executing a list of jobs
     * @param {Object} currentState - Current rack state
     * @param {Array} jobs - Jobs to simulate
     * @returns {Object} - Simulated future rack state
     */
    simulateJobExecution(currentState, jobs) {
        const futureState = { ...currentState };
        
        for (const job of jobs) {
            // Simulate grab operation
            if (job.assigned_grab_slot) {
                futureState[job.assigned_grab_slot] = 'empty';
            }
            
            // Simulate store operation
            if (job.assigned_store_slot) {
                futureState[job.assigned_store_slot] = 'occupied';
            }
        }
        
        logger.debug('[RackStateManager] Simulated future rack state:', futureState);
        return futureState;
    }

    /**
     * Invalidate cache for specific rack
     * @param {number} rackId - Rack ID to invalidate
     */
    invalidateCache(rackId) {
        const cacheKey = `rack_${rackId}`;
        this.cache.delete(cacheKey);
        logger.debug(`[RackStateManager] Invalidated cache for rack ${rackId}`);
    }

    /**
     * Invalidate all cached rack states
     */
    invalidateAllCaches() {
        this.cache.clear();
        logger.debug('[RackStateManager] Invalidated all rack state caches');
    }

    /**
     * Find jobs that would be affected by a specific slot change
     * @param {number} rackId - Rack ID
     * @param {number} slotId - Slot number that changed
     * @param {string} previousState - Previous slot state
     * @param {string} newState - New slot state  
     * @returns {Promise<Array>} - Jobs that might be affected
     */
    async findJobsAffectedBySlotChange(rackId, slotId, previousState, newState) {
        try {
            const affectedJobs = [];
            
            // Query active jobs using this rack
            const activeJobs = await dbAll(`
                SELECT id, assigned_rack_id, assigned_store_slot, assigned_grab_slot, 
                       orchestration_status, max_z_height_mm
                FROM print_jobs 
                WHERE assigned_rack_id = ? 
                AND status IN ('QUEUED', 'PRINTING')
                AND orchestration_status IN ('waiting', 'printing', 'ejecting')
            `, [rackId]);
            
            for (const job of activeJobs) {
                // Check for store conflicts (planned to store but slot now occupied)
                if (job.assigned_store_slot === slotId && 
                    previousState === 'empty' && 
                    newState === 'occupied') {
                    
                    affectedJobs.push({
                        ...job,
                        conflictType: 'store_destination_occupied',
                        conflictedSlot: slotId
                    });
                }
                
                // Check for grab conflicts (planned to grab but slot now empty)
                if (job.assigned_grab_slot === slotId && 
                    previousState === 'occupied' && 
                    newState === 'empty') {
                    
                    affectedJobs.push({
                        ...job,
                        conflictType: 'grab_source_empty',
                        conflictedSlot: slotId
                    });
                }
            }
            
            return affectedJobs;
            
        } catch (error) {
            logger.error(`[RackStateManager] Error finding affected jobs: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new RackStateManager();