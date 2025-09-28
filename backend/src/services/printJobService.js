// backend/src/services/printJobService.js

const { dbRun, dbGet, dbAll } = require('../db/utils');
const logger = require('../utils/logger');

// Helper to enrich job object
const _enrichJob = (job) => {
    if (!job) return null;

    if (job.duration_details_json) {
        try {
            const durationDetails = JSON.parse(job.duration_details_json);
            job.duration = durationDetails.duration || null;
        } catch (e) {
            job.duration = null;
        }
    }
    delete job.duration_details_json;

    return job;
};

const printJobService = {

    /**
     * === ENHANCED: File deduplication logic ===
     * Updates existing print_item if filename exists, otherwise creates new one
     */
    async updateOrCreatePrintItem(fileData) {
        const {
            file_details_json, duration_details_json,
            measurement_details_json, filament_details_json
        } = fileData;

        const filename = file_details_json.name;
        
        try {
            // Check if print item already exists by filename
            const existingItem = await dbGet(
                'SELECT id FROM print_items WHERE JSON_EXTRACT(file_details_json, "$.name") = ?',
                [filename]
            );

            if (existingItem) {
                // Update existing record
                logger.info(`[PrintJobService] Updating existing print_item for file: ${filename}`);
                
                const updateSql = `
                    UPDATE print_items 
                    SET file_details_json = ?,
                        duration_details_json = ?,
                        measurement_details_json = ?,
                        filament_details_json = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `;
                
                await dbRun(updateSql, [
                    JSON.stringify(file_details_json),
                    JSON.stringify(duration_details_json),
                    JSON.stringify(measurement_details_json),
                    JSON.stringify(filament_details_json),
                    existingItem.id
                ]);
                
                return await this.getPrintItemById(existingItem.id);
            } else {
                // Create new record
                logger.info(`[PrintJobService] Creating new print_item for file: ${filename}`);
                return await this.createPrintItem(fileData);
            }
        } catch (error) {
            logger.error(`[PrintJobService] Error in updateOrCreatePrintItem: ${error.message}`);
            throw error;
        }
    },

    /**
     * Create a new print item record in the database
     */
    async createPrintItem(fileData) {
        const {
            file_details_json, duration_details_json,
            measurement_details_json, filament_details_json
        } = fileData;
        
        const sql = `
            INSERT INTO print_items (
                file_details_json, duration_details_json, 
                measurement_details_json, filament_details_json
            )
            VALUES (?, ?, ?, ?)
        `;
        
        try {
            const result = await dbRun(sql, [
                JSON.stringify(file_details_json),
                JSON.stringify(duration_details_json),
                JSON.stringify(measurement_details_json),
                JSON.stringify(filament_details_json)
            ]);
            return await this.getPrintItemById(result.lastID);
        } catch (error) {
            logger.error(`[PrintJobService] Error creating print_item: ${error.message}`);
            throw error;
        }
    },

    /**
     * Get print item by ID with parsed JSON fields
     */
    async getPrintItemById(id) {
        try {
            const sql = 'SELECT * FROM print_items WHERE id = ?';
            const item = await dbGet(sql, [id]);
            
            if (!item) return null;
            
            // Parse JSON fields for easier access
            try {
                item.file_details = JSON.parse(item.file_details_json || '{}');
                item.measurement_details = JSON.parse(item.measurement_details_json || '{}');
                item.filament_details = JSON.parse(item.filament_details_json || '{}');
                item.duration_details = JSON.parse(item.duration_details_json || '{}');
            } catch (parseError) {
                logger.warn(`[PrintJobService] Failed to parse JSON fields for print_item ${id}: ${parseError.message}`);
            }
            
            return item;
        } catch (error) {
            logger.error(`[PrintJobService] Error getting print_item by ID ${id}: ${error.message}`);
            throw error;
        }
    },

    async createPrintJob(jobData) {
        const {
            print_item_id, printer_id, ottoeject_id, auto_start, priority = 1
        } = jobData;
        const initialStatus = 'QUEUED';
        const initialStatusMessage = 'Job has been queued and is awaiting an available printer.';
        const sql = `
            INSERT INTO print_jobs (print_item_id, printer_id, ottoeject_id, auto_start, priority, status, status_message)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [print_item_id, printer_id, ottoeject_id, auto_start ? 1 : 0, priority, initialStatus, initialStatusMessage];
        try {
            const result = await dbRun(sql, params);
            return await this.getPrintJobById(result.lastID);
        } catch (error) {
            logger.error(`[PrintJobService] Error creating print_job: ${error.message}`);
            throw error;
        }
    },

    /**
     * Get print job with enriched data from print item
     */
    async getPrintJobById(id) {
        const sql = `
            SELECT 
                pj.*,
                pi.duration_details_json,
                pi.file_details_json,
                pi.measurement_details_json,
                pi.filament_details_json
            FROM print_jobs pj
            LEFT JOIN print_items pi ON pj.print_item_id = pi.id
            WHERE pj.id = ?
        `;
        try {
            const job = await dbGet(sql, [id]);
            return _enrichJob(job);
        } catch (error) {
            logger.error(`[PrintJobService] Error getting job by ID ${id}: ${error.message}`);
            throw error;
        }
    },

    /**
     * Get all print jobs with enriched data from print items
     */
    async getAllPrintJobs() {
        const sql = `
            SELECT 
                pj.*,
                pi.duration_details_json,
                pi.file_details_json,
                pi.measurement_details_json,
                pi.filament_details_json
            FROM print_jobs pj
            LEFT JOIN print_items pi ON pj.print_item_id = pi.id
            ORDER BY pj.submitted_at DESC
        `;
        try {
            const jobs = await dbAll(sql);
            return jobs.map(_enrichJob);
        } catch (error) {
            logger.error(`[PrintJobService] Error getting all jobs: ${error.message}`);
            throw error;
        }
    },

    async updatePrintJob(id, updateData) {
        const { priority } = updateData;
        const setClauses = [];
        const params = [];
        if (priority !== undefined) {
            setClauses.push('priority = ?');
            params.push(priority);
        }
        if (setClauses.length === 0) {
            logger.warn(`[PrintJobService] Update called for job ${id} with no valid fields.`);
            return this.getPrintJobById(id);
        }
        params.push(id);
        const sql = `UPDATE print_jobs SET ${setClauses.join(', ')} WHERE id = ?`;
        try {
            await dbRun(sql, params);
            return this.getPrintJobById(id);
        } catch (error) {
            logger.error(`[PrintJobService] Error updating job ${id}: ${error.message}`);
            throw error;
        }
    },

    async cancelPrintJob(id) {
        try {
            const job = await this.getPrintJobById(id);
            if (!job) return false;
            if (job.status === 'QUEUED' || job.status === 'NEW') {
                const result = await dbRun('DELETE FROM print_jobs WHERE id = ?', [id]);
                return result.changes > 0;
            }
            logger.warn(`[PrintJobService] Attempted to cancel job ${id} which is in a non-cancellable state: ${job.status}`);
            return false;
        } catch (error) {
            logger.error(`[PrintJobService] Error cancelling job ${id}: ${error.message}`);
            throw error;
        }
    },
    
    async completePrintJob(id) {
        try {
            const timestamp = new Date().toISOString();
            const sql = `UPDATE print_jobs SET status = 'COMPLETED', status_message = 'Job completed and shelf has been cleared.', completed_at = ? WHERE id = ?`;
            await dbRun(sql, [timestamp, id]);
            return this.getPrintJobById(id);
        } catch (error) {
            logger.error(`[PrintJobService] Error completing job ${id}: ${error.message}`);
            throw error;
        }
    }
};

module.exports = printJobService;