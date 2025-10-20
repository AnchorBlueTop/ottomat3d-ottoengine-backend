// src/utils/AdvancedSlotManager.js
// Complete height-aware slot assignment with intelligent optimization
// v2.0 - Full rewrite with proper state model and scoring system

const logger = require('./logger');

class AdvancedSlotManager {
    constructor(rackConfig) {
        this.slotSpacing = rackConfig.shelf_spacing_mm || 80;
        this.totalSlots = rackConfig.shelf_count || 6;
        this.rackId = rackConfig.id;
        this.rackName = rackConfig.name;
        this.printHeights = {}; // Track print heights for collision detection
        
        // Slot state constants - proper three-state model
        this.SLOT_STATES = {
            NO_PLATE: 'no_plate',           // Empty slot, provides clearance
            EMPTY_PLATE: 'empty_plate',     // Has clean plate, can store or grab
            PLATE_WITH_PRINT: 'plate_with_print' // Has stored print
        };
        
        // Height categories for optimization
        this.HEIGHT_CATEGORIES = {
            TINY: { max: 30, priority: 1 },
            SMALL: { max: 60, priority: 2 },
            MEDIUM: { max: 100, priority: 3 },
            LARGE: { max: 160, priority: 4 },
            TALL: { max: 240, priority: 5 },
            VERY_TALL: { max: 320, priority: 6 }
        };
        
        // Optimization weights
        this.WEIGHTS = {
            AVAILABILITY: 0.3,          // NEW: Strongly prefer immediate availability
            HEIGHT_EFFICIENCY: 0.3,     // Reduced from 0.4
            SLOT_POSITION: 0.2,         // Reduced from 0.3
            CLEARANCE_WASTE: 0.15,      // Reduced from 0.2
            FUTURE_FLEXIBILITY: 0.05    // Reduced from 0.1
        };
        
        logger.info(`[SlotManager] Initialized rack ${this.rackName}: ${this.totalSlots} slots @ ${this.slotSpacing}mm`);
    }

    /**
     * Determine slot state from database fields
     * CRITICAL: Check occupied flag first - reserved/occupied slots cannot be used
     */
    determineSlotState(slotData) {
        // If slot is occupied/reserved for a job, treat as plate_with_print
        // This prevents multiple jobs from being assigned to the same slot
        if (slotData.occupied || slotData.print_job_id) {
            return this.SLOT_STATES.PLATE_WITH_PRINT;
        }

        if (!slotData.has_plate) {
            return this.SLOT_STATES.NO_PLATE;
        }
        if (slotData.plate_state === 'with_print') {
            return this.SLOT_STATES.PLATE_WITH_PRINT;
        }
        if (slotData.plate_state === 'empty') {
            return this.SLOT_STATES.EMPTY_PLATE;
        }
        logger.warn(`Inconsistent slot data: has_plate=${slotData.has_plate}, plate_state=${slotData.plate_state}`);
        return this.SLOT_STATES.NO_PLATE;
    }

    /**
     * Main entry point for finding optimal storage slot
     * Implements intelligent bottom-up with height awareness
     * ENHANCED: Now includes lookahead for slots that will become available from active workflows
     */
    findOptimalStorageSlot(printHeight, currentRackState, queuedJobs = [], activeWorkflows = []) {
        const safetyMargin = 10;
        const requiredClearance = printHeight + safetyMargin;

        logger.info(`[SlotManager] Finding storage for ${printHeight}mm print (needs ${requiredClearance}mm clearance)`);

        // Get all possible storage options (including lookahead for future availability)
        const storageOptions = this._getAllStorageOptions(currentRackState, requiredClearance, activeWorkflows);
        
        if (storageOptions.length === 0) {
            return {
                canFit: false,
                reason: `No slots available for ${printHeight}mm print - ${requiredClearance}mm clearance needed`
            };
        }
        
        // Score each option based on multiple factors
        const scoredOptions = this._scoreStorageOptions(
            storageOptions, 
            printHeight, 
            currentRackState,
            queuedJobs
        );
        
        // Select best option
        const bestOption = scoredOptions[0];
        
        // If we need a plate (place_and_store), find optimal grab slot
        let grabSlot = null;
        if (bestOption.requiresPlate) {
            const grabResult = this.findOptimalGrabSlot(currentRackState, {
                preferredNearSlot: bestOption.slot
            });
            
            if (!grabResult.available) {
                // Try next best option
                for (let i = 1; i < scoredOptions.length; i++) {
                    const nextOption = scoredOptions[i];
                    if (!nextOption.requiresPlate) {
                        // Found an in-place option
                        logger.info(`[SlotManager] Falling back to in-place storage at slot ${nextOption.slot}`);
                        return {
                            canFit: true,
                            slot: nextOption.slot,
                            clearance: nextOption.clearance,
                            strategy: nextOption.strategy,
                            score: nextOption.score,
                            reason: nextOption.reason,
                            requiresPlate: false,
                            grabSlot: null
                        };
                    }
                }
                
                return {
                    canFit: false,
                    reason: 'Need plate for storage but none available'
                };
            }
            
            grabSlot = grabResult.slot;
        }
        
        logger.info(`[SlotManager] Selected slot ${bestOption.slot} with score ${bestOption.score.toFixed(3)}${grabSlot ? ` (grab from ${grabSlot})` : ''}`);
        
        return {
            canFit: true,
            slot: bestOption.slot,
            clearance: bestOption.clearance,
            strategy: bestOption.strategy,
            score: bestOption.score,
            reason: bestOption.reason,
            requiresPlate: bestOption.requiresPlate || false,
            grabSlot: grabSlot
        };
    }

    // Backwards compatibility
    findOptimalSlot(printHeight, currentRackState) {
        return this.findOptimalStorageSlot(printHeight, currentRackState);
    }

    /**
     * Set print heights for existing occupied slots
     * Should be called when initializing with existing prints
     */
    setPrintHeights(heights) {
        this.printHeights = { ...heights };
    }

    /**
     * Check if a slot is blocked by prints in slots below
     * A print extends upward and can block slots above based on its height
     * ENHANCED: More robust blocking detection with better logging
     */
    _isSlotBlockedByPrintsBelow(slot, rackState) {
        // Check all slots below this one
        for (let belowSlot = slot - 1; belowSlot >= 1; belowSlot--) {
            const state = rackState[belowSlot] || 'unknown';
            
            // Check for any state that indicates a print is present
            if (state === 'occupied' || state === 'plate_with_print' || state === this.SLOT_STATES.PLATE_WITH_PRINT) {
                // Get the height of the print in the slot below
                const printHeight = this.printHeights[belowSlot] || 0;
                
                if (printHeight > 0) {
                    // Calculate how many slots this print blocks (including safety margin)
                    const effectiveHeight = printHeight + 10; // Add safety margin
                    const slotsNeeded = Math.ceil(effectiveHeight / this.slotSpacing);
                    const highestBlockedSlot = belowSlot + slotsNeeded - 1;
                    
                    if (slot <= highestBlockedSlot) {
                        logger.info(`[SlotManager] Slot ${slot} BLOCKED by ${printHeight}mm print in slot ${belowSlot} (blocks through slot ${highestBlockedSlot})`);
                        return true;
                    } else {
                        logger.debug(`[SlotManager] Slot ${slot} clear - ${printHeight}mm print in slot ${belowSlot} only blocks through slot ${highestBlockedSlot}`);
                    }
                } else {
                    logger.debug(`[SlotManager] Slot ${belowSlot} marked occupied but no height recorded - assuming blocks only own slot`);
                    // If no height recorded, assume it only blocks its own slot
                    if (slot === belowSlot) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    /**
     * Update print height when storing a print
     */
    recordPrintStorage(slot, printHeight) {
        this.printHeights[slot] = printHeight;
        logger.debug(`[SlotManager] Recorded ${printHeight}mm print in slot ${slot}`);
    }

    /**
     * Clear print height when removing a print
     */
    clearPrintHeight(slot) {
        delete this.printHeights[slot];
    }

    /**
     * Get all possible storage options
     * CRITICAL: empty_plate slots are NEVER used for storage - they're reserved for grabbing!
     * ENHANCED: Now includes lookahead for slots that will become available from active workflows
     */
    _getAllStorageOptions(rackState, requiredClearance, activeWorkflows = []) {
        const options = [];

        // Strategy 1: Storage in immediately available NO_PLATE/empty slots
        // Empty plate slots are preserved for grabbing to load onto printers
        for (let slot = 1; slot <= this.totalSlots; slot++) {
            const state = rackState[slot] || 'unknown';
            if ((state === 'empty' || state === 'no_plate' || state === this.SLOT_STATES.NO_PLATE) &&
                !this._isSlotBlockedByPrintsBelow(slot, rackState)) {
                const clearance = this._calculateEffectiveClearance(slot, rackState);
                if (clearance >= requiredClearance) {
                    options.push({
                        slot,
                        clearance,
                        strategy: 'store_immediate',
                        requiresPlate: false,  // Printer already has plate from startup/previous job
                        originalState: 'no_plate',
                        availableNow: true
                    });
                }
            }
        }

        // Strategy 2: LOOKAHEAD - Slots that will become available after active workflows grab from them
        // This solves the problem where Job 2 can't find storage because it doesn't account for
        // slots that Job 1 will free up after grabbing empty plates
        if (activeWorkflows && activeWorkflows.length > 0) {
            logger.debug(`[SlotManager] Checking ${activeWorkflows.length} active workflow(s) for future slot availability`);

            for (const workflow of activeWorkflows) {
                // Check if this workflow is in a phase where it will grab a plate
                // Phases: assigned -> pre_print -> printing -> print_completed -> post_print -> completed
                const willGrabPlate = ['print_completed', 'post_print'].includes(workflow.phase);

                if (willGrabPlate) {
                    // This workflow will grab from an empty_plate slot, making it NO_PLATE after
                    // Check which slots have empty plates and could be grabbed
                    for (let slot = 1; slot <= this.totalSlots; slot++) {
                        const state = rackState[slot] || 'unknown';

                        // Skip if this slot is already in our immediate options
                        if (options.some(opt => opt.slot === slot)) {
                            continue;
                        }

                        // Empty plate slots will become no_plate after workflow grabs from them
                        if (state === 'empty_plate' || state === this.SLOT_STATES.EMPTY_PLATE) {
                            // Simulate the state after this slot is grabbed
                            const futureRackState = { ...rackState };
                            futureRackState[slot] = this.SLOT_STATES.NO_PLATE;

                            // Check if slot would be usable after grab (not blocked by prints below)
                            if (!this._isSlotBlockedByPrintsBelow(slot, futureRackState)) {
                                const clearance = this._calculateEffectiveClearance(slot, futureRackState);

                                if (clearance >= requiredClearance) {
                                    options.push({
                                        slot,
                                        clearance,
                                        strategy: 'store_after_grab',
                                        requiresPlate: false,
                                        originalState: 'empty_plate',
                                        availableNow: false,
                                        availableAfterJobId: workflow.jobId,
                                        availableAfterPhase: workflow.phase
                                    });

                                    logger.info(`[SlotManager] 🔮 Lookahead: Slot ${slot} will be available after Job ${workflow.jobId} grabs from it`);
                                }
                            }
                        }
                    }
                }
            }
        }

        const immediateCount = options.filter(opt => opt.availableNow).length;
        const futureCount = options.filter(opt => !opt.availableNow).length;

        logger.debug(`[SlotManager] Found ${options.length} storage options: ${immediateCount} immediate, ${futureCount} future (empty_plate slots excluded)`);

        return options;
    }

    /**
     * Calculate dynamic clearance for a slot
     * Only for EMPTY slots - plates block clearance!
     * Used for calculating clearance when placing into empty slots
     * ENHANCED: Better blocking detection from prints in lower slots
     */
    _calculateEffectiveClearance(targetSlot, rackState) {
        const state = rackState[targetSlot] || 'unknown';
        
        // If slot has a plate or print, clearance is just base (can't get extra through plate)
        if (state === 'empty_plate' || state === 'occupied' || state === this.SLOT_STATES.EMPTY_PLATE || state === this.SLOT_STATES.PLATE_WITH_PRINT) {
            return this.slotSpacing; // Only base clearance
        }
        
        // First check if this slot is blocked by prints below
        if (this._isSlotBlockedByPrintsBelow(targetSlot, rackState)) {
            logger.debug(`[SlotManager] Slot ${targetSlot} blocked by prints below - no clearance available`);
            return 0; // Blocked slot has no usable clearance
        }
        
        // For empty slots, calculate additional clearance from empty slots above
        let clearance = this.slotSpacing; // Base 80mm
        
        // Cap at slot 6 with reasonable max (e.g., 500mm "infinite" clearance)
        const maxReasonableClearance = 500;
        
        for (let slot = targetSlot + 1; slot <= this.totalSlots; slot++) {
            const aboveState = rackState[slot] || 'unknown';
            
            // Also check if the slot above is blocked by prints below it
            if (this._isSlotBlockedByPrintsBelow(slot, rackState)) {
                logger.debug(`[SlotManager] Slot ${slot} above target is blocked - stops clearance calculation`);
                break;
            }
            
            if (aboveState === 'empty' || aboveState === 'no_plate' || aboveState === this.SLOT_STATES.NO_PLATE) {
                clearance += this.slotSpacing;
            } else {
                break; // Any plate or print stops clearance
            }
        }
        
        // If we're at the top slot, cap clearance at reasonable maximum
        if (targetSlot === this.totalSlots) {
            clearance = Math.min(clearance, maxReasonableClearance);
        }
        
        logger.debug(`[SlotManager] Slot ${targetSlot} calculated clearance: ${clearance}mm`);
        return clearance;
    }

    /**
     * Score storage options based on multiple optimization factors
     * ENHANCED: Now includes availability scoring to prefer immediate slots over future slots
     */
    _scoreStorageOptions(options, printHeight, currentRackState, queuedJobs) {
        const heightCategory = this._categorizeHeight(printHeight);

        return options.map(option => {
            let score = 0;
            let breakdown = {};

            // 0. Availability Score (0-1) - NEW: Strongly prefer immediate availability
            breakdown.availability = option.availableNow ? 1.0 : 0.3;
            score += breakdown.availability * this.WEIGHTS.AVAILABILITY;

            // 1. Height Efficiency Score (0-1)
            const utilizationRatio = printHeight / option.clearance;
            breakdown.heightEfficiency = this._calculateHeightEfficiencyScore(utilizationRatio);
            score += breakdown.heightEfficiency * this.WEIGHTS.HEIGHT_EFFICIENCY;

            // 2. Slot Position Score (0-1)
            breakdown.slotPosition = this._calculatePositionScore(option.slot, heightCategory);
            score += breakdown.slotPosition * this.WEIGHTS.SLOT_POSITION;

            // 3. Clearance Waste Penalty (0-1) - Updated to consider limited options
            breakdown.clearanceWaste = this._calculateWastePenalty(option, printHeight, options.length);
            score += breakdown.clearanceWaste * this.WEIGHTS.CLEARANCE_WASTE;

            // 4. Future Flexibility Score (0-1)
            breakdown.futureFlexibility = this._calculateFutureFlexibility(
                option,
                currentRackState,
                queuedJobs
            );
            score += breakdown.futureFlexibility * this.WEIGHTS.FUTURE_FLEXIBILITY;

            return {
                ...option,
                score,
                breakdown,
                reason: this._generateReason(option, breakdown, heightCategory)
            };
        }).sort((a, b) => b.score - a.score);
    }

    /**
     * Calculate height efficiency score
     */
    _calculateHeightEfficiencyScore(utilizationRatio) {
        if (utilizationRatio >= 0.8 && utilizationRatio <= 0.95) {
            return 1.0; // Perfect fit
        } else if (utilizationRatio >= 0.6) {
            return 0.8; // Good fit
        } else if (utilizationRatio >= 0.4) {
            return 0.5; // Acceptable
        } else {
            return 0.2; // Poor fit
        }
    }

    /**
     * Calculate position score based on height category
     */
    _calculatePositionScore(slot, heightCategory) {
        // TINY prints: strong preference for slot 1
        if (heightCategory.priority === 1) {
            return slot === 1 ? 1.0 : Math.max(0, 1 - (slot - 1) * 0.2);
        }
        // SMALL prints: prefer slots 1-2
        if (heightCategory.priority === 2) {
            if (slot <= 2) return 1.0;
            return Math.max(0, 1 - (slot - 2) * 0.25);
        }
        // MEDIUM prints: prefer slots 1-3
        if (heightCategory.priority === 3) {
            if (slot <= 3) return 0.9;
            return Math.max(0, 0.9 - (slot - 3) * 0.3);
        }
        // LARGE prints: prefer slots 2-4
        if (heightCategory.priority === 4) {
            if (slot >= 2 && slot <= 4) return 1.0;
            return 0.7;
        }
        // TALL prints: prefer slots 3-5
        if (heightCategory.priority === 5) {
            if (slot >= 3 && slot <= 5) return 1.0;
            return 0.6;
        }
        // VERY_TALL prints: need slots 4-6
        if (heightCategory.priority === 6) {
            if (slot >= 4) return 1.0;
            return 0.3;
        }
        return 0.5;
    }

    /**
     * Calculate waste penalty - UPDATED to handle limited options
     */
    _calculateWastePenalty(option, printHeight, totalOptions) {
        const wastedClearance = option.clearance - printHeight;
        
        // If limited options, reduce penalty significantly
        if (totalOptions <= 2) {
            if (wastedClearance <= 80) return 0.9;
            if (wastedClearance <= 160) return 0.8;
            if (wastedClearance <= 240) return 0.7;
            return 0.6;
        }
        
        // Normal penalties when we have choices
        if (wastedClearance <= 40) return 1.0;
        if (wastedClearance <= 80) return 0.7;
        if (wastedClearance <= 160) return 0.4;
        if (wastedClearance <= 240) return 0.2;
        return 0.1;
    }

    /**
     * Calculate future flexibility
     */
    _calculateFutureFlexibility(option, currentRackState, queuedJobs) {
        if (!queuedJobs || queuedJobs.length === 0) return 0.5;
        
        const futureState = { ...currentRackState };
        futureState[option.slot] = 'occupied';
        
        let canFitFutureJobs = 0;
        let totalFutureJobs = Math.min(queuedJobs.length, 3);
        
        for (let i = 0; i < totalFutureJobs; i++) {
            const futureJob = queuedJobs[i];
            // Get height from measurement_details_json.z_mm
            let futureJobHeight = 0;
            if (futureJob.measurement_details_json) {
                try {
                    const measurements = typeof futureJob.measurement_details_json === 'string' 
                        ? JSON.parse(futureJob.measurement_details_json)
                        : futureJob.measurement_details_json;
                    futureJobHeight = measurements.z_mm || measurements.height_mm || 0;
                } catch (error) {
                    futureJobHeight = 0;
                }
            }
            const futureOptions = this._getAllStorageOptions(
                futureState, 
                futureJobHeight + 10
            );
            if (futureOptions.length > 0) {
                canFitFutureJobs++;
            }
        }
        
        return canFitFutureJobs / totalFutureJobs;
    }

    /**
     * Categorize print height
     */
    _categorizeHeight(height) {
        for (const [category, config] of Object.entries(this.HEIGHT_CATEGORIES)) {
            if (height <= config.max) {
                return { name: category, ...config };
            }
        }
        return { name: 'EXTREME', max: 999, priority: 7 };
    }

    /**
     * Generate human-readable reason
     * ENHANCED: Now includes lookahead information
     */
    _generateReason(option, breakdown, heightCategory) {
        const parts = [];
        parts.push(`${heightCategory.name}_print`);
        parts.push(`slot_${option.slot}`);
        parts.push(`${option.clearance}mm_clearance`);

        // Indicate if this is a lookahead slot
        if (!option.availableNow && option.availableAfterJobId) {
            parts.push(`available_after_job_${option.availableAfterJobId}`);
        } else if (option.availableNow) {
            parts.push('immediate');
        }

        if (breakdown.heightEfficiency > 0.8) {
            parts.push('excellent_fit');
        } else if (breakdown.clearanceWaste < 0.3) {
            parts.push('high_waste');
        }

        return parts.join('_');
    }

    /**
     * Find optimal grab slot considering proximity and preservation
     * Prefer grabbing from slots adjacent to storage location
     */
    findOptimalGrabSlot(rackState, options = {}) {
        const { preferredNearSlot, excludeSlot } = options;
        const emptyPlateSlots = [];

        for (let slot = 1; slot <= this.totalSlots; slot++) {
            // Skip excluded slot (e.g., the storage slot)
            if (excludeSlot && slot === excludeSlot) {
                continue;
            }

            const state = rackState[slot] || 'unknown';
            if (state === 'empty_plate' || state === this.SLOT_STATES.EMPTY_PLATE) {
                emptyPlateSlots.push(slot);
            }
        }
        
        if (emptyPlateSlots.length === 0) {
            return {
                available: false,
                reason: 'No empty plates available'
            };
        }
        
        // If we have a preferred slot (for proximity), try to grab from adjacent
        if (preferredNearSlot) {
            // Sort by distance from preferred slot
            emptyPlateSlots.sort((a, b) => {
                const distA = Math.abs(a - preferredNearSlot);
                const distB = Math.abs(b - preferredNearSlot);
                if (distA !== distB) return distA - distB;
                // If equal distance, prefer lower slot
                return a - b;
            });
            
            const optimalGrabSlot = emptyPlateSlots[0];
            
            return {
                available: true,
                slot: optimalGrabSlot,
                type: 'empty_plate',
                reason: `grab_adjacent_to_storage_slot_${preferredNearSlot}`,
                distance: Math.abs(optimalGrabSlot - preferredNearSlot)
            };
        }
        
        // Default: intelligent grab selection - prefer higher slots
        const optimalGrabSlot = this._selectOptimalGrabSlot(emptyPlateSlots, rackState);
        
        return {
            available: true,
            slot: optimalGrabSlot,
            type: 'empty_plate',
            reason: 'preserving_lower_slots_for_storage'
        };
    }

    /**
     * Select best grab slot to preserve storage flexibility
     */
    _selectOptimalGrabSlot(availableSlots, rackState) {
        const slotValues = availableSlots.map(slot => {
            const storageValue = (this.totalSlots - slot + 1) / this.totalSlots;
            const createsSpace = this._checkCreatesContiguousSpace(slot, rackState);
            return {
                slot,
                value: storageValue - (createsSpace ? 0.2 : 0)
            };
        });
        
        slotValues.sort((a, b) => a.value - b.value);
        return slotValues[0].slot;
    }

    /**
     * Check if removing plate creates contiguous empty space
     */
    _checkCreatesContiguousSpace(slot, rackState) {
        let emptyBelow = 0;
        let emptyAbove = 0;
        
        for (let s = slot - 1; s >= 1; s--) {
            const state = rackState[s] || 'unknown';
            if (state === 'empty' || state === 'no_plate' || state === this.SLOT_STATES.NO_PLATE) {
                emptyBelow++;
            } else {
                break;
            }
        }
        
        for (let s = slot + 1; s <= this.totalSlots; s++) {
            const state = rackState[s] || 'unknown';
            if (state === 'empty' || state === 'no_plate' || state === this.SLOT_STATES.NO_PLATE) {
                emptyAbove++;
            } else {
                break;
            }
        }
        
        return (emptyBelow + emptyAbove + 1) >= 3;
    }

    /**
     * Validate that a print can fit in the rack with current queue
     * @param {number} printHeight - Height of new print
     * @param {Array} queuedJobs - Currently queued jobs with their slot assignments
     * @param {Object} currentRackState - Current rack state
     * @returns {Object} - Validation result
     */
    validatePrintCanFit(printHeight, queuedJobs, currentRackState) {
        // Simulate rack state after all queued jobs complete
        const futureRackState = this._simulateQueueExecution(currentRackState, queuedJobs);
        
        // Check if new print can fit in the simulated future state
        return this.findOptimalSlot(printHeight, futureRackState);
    }

    /**
     * Simulate rack state after executing queued jobs
     * @param {Object} currentState - Current rack state
     * @param {Array} queuedJobs - Jobs in queue with slot assignments
     * @returns {Object} - Simulated future rack state
     */
    _simulateQueueExecution(currentState, queuedJobs) {
        const futureState = { ...currentState };
        
        // Simulate each job: grab from source slot, store to destination slot
        for (const job of queuedJobs) {
            if (job.assigned_grab_slot) {
                futureState[job.assigned_grab_slot] = 'empty';
            }
            if (job.assigned_store_slot) {
                futureState[job.assigned_store_slot] = 'occupied';
            }
        }
        
        return futureState;
    }

    /**
     * Get rack utilization statistics
     * UPDATED: Consistent with corrected slot state logic
     * @param {Object} rackState - Current rack state
     * @returns {Object} - Utilization stats
     */
    getRackUtilization(rackState) {
        let occupied = 0;        // Slots with stored prints
        let empty = 0;           // Truly empty slots
        let emptyPlates = 0;     // Slots with fresh plates
        let unknown = 0;         // Unknown state slots
        
        for (let slot = 1; slot <= this.totalSlots; slot++) {
            const state = rackState[slot] || 'unknown';
            switch (state) {
                case 'occupied':
                    occupied++;
                    break;
                case 'empty':
                    empty++;
                    break;
                case 'empty_plate':
                    emptyPlates++;
                    break;
                default:
                    unknown++;
                    break;
            }
        }
        
        return {
            totalSlots: this.totalSlots,
            occupied,         // Completed prints in storage
            empty,           // Available for storing prints
            emptyPlates,     // Available plates for printing
            unknown,
            utilizationPercent: (occupied / this.totalSlots) * 100,
            storageCapacityPercent: (empty / this.totalSlots) * 100,
            platesAvailable: emptyPlates > 0
        };
    }
}

module.exports = AdvancedSlotManager;