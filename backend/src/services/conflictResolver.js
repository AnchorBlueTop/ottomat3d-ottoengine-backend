// src/services/conflictResolver.js
// Conflict Resolution Engine for OTTOMAT3D Orchestrator
// Handles automatic job reassignment when manual rack changes create conflicts

const logger = require('../utils/logger');
const AdvancedSlotManager = require('../utils/AdvancedSlotManager');
const { dbRun, dbGet, dbAll } = require('../db/utils');

class ConflictResolver {
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
        this.maxRetries = 3;
        this.resolutionTimeout = 60000; // 60 seconds
    }

    /**
     * Resolve a job conflict caused by manual rack changes
     * @param {Object} job - The affected print job with conflict info
     * @param {Object} eventPayload - The original rack state change event
     */
    async resolveJobConflict(job, eventPayload) {
        const conflictId = `${job.id}_${eventPayload.timestamp}`;
        
        // Prevent duplicate resolution attempts
        if (this.orchestrator.activeConflictResolutions.has(conflictId)) {
            logger.debug(`[ConflictResolver] Conflict resolution already in progress for job ${job.id}`);
            return;
        }
        
        this.orchestrator.activeConflictResolutions.add(conflictId);
        
        try {
            logger.warn(`[ConflictResolver] Resolving ${job.conflictType} conflict for job ${job.id} (slot ${job.conflictedSlot})`);
            
            let resolutionResult;
            
            switch (job.conflictType) {
                case 'store_destination_occupied':
                    resolutionResult = await this.resolveStoreConflict(job);
                    break;
                    
                case 'grab_source_empty':
                    resolutionResult = await this.resolveGrabConflict(job);
                    break;
                    
                default:
                    throw new Error(`Unknown conflict type: ${job.conflictType}`);
            }
            
            if (resolutionResult.resolved) {
                this.orchestrator.eventProcessingStats.conflicts_resolved++;
                this.orchestrator.eventProcessingStats.jobs_reassigned++;
                
                logger.info(`[ConflictResolver] Successfully resolved conflict for job ${job.id}: ${resolutionResult.summary}`);
                
                // Emit success event
                this.orchestrator.emit('conflictResolved', {
                    jobId: job.id,
                    conflictType: job.conflictType,
                    resolutionAction: resolutionResult.action,
                    oldSlot: job.conflictedSlot,
                    newSlot: resolutionResult.newSlot,
                    summary: resolutionResult.summary,
                    timestamp: new Date().toISOString()
                });
                
            } else {
                // Automatic resolution failed, pause job for manual intervention
                await this.pauseJobForManualResolution(job, resolutionResult.reason);
            }
            
        } catch (error) {
            logger.error(`[ConflictResolver] Failed to resolve conflict for job ${job.id}: ${error.message}`);
            await this.pauseJobForManualResolution(job, `Conflict resolution failed: ${error.message}`);
            
        } finally {
            this.orchestrator.activeConflictResolutions.delete(conflictId);
        }
    }

    /**
     * Resolve store conflict: Job planned to store to occupied slot
     */
    async resolveStoreConflict(job) {
        try {
            const rackId = job.assigned_rack_id;
            const currentRackState = await this.orchestrator.getCurrentRackState(rackId);
            const rackConfig = await this.getRackConfiguration(rackId);
            
            const slotManager = new AdvancedSlotManager(rackConfig);
            
            // Find alternative store slot using the print's height
            const printHeight = job.print_max_z_height_mm || job.max_z_height_mm || 50; // Default 50mm if unknown
            const alternativeSlot = slotManager.findOptimalSlot(printHeight, currentRackState);
            
            if (alternativeSlot.canFit) {
                // Update job with new slot assignment
                await dbRun(`
                    UPDATE print_jobs 
                    SET assigned_store_slot = ?,
                        effective_clearance_mm = ?,
                        slot_assignment_reason = ?
                    WHERE id = ?
                `, [
                    alternativeSlot.slot,
                    alternativeSlot.clearance,
                    `reassigned_due_to_manual_conflict_${new Date().toISOString()}`,
                    job.id
                ]);
                
                logger.info(`[ConflictResolver] Job ${job.id} store slot reassigned: ${job.assigned_store_slot} → ${alternativeSlot.slot} (${printHeight}mm print, ${alternativeSlot.clearance}mm clearance)`);
                
                return {
                    resolved: true,
                    action: 'reassign_store_slot',
                    newSlot: alternativeSlot.slot,
                    summary: `Store slot reassigned from ${job.assigned_store_slot} to ${alternativeSlot.slot} (${alternativeSlot.clearance}mm clearance)`
                };
            }
            
            // Cannot resolve automatically
            return {
                resolved: false,
                reason: `No alternative slot available for ${printHeight}mm print (max available clearance: ${this.getMaxAvailableClearance(currentRackState, slotManager)}mm)`
            };
            
        } catch (error) {
            logger.error(`[ConflictResolver] Error in resolveStoreConflict: ${error.message}`);
            throw error;
        }
    }

    /**
     * Resolve grab conflict: Job planned to grab from empty slot
     */
    async resolveGrabConflict(job) {
        try {
            const rackId = job.assigned_rack_id;
            const currentRackState = await this.orchestrator.getCurrentRackState(rackId);
            const rackConfig = await this.getRackConfiguration(rackId);
            
            const slotManager = new AdvancedSlotManager(rackConfig);
            
            // Find alternative grab source
            const alternativeGrabSlot = slotManager.findOptimalGrabSlot(currentRackState);
            
            if (alternativeGrabSlot && alternativeGrabSlot !== job.assigned_grab_slot) {
                // Update job with new grab slot
                await dbRun(`
                    UPDATE print_jobs 
                    SET assigned_grab_slot = ?,
                        slot_assignment_reason = ?
                    WHERE id = ?
                `, [
                    alternativeGrabSlot,
                    `grab_reassigned_due_to_manual_conflict_${new Date().toISOString()}`,
                    job.id
                ]);
                
                logger.info(`[ConflictResolver] Job ${job.id} grab slot reassigned: ${job.assigned_grab_slot} → ${alternativeGrabSlot}`);
                
                return {
                    resolved: true,
                    action: 'reassign_grab_slot',
                    newSlot: alternativeGrabSlot,
                    summary: `Grab slot reassigned from ${job.assigned_grab_slot} to ${alternativeGrabSlot}`
                };
            }
            
            // Check if we can use empty plate from slots 1-2 as fallback
            const emptyPlateSlots = [1, 2].filter(slot => 
                currentRackState[slot] === 'empty_plate' || currentRackState[slot] === 'empty'
            );
            
            if (emptyPlateSlots.length > 0) {
                const fallbackSlot = emptyPlateSlots[0];
                
                await dbRun(`
                    UPDATE print_jobs 
                    SET assigned_grab_slot = ?,
                        slot_assignment_reason = ?
                    WHERE id = ?
                `, [
                    fallbackSlot,
                    `fallback_to_empty_plate_due_to_conflict`,
                    job.id
                ]);
                
                logger.info(`[ConflictResolver] Job ${job.id} using empty plate fallback: slot ${fallbackSlot}`);
                
                return {
                    resolved: true,
                    action: 'fallback_to_empty_plate',
                    newSlot: fallbackSlot,
                    summary: `Using empty plate fallback in slot ${fallbackSlot}`
                };
            }
            
            return {
                resolved: false,
                reason: 'No alternative grab slot or empty plate available'
            };
            
        } catch (error) {
            logger.error(`[ConflictResolver] Error in resolveGrabConflict: ${error.message}`);
            throw error;
        }
    }

    /**
     * Pause a job for manual resolution when automatic resolution fails
     */
    async pauseJobForManualResolution(job, reason) {
        try {
            await dbRun(`
                UPDATE print_jobs 
                SET orchestration_status = 'paused',
                    slot_assignment_reason = ?
                WHERE id = ?
            `, [`manual_resolution_required: ${reason}`, job.id]);
            
            this.orchestrator.eventProcessingStats.conflicts_failed++;
            this.orchestrator.eventProcessingStats.jobs_paused++;
            
            logger.error(`[ConflictResolver] Job ${job.id} paused for manual resolution: ${reason}`);
            
            // Emit critical event for operator notification
            this.orchestrator.emit('jobPausedForManualResolution', {
                jobId: job.id,
                conflictType: job.conflictType,
                conflictedSlot: job.conflictedSlot,
                reason: reason,
                timestamp: new Date().toISOString(),
                severity: 'high'
            });
            
        } catch (error) {
            logger.error(`[ConflictResolver] Error pausing job ${job.id}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get rack configuration for slot management
     */
    async getRackConfiguration(rackId) {
        try {
            const rack = await dbGet(`
                SELECT id, name, shelf_count, shelf_spacing_mm, bed_size
                FROM storage_racks 
                WHERE id = ?
            `, [rackId]);
            
            if (!rack) {
                throw new Error(`Rack ${rackId} not found`);
            }
            
            return rack;
            
        } catch (error) {
            logger.error(`[ConflictResolver] Error getting rack configuration: ${error.message}`);
            throw error;
        }
    }

    /**
     * Calculate maximum available clearance in current rack state
     */
    getMaxAvailableClearance(rackState, slotManager) {
        let maxClearance = 0;
        
        // Check storage slots (3-6) for maximum available clearance
        for (let slot = 3; slot <= slotManager.totalSlots; slot++) {
            const slotState = rackState[slot] || 'unknown';
            if (slotState === 'empty' || slotState === 'available') {
                const clearance = slotManager._calculateEffectiveClearance(slot, rackState);
                if (clearance > maxClearance) {
                    maxClearance = clearance;
                }
            }
        }
        
        return maxClearance;
    }

    /**
     * Get conflict resolution statistics
     */
    getStats() {
        return {
            max_retries: this.maxRetries,
            resolution_timeout_ms: this.resolutionTimeout,
            active_resolutions: this.orchestrator.activeConflictResolutions.size
        };
    }
}

module.exports = ConflictResolver;
