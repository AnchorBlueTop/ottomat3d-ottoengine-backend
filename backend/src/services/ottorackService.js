// backend/src/services/ottorackService.js

const { dbRun, dbGet, dbAll } = require('../db/utils');
const logger = require('../utils/logger');

const ottorackService = {

    /**
     * Create a new Ottorack with specified number of shelves
     */
    async createOttorack(rackData) {
        const { name, number_of_shelves, shelf_spacing_mm, bed_size, shelves } = rackData;
        
        const sql = `
            INSERT INTO storage_racks (name, shelf_count, shelf_spacing_mm, bed_size)
            VALUES (?, ?, ?, ?)
        `;
        
        try {
            const result = await dbRun(sql, [name, number_of_shelves, shelf_spacing_mm, bed_size]);
            const rackId = result.lastID;
            
            // Create individual shelves for this rack, honoring optional initial shelf state
            await this._createShelvesForRack(rackId, number_of_shelves, Array.isArray(shelves) ? shelves : undefined);
            
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
     * Initialize slots, optionally using provided initial shelf states.
     * Only two initial states are supported on creation:
     *  - empty (no plate): has_plate=0, plate_state=NULL
     *  - empty_plate: has_plate=1, plate_state='empty'
     */
    async _createShelvesForRack(rackId, shelfCount, initialShelves) {
        const sql = `
            INSERT INTO rack_slots (storage_rack_id, slot_number, type, print_job_id, has_plate, plate_state)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        // Build lookup by slot_number from provided initialShelves
        const initialBySlot = new Map();
        if (Array.isArray(initialShelves)) {
            for (const s of initialShelves) {
                const slot = Number(s.shelf_number ?? s.id);
                if (Number.isFinite(slot)) initialBySlot.set(slot, s);
            }
        }
        
        try {
            for (let shelfNumber = 1; shelfNumber <= shelfCount; shelfNumber++) {
                let has_plate = 0;
                let plate_state = null;
                const init = initialBySlot.get(shelfNumber);
                const t = init?.type || '';
                // Only allow 'empty_plate' at creation; any other non-empty is treated as empty_plate=false
                if (t === 'empty_plate') {
                    has_plate = 1;
                    plate_state = 'empty';
                }
                await dbRun(sql, [rackId, shelfNumber, 'print_bed', null, has_plate, plate_state]);
            }
            logger.info(`[OttorackService] Created ${shelfCount} shelves for rack ${rackId} with initial states`);
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
    async updateShelf(rack_id, shelf_number, updateData) {
        const { has_plate, plate_state, occupied, print_job_id } = updateData;
        
        // DEBUG: Log what we received
        logger.info(`[OttorackService] updateShelf called with:`);
        logger.info(`  rack_id: ${rack_id}`);
        logger.info(`  shelf_number: ${shelf_number}`);
        logger.info(`  has_plate: ${has_plate}`);
        logger.info(`  plate_state: ${plate_state}`);
        logger.info(`  occupied: ${occupied}`);
        logger.info(`  print_job_id: ${print_job_id}`);
        
        const sql = `
            UPDATE rack_slots
            SET occupied = ?,
                has_plate = ?,
                plate_state = ?,
                print_job_id = ?
            WHERE storage_rack_id = ? AND slot_number = ?
        `;
        
        try {
            const params = [
                occupied || 0,
                has_plate ? 1 : 0,
                plate_state,
                print_job_id || null,
                rack_id,
                shelf_number
            ];
            
            logger.info(`[OttorackService] SQL params: ${JSON.stringify(params)}`);
            
            await dbRun(sql, params);
            
            return await this.getShelfById(rack_id, shelf_number);
            
        } catch (error) {
            logger.error(`[OttorackService] Error updating shelf ${shelf_number} in rack ${rack_id}: ${error.message}`);
            throw error;
        }
    },

    /**
     * Get shelf by ID for event handling
     */
    async getShelfById(rackId, shelfNumber) {
        const sql = `
            SELECT id, slot_number, type, occupied, has_plate, plate_state, print_job_id
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
                has_plate: Boolean(shelf.has_plate),
                plate_state: shelf.plate_state,
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
    },

    /**
     * Delete an Ottorack by ID
     */
    async deleteOttorack(id) {
        const sql = `DELETE FROM storage_racks WHERE id = ?`;
        try {
            const result = await dbRun(sql, [id]);
            const success = result.changes > 0;
            if (success) {
                logger.info(`[OttorackService] Deleted Ottorack ${id}`);
            } else {
                logger.warn(`[OttorackService] Attempted to delete non-existent Ottorack ${id}`);
            }
            return success;
        } catch (error) {
            logger.error(`[OttorackService] Error deleting Ottorack ${id}: ${error.message}`);
            throw error;
        }
    },

    /**
     * Update rack metadata (name, shelf_spacing_mm, bed_size)
     */
    async updateOttorackMeta(rackId, { name, shelf_spacing_mm, bed_size }) {
        const fields = [];
        const params = [];
        if (typeof name === 'string' && name.trim()) {
            fields.push('name = ?');
            params.push(name.trim());
        }
        if (typeof shelf_spacing_mm !== 'undefined') {
            fields.push('shelf_spacing_mm = ?');
            params.push(shelf_spacing_mm);
        }
        if (typeof bed_size !== 'undefined') {
            fields.push('bed_size = ?');
            params.push(bed_size);
        }
        if (!fields.length) {
            return await this.getOttorackById(rackId);
        }
        const sql = `UPDATE storage_racks SET ${fields.join(', ')} WHERE id = ?`;
        params.push(rackId);
        await dbRun(sql, params);
        return await this.getOttorackById(rackId);
    }
};

module.exports = ottorackService;
