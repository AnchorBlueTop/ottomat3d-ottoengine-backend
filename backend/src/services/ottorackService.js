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
     */
    async _createShelvesForRack(rackId, shelfCount) {
        const sql = `
            INSERT INTO rack_slots (storage_rack_id, slot_number, type, occupied, print_job_id)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        try {
            for (let shelfNumber = 1; shelfNumber <= shelfCount; shelfNumber++) {
                await dbRun(sql, [rackId, shelfNumber, 'print_bed', 0, null]);
            }
            logger.info(`[OttorackService] Created ${shelfCount} shelves for rack ${rackId}`);
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
                rs.occupied,
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
                    occupied: Boolean(shelf.occupied)
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
     */
    async updateShelf(rackId, shelfNumber, updateData) {
        const { occupied, print_job_id } = updateData;
        
        const sql = `
            UPDATE rack_slots 
            SET occupied = ?, print_job_id = ?
            WHERE storage_rack_id = ? AND slot_number = ?
        `;
        
        try {
            const result = await dbRun(sql, [occupied ? 1 : 0, print_job_id, rackId, shelfNumber]);
            
            if (result.changes === 0) {
                throw new Error(`Shelf ${shelfNumber} not found in rack ${rackId}`);
            }
            
            // Return updated shelf info
            const shelfSql = `
                SELECT id, slot_number, type, occupied, print_job_id 
                FROM rack_slots 
                WHERE storage_rack_id = ? AND slot_number = ?
            `;
            
            const shelf = await dbGet(shelfSql, [rackId, shelfNumber]);
            
            return {
                id: shelf.id,
                shelf_number: shelf.slot_number,
                type: shelf.type,
                occupied: Boolean(shelf.occupied),
                print_job_id: shelf.print_job_id
            };
        } catch (error) {
            logger.error(`[OttorackService] Error updating shelf ${shelfNumber} in rack ${rackId}: ${error.message}`);
            throw error;
        }
    },

    /**
     * Reset a shelf to default state
     */
    async resetShelf(rackId, shelfNumber) {
        const sql = `
            UPDATE rack_slots 
            SET occupied = 0, print_job_id = NULL 
            WHERE storage_rack_id = ? AND slot_number = ?
        `;
        
        try {
            const result = await dbRun(sql, [rackId, shelfNumber]);
            
            if (result.changes === 0) {
                throw new Error(`Shelf ${shelfNumber} not found in rack ${rackId}`);
            }
            
            logger.info(`[OttorackService] Reset shelf ${shelfNumber} in rack ${rackId}`);
            
            // Get the actual shelf info to return proper response
            const shelfSql = `
                SELECT id, slot_number 
                FROM rack_slots 
                WHERE storage_rack_id = ? AND slot_number = ?
            `;
            
            const shelf = await dbGet(shelfSql, [rackId, shelfNumber]);
            
            return {
                id: shelf.id,
                shelf_number: shelf.slot_number,
                occupied: false,
                print_job_id: null
            };
        } catch (error) {
            logger.error(`[OttorackService] Error resetting shelf ${shelfNumber} in rack ${rackId}: ${error.message}`);
            throw error;
        }
    }
};

module.exports = ottorackService;