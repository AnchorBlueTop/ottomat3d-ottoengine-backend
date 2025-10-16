#!/usr/bin/env node

/**
 * Interactive Testing Script for OTTOMAT3D Slot Management Algorithm
 * 
 * This script allows you to:
 * 1. Configure a rack with custom clearance
 * 2. Set initial slot states (occupied/empty_plate/nothing)
 * 3. Input print jobs with heights
 * 4. Simulate the complete storage workflow
 * 5. See how the rack evolves with each job
 */

const readline = require('readline');

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Simplified AdvancedSlotManager for testing
class TestSlotManager {
    constructor(slotSpacing = 80, totalSlots = 6) {
        this.slotSpacing = slotSpacing;
        this.totalSlots = totalSlots;
        this.printHeights = {}; // Track height of prints in each slot
        
        this.HEIGHT_CATEGORIES = {
            TINY: { max: 30, priority: 1 },
            SMALL: { max: 60, priority: 2 },
            MEDIUM: { max: 100, priority: 3 },
            LARGE: { max: 160, priority: 4 },
            TALL: { max: 240, priority: 5 },
            VERY_TALL: { max: 320, priority: 6 }
        };
        
        this.WEIGHTS = {
            HEIGHT_EFFICIENCY: 0.4,
            SLOT_POSITION: 0.3,
            CLEARANCE_WASTE: 0.2,
            FUTURE_FLEXIBILITY: 0.1
        };
    }

    findOptimalStorageSlot(printHeight, rackState, remainingJobs = []) {
        const safetyMargin = 10;
        const requiredClearance = printHeight + safetyMargin;
        
        console.log(`\n${colors.cyan}Finding storage for ${printHeight}mm print (needs ${requiredClearance}mm clearance)${colors.reset}`);
        
        const options = this._getAllStorageOptions(rackState, requiredClearance);
        
        if (options.length === 0) {
            return {
                canFit: false,
                reason: `No slots available for ${printHeight}mm print`
            };
        }
        
        const scoredOptions = this._scoreOptions(options, printHeight, rackState, remainingJobs);
        const best = scoredOptions[0];
        
        console.log(`${colors.green}Selected slot ${best.slot} (score: ${best.score.toFixed(3)})${colors.reset}`);
        
        return {
            canFit: true,
            slot: best.slot,
            clearance: best.clearance,
            strategy: best.strategy,
            score: best.score
        };
    }

    /**
     * Check if a slot is blocked by prints in slots below
     */
    _isSlotBlockedByPrintsBelow(slot, rackState) {
        // Check all slots below this one
        for (let belowSlot = slot - 1; belowSlot >= 1; belowSlot--) {
            if (rackState[belowSlot] === 'occupied') {
                // Get the height of the print in the slot below
                const printHeight = this.printHeights[belowSlot] || 0;
                const slotsBlocked = Math.ceil(printHeight / this.slotSpacing);
                const highestBlockedSlot = belowSlot + slotsBlocked - 1;
                
                if (slot <= highestBlockedSlot) {
                    return true; // This slot is blocked by print below
                }
            }
        }
        return false;
    }

    _getAllStorageOptions(rackState, requiredClearance) {
        const options = [];
        
        // Strategy 1: In-place storage on EMPTY_PLATE slots
        // CRITICAL: In-place only has BASE clearance!
        for (let slot = 1; slot <= this.totalSlots; slot++) {
            if (rackState[slot] === 'empty_plate' && !this._isSlotBlockedByPrintsBelow(slot, rackState)) {
                const clearance = this.slotSpacing; // Always 80mm for in-place
                if (clearance >= requiredClearance) {
                    options.push({
                        slot,
                        clearance,
                        strategy: 'in_place'
                    });
                }
            }
        }
        
        // Strategy 2: Storage in empty slots (requires grabbing a plate)
        for (let slot = 1; slot <= this.totalSlots; slot++) {
            if (rackState[slot] === 'nothing' && !this._isSlotBlockedByPrintsBelow(slot, rackState)) {
                const clearance = this._calculateClearance(slot, rackState);
                if (clearance >= requiredClearance) {
                    options.push({
                        slot,
                        clearance,
                        strategy: 'place_and_store',
                        requiresPlate: true
                    });
                }
            }
        }
        
        return options;
    }

    _calculateClearance(targetSlot, rackState) {
        const state = rackState[targetSlot];
        
        // If this slot has a plate or is occupied, it only has base clearance
        if (state === 'empty_plate' || state === 'occupied') {
            return this.slotSpacing; // Only base 80mm
        }
        
        // Only empty (nothing) slots can have additional clearance
        let clearance = this.slotSpacing;
        
        // Add clearance from empty slots above
        for (let slot = targetSlot + 1; slot <= this.totalSlots; slot++) {
            if (rackState[slot] === 'nothing') {
                clearance += this.slotSpacing;
            } else {
                break; // Any plate or occupied slot stops clearance
            }
        }
        
        // Cap top slot at reasonable max (e.g., 500mm)
        if (targetSlot === this.totalSlots && clearance === this.slotSpacing) {
            clearance = 500; // "Infinite" clearance for top slot
        }
        
        return clearance;
    }

    _scoreOptions(options, printHeight, rackState, remainingJobs) {
        const heightCategory = this._categorizeHeight(printHeight);
        
        return options.map(option => {
            let score = 0;
            
            // Height efficiency
            const utilization = printHeight / option.clearance;
            const heightScore = utilization >= 0.8 ? 1.0 : utilization >= 0.6 ? 0.8 : 0.5;
            score += heightScore * this.WEIGHTS.HEIGHT_EFFICIENCY;
            
            // Position score
            const positionScore = this._getPositionScore(option.slot, heightCategory);
            score += positionScore * this.WEIGHTS.SLOT_POSITION;
            
            // Waste penalty (reduced when few options)
            const wasteScore = this._getWasteScore(option, printHeight, options.length);
            score += wasteScore * this.WEIGHTS.CLEARANCE_WASTE;
            
            // Future flexibility
            const flexScore = this._getFutureScore(option, rackState, remainingJobs);
            score += flexScore * this.WEIGHTS.FUTURE_FLEXIBILITY;
            
            // Bonus for in-place
            if (option.strategy === 'in_place') {
                score += 0.05;
            }
            
            return { ...option, score };
        }).sort((a, b) => b.score - a.score);
    }

    _categorizeHeight(height) {
        for (const [name, config] of Object.entries(this.HEIGHT_CATEGORIES)) {
            if (height <= config.max) {
                return { name, ...config };
            }
        }
        return { name: 'EXTREME', priority: 7 };
    }

    _getPositionScore(slot, category) {
        // Simplified position scoring
        if (category.priority <= 2 && slot <= 2) return 1.0;
        if (category.priority <= 3 && slot <= 3) return 0.9;
        if (category.priority <= 4 && slot <= 4) return 0.8;
        if (category.priority >= 5 && slot >= 3) return 0.9;
        return 0.5;
    }

    _getWasteScore(option, printHeight, totalOptions) {
        const waste = option.clearance - printHeight;
        
        // If limited options, reduce penalty
        if (totalOptions <= 2) {
            if (waste <= 160) return 0.8;
            return 0.6;
        }
        
        if (waste <= 40) return 1.0;
        if (waste <= 80) return 0.7;
        if (waste <= 160) return 0.4;
        return 0.2;
    }

    _getFutureScore(option, rackState, remainingJobs) {
        if (remainingJobs.length === 0) return 0.5;
        
        // Simplified: check if at least one future job can fit
        const futureState = { ...rackState };
        futureState[option.slot] = 'occupied';
        
        for (const job of remainingJobs.slice(0, 2)) {
            const futureOptions = this._getAllStorageOptions(futureState, job + 10);
            if (futureOptions.length > 0) return 0.8;
        }
        
        return 0.3;
    }

    findOptimalGrabSlot(rackState, preferredNearSlot = null) {
        const emptyPlateSlots = [];
        
        for (let slot = 1; slot <= this.totalSlots; slot++) {
            if (rackState[slot] === 'empty_plate') {
                emptyPlateSlots.push(slot);
            }
        }
        
        if (emptyPlateSlots.length === 0) {
            return { available: false };
        }
        
        // If we have a preferred slot, grab from adjacent
        if (preferredNearSlot) {
            // Sort by distance from storage slot
            emptyPlateSlots.sort((a, b) => {
                const distA = Math.abs(a - preferredNearSlot);
                const distB = Math.abs(b - preferredNearSlot);
                if (distA !== distB) return distA - distB;
                // If equal distance, prefer lower slot
                return a - b;
            });
        } else {
            // Default: prefer higher slots to preserve lower for storage
            emptyPlateSlots.sort((a, b) => b - a);
        }
        
        return {
            available: true,
            slot: emptyPlateSlots[0]
        };
    }
}

// Interactive CLI
class SlotSimulator {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.rackState = {};
        this.slotManager = null;
        this.printJobs = [];
    }

    async question(prompt) {
        return new Promise(resolve => {
            this.rl.question(prompt, resolve);
        });
    }

    async run() {
        console.log(`${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════╗
║   OTTOMAT3D Slot Algorithm Testing Simulator        ║
╚══════════════════════════════════════════════════════╝${colors.reset}\n`);

        // Step 1: Configure rack
        const clearanceStr = await this.question(`${colors.yellow}Enter slot clearance in mm (default 80): ${colors.reset}`);
        const clearance = parseInt(clearanceStr) || 80;
        
        const slotsStr = await this.question(`${colors.yellow}Enter number of slots (default 6): ${colors.reset}`);
        const totalSlots = parseInt(slotsStr) || 6;
        
        this.slotManager = new TestSlotManager(clearance, totalSlots);
        
        // Step 2: Set initial rack state
        console.log(`\n${colors.bright}Configure initial rack state:${colors.reset}`);
        console.log(`For each slot, enter: ${colors.green}o${colors.reset}=occupied, ${colors.blue}e${colors.reset}=empty plate, ${colors.dim}n${colors.reset}=nothing\n`);
        
        for (let slot = totalSlots; slot >= 1; slot--) {
            const stateStr = await this.question(`Slot ${slot}: `);
            const state = stateStr.toLowerCase();
            
            if (state === 'o') {
                this.rackState[slot] = 'occupied';
            } else if (state === 'e') {
                this.rackState[slot] = 'empty_plate';
            } else {
                this.rackState[slot] = 'nothing';
            }
        }
        
        this.displayRack();
        
        // Step 3: Input print jobs
        const jobCountStr = await this.question(`\n${colors.yellow}How many print jobs to simulate? ${colors.reset}`);
        const jobCount = parseInt(jobCountStr) || 1;
        
        for (let i = 1; i <= jobCount; i++) {
            const heightStr = await this.question(`Height of print job ${i} (mm): `);
            const height = parseInt(heightStr);
            if (height > 0) {
                this.printJobs.push(height);
            }
        }
        
        // Step 4: Run simulation
        console.log(`\n${colors.bright}${colors.green}Starting simulation...${colors.reset}\n`);
        await this.simulate();
        
        this.rl.close();
    }

    displayRack() {
        console.log(`\n${colors.bright}Current Rack State:${colors.reset}`);
        
        for (let slot = this.slotManager.totalSlots; slot >= 1; slot--) {
            const state = this.rackState[slot];
            let clearance;
            
            // Calculate clearance for display
            if (slot === this.slotManager.totalSlots && state === 'nothing') {
                clearance = 500; // Top slot has "infinite" clearance
            } else {
                clearance = this.slotManager._calculateClearance(slot, this.rackState);
            }
            
            let stateDisplay = '';
            let emoji = '';
            
            if (state === 'occupied') {
                stateDisplay = `${colors.red}OCCUPIED${colors.reset}`;
                emoji = '📦';
            } else if (state === 'empty_plate') {
                stateDisplay = `${colors.blue}EMPTY PLATE${colors.reset}`;
                emoji = '🟦';
            } else {
                stateDisplay = `${colors.dim}NOTHING${colors.reset}`;
                emoji = '⬜';
            }
            
            console.log(`  Slot ${slot}: ${emoji}  ${stateDisplay} (${clearance}mm clearance)`);
        }
        console.log('');
    }

    async simulate() {
        let jobNumber = 1;
        
        for (let i = 0; i < this.printJobs.length; i++) {
            const height = this.printJobs[i];
            const remainingJobs = this.printJobs.slice(i + 1);
            
            console.log(`${colors.bright}═══ Job ${jobNumber}: ${height}mm print ═══${colors.reset}`);
            
            // Find storage slot
            const storageResult = this.slotManager.findOptimalStorageSlot(
                height,
                this.rackState,
                remainingJobs
            );
            
            if (!storageResult.canFit) {
                console.log(`${colors.red}❌ Cannot store: ${storageResult.reason}${colors.reset}`);
                continue;
            }
            
            // Check if we need to grab a plate first
            let grabSlot = null;
            if (storageResult.strategy === 'place_and_store') {
                const grabResult = this.slotManager.findOptimalGrabSlot(this.rackState, storageResult.slot);
                if (!grabResult.available) {
                    console.log(`${colors.red}❌ Need plate but none available!${colors.reset}`);
                    continue;
                }
                grabSlot = grabResult.slot;
            }
            
            // CRITICAL FIX: Update print heights BEFORE making future decisions
            // Execute operations
            if (grabSlot) {
                console.log(`${colors.yellow}1. Grab plate from slot ${grabSlot}${colors.reset}`);
                this.rackState[grabSlot] = 'nothing';
            }
            
            console.log(`${colors.green}2. Store ${height}mm print in slot ${storageResult.slot}${colors.reset}`);
            this.rackState[storageResult.slot] = 'occupied';
            
            // FIXED: Update print height IMMEDIATELY so future assignments can see conflicts
            this.slotManager.printHeights[storageResult.slot] = height;
            console.log(`${colors.dim}   Print height ${height}mm recorded for slot ${storageResult.slot}${colors.reset}`);
            
            console.log(`   Strategy: ${storageResult.strategy}`);
            console.log(`   Clearance: ${storageResult.clearance}mm`);
            console.log(`   Score: ${storageResult.score.toFixed(3)}`);
            
            this.displayRack();
            
            // Show remaining capacity
            const emptySlots = Object.values(this.rackState).filter(s => s === 'nothing').length;
            const emptyPlates = Object.values(this.rackState).filter(s => s === 'empty_plate').length;
            const occupied = Object.values(this.rackState).filter(s => s === 'occupied').length;
            
            console.log(`${colors.dim}Capacity: ${occupied} occupied, ${emptyPlates} plates, ${emptySlots} empty${colors.reset}\n`);
            
            jobNumber++;
            
            // Wait for user to continue
            if (i < this.printJobs.length - 1) {
                await this.question('Press Enter to continue...');
            }
        }
        
        console.log(`${colors.bright}${colors.green}Simulation complete!${colors.reset}`);
        this.displayFinalStats();
    }

    displayFinalStats() {
        console.log(`\n${colors.bright}Final Statistics:${colors.reset}`);
        
        const occupied = Object.values(this.rackState).filter(s => s === 'occupied').length;
        const emptyPlates = Object.values(this.rackState).filter(s => s === 'empty_plate').length;
        const empty = Object.values(this.rackState).filter(s => s === 'nothing').length;
        
        const utilization = (occupied / this.slotManager.totalSlots * 100).toFixed(1);
        
        console.log(`  Storage utilization: ${utilization}%`);
        console.log(`  Occupied slots: ${occupied}`);
        console.log(`  Available plates: ${emptyPlates}`);
        console.log(`  Empty slots: ${empty}`);
        
        // Calculate fragmentation
        let fragments = 0;
        let inEmptySection = false;
        for (let slot = 1; slot <= this.slotManager.totalSlots; slot++) {
            if (this.rackState[slot] === 'nothing') {
                if (!inEmptySection) {
                    fragments++;
                    inEmptySection = true;
                }
            } else {
                inEmptySection = false;
            }
        }
        
        console.log(`  Fragmentation: ${fragments} empty section(s)`);
    }
}

// Run the simulator
const simulator = new SlotSimulator();
simulator.run().catch(console.error);
