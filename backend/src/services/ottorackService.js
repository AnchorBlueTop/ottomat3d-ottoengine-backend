// backend/src/services/ottorackService.js

const { dbRun, dbGet, dbAll } = require('../db/utils');
const logger = require('../utils/logger');

const ottorackService = {

    /**
     * Create a new Ottorack with specified number of shelves
     */
    async createOttorack(rackData) {
        const { name, number_of_shelves, shelf_spacing_mm, bed_size } = rackData;
        
        const sql = `
            INSERT INTO storage_racks (name, shelf_count, shelf_spacing_mm, bed_size)
            VALUES (?, ?, ?, ?)
        `;
        
        try {
            const result = await dbRun(sql, [name, number_of_shelves, shelf_spacing_mm, bed_size]);
            const rackId = result.lastID;
            
            // Create individual shelves for this rack
            await this._createShelvesForRack(rackId, number_of_shelves);
            
            return {
                id: rackId,
                name: name,
                shelf_count: number_of_shelves,
                shelf_spacing_mm: shelf_spacing_mm,
                bed_size: bed_size
            };
        } catch (error) {
            logger.error(`[OttorackService] Error creating Ottorack: ${error.message}`);
            throw error;
        }
    },

    /**
     * Create individual shelves for an OttoRack
     * FIXED: Initialize slots with empty plates for orchestrator workflow
     */
    async _createShelvesForRack(rackId, shelfCount) {
        const sql = `
            INSERT INTO rack_slots (storage_rack_id, slot_number, type, print_job_id, has_plate, plate_state)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        try {
            for (let shelfNumber = 1; shelfNumber <= shelfCount; shelfNumber++) {
                // Initialize all slots as completely empty (no plates) as requested
                await dbRun(sql, [rackId, shelfNumber, 'print_bed', null, 0, null]);
            }
            logger.info(`[OttorackService] Created ${shelfCount} empty shelves for rack ${rackId}`);
        } catch (error) {
            logger.error(`[OttorackService] Error creating shelves for rack ${rackId}: ${error.message}`);
            throw error;
        }
    },

    /**
     * Get all Ottoracks
     */
    async getAllOttoracks() {
        const sql = `SELECT id, name, shelf_count, shelf_spacing_mm, bed_size, created_at FROM storage_racks ORDER BY created_at DESC`;
        
        try {
            return await dbAll(sql);
        } catch (error) {
            logger.error(`[OttorackService] Error getting all Ottoracks: ${error.message}`);
            throw error;
        }
    },

    /**
     * Get Ottorack by ID with shelf details
     */
    async getOttorackById(id) {
        const rackSql = `SELECT id, name, shelf_count, shelf_spacing_mm, bed_size, created_at FROM storage_racks WHERE id = ?`;
        const shelvesSql = `
            SELECT 
                rs.id,
                rs.slot_number,
                rs.type,
                rs.has_plate,
                rs.plate_state,
                rs.print_job_id,
                pj.status as job_status,
                pi.file_details_json 
            FROM rack_slots rs
            LEFT JOIN print_jobs pj ON rs.print_job_id = pj.id
            LEFT JOIN print_items pi ON pj.print_item_id = pi.id
            WHERE rs.storage_rack_id = ?
            ORDER BY rs.slot_number ASC
        `;
        
        try {
            const rack = await dbGet(rackSql, [id]);
            if (!rack) return null;
            
            const shelves = await dbAll(shelvesSql, [id]);
            
            // Format shelves according to API spec
            const formattedShelves = shelves.map(shelf => {
                const formattedShelf = {
                    id: shelf.id,              // Real database ID
                    shelf_number: shelf.slot_number, // Physical position
                    type: shelf.type,
                    occupied: Boolean(shelf.occupied),
                    has_plate: Boolean(shelf.has_plate),
                    plate_state: shelf.plate_state
                };

                // Add print_job details if shelf is occupied
                if (shelf.occupied && shelf.print_job_id) {
                    let fileName = null;
                    if (shelf.file_details_json) {
                        try {
                            const fileDetails = JSON.parse(shelf.file_details_json);
                            fileName = fileDetails.name;
                        } catch (e) {
                            fileName = 'Unknown file';
                        }
                    }
                    
                    formattedShelf.print_job = {
                        id: shelf.print_job_id,
                        file_name: fileName,
                        status: shelf.job_status || 'unknown',
                        submitted_at: null 
                    };
                }

                return formattedShelf;
            });
            
            return {
                ...rack,
                shelves: formattedShelves
            };
        } catch (error) {
            logger.error(`[OttorackService] Error getting Ottorack ${id}: ${error.message}`);
            throw error;
        }
    },

    /**
     * Update a specific shelf in an Ottorack
     * Enhanced to support plate tracking fields
     */
    async updateShelf(rackId, shelfNumber, updateData) {
        const { occupied, print_job_id, has_plate, plate_state } = updateData;
        
        // Build dynamic SQL based on provided fields
        const updateFields = [];
        const updateValues = [];
        
        if (occupied !== undefined) {
            updateFields.push('occupied = ?');
            updateValues.push(occupied ? 1 : 0);
        }
        
        if (print_job_id !== undefined) {
            updateFields.push('print_job_id = ?');
            updateValues.push(print_job_id);
        }
        
        if (has_plate !== undefined) {
            updateFields.push('has_plate = ?');
            updateValues.push(has_plate ? 1 : 0);
        }
        
        if (plate_state !== undefined) {
            updateFields.push('plate_state = ?');
            updateValues.push(plate_state);
        }
        
        if (updateFields.length === 0) {
            throw new Error('No valid fields provided for update');
        }
        
        // Debug logging to see what's being updated
        logger.debug(`[OttorackService] Updating shelf ${shelfNumber} in rack ${rackId} with:`, updateData);
        logger.debug(`[OttorackService] SQL fields: ${updateFields.join(', ')}`);
        logger.debug(`[OttorackService] SQL values before WHERE:`, updateValues);
        
        // Add WHERE clause parameters
        updateValues.push(rackId, shelfNumber);
        
        logger.debug(`[OttorackService] Final SQL values:`, updateValues);
        
        const sql = `
            UPDATE rack_slots 
            SET ${updateFields.join(', ')}
            WHERE storage_rack_id = ? AND slot_number = ?
        `;
        
        logger.debug(`[OttorackService] Final SQL:`, sql);
        
        try {
            const result = await dbRun(sql, updateValues);
            
            logger.debug(`[OttorackService] Update result:`, { changes: result.changes, lastID: result.lastID });
            
            if (result.changes === 0) {
                throw new Error(`Shelf ${shelfNumber} not found in rack ${rackId}`);
            }
            
            // Return updated shelf info with all fields
            const shelfSql = `
                SELECT id, slot_number, type, occupied, has_plate, plate_state, print_job_id 
                FROM rack_slots 
                WHERE storage_rack_id = ? AND slot_number = ?
            `;
            
            const shelf = await dbGet(shelfSql, [rackId, shelfNumber]);
            
            return {
                id: shelf.id,
                shelf_number: shelf.slot_number,
                type: shelf.type,
                occupied: Boolean(shelf.occupied),
                has_plate: Boolean(shelf.has_plate),
                plate_state: shelf.plate_state,
                print_job_id: shelf.print_job_id
            };
        } catch (error) {
            logger.error(`[OttorackService] Error updating shelf ${shelfNumber} in rack ${rackId}: ${error.message}`);
            throw error;
        }
    },

    /**
     * Get shelf by ID for event handling
     */
    async getShelfById(rackId, shelfNumber) {
        const sql = `
            SELECT id, slot_number, type, occupied, print_job_id 
            FROM rack_slots 
            WHERE storage_rack_id = ? AND slot_number = ?
        `;
        
        try {
            const shelf = await dbGet(sql, [rackId, shelfNumber]);
            
            if (!shelf) {
                throw new Error(`Shelf ${shelfNumber} not found in rack ${rackId}`);
            }
            
            return {
                id: shelf.id,
                shelf_number: shelf.slot_number,
                type: shelf.type,
                occupied: Boolean(shelf.occupied),
                print_job_id: shelf.print_job_id
            };
        } catch (error) {
            logger.error(`[OttorackService] Error getting shelf ${shelfNumber} in rack ${rackId}: ${error.message}`);
            throw error;
        }
    },

    /**
     * Reset a shelf to default state
     * Enhanced to properly reset plate tracking fields
     */
    async resetShelf(rackId, shelfNumber) {
        const sql = `
            UPDATE rack_slots 
            SET occupied = 0, print_job_id = NULL, has_plate = 0, plate_state = NULL
            WHERE storage_rack_id = ? AND slot_number = ?
        `;
        
        try {
            const result = await dbRun(sql, [rackId, shelfNumber]);
            
            if (result.changes === 0) {
                throw new Error(`Shelf ${shelfNumber} not found in rack ${rackId}`);
            }
            
            logger.info(`[OttorackService] Reset shelf ${shelfNumber} in rack ${rackId}`);
            
            // Get the actual shelf info to return proper response with all fields
            const shelfSql = `
                SELECT id, slot_number, type, occupied, has_plate, plate_state, print_job_id
                FROM rack_slots 
                WHERE storage_rack_id = ? AND slot_number = ?
            `;
            
            const shelf = await dbGet(shelfSql, [rackId, shelfNumber]);
            
            return {
                id: shelf.id,
                shelf_number: shelf.slot_number,
                type: shelf.type,
                occupied: false,
                has_plate: false,
                plate_state: null,
                print_job_id: null
            };
        } catch (error) {
            logger.error(`[OttorackService] Error resetting shelf ${shelfNumber} in rack ${rackId}: ${error.message}`);
            throw error;
        }
    }
};

module.exports = ottorackService;
