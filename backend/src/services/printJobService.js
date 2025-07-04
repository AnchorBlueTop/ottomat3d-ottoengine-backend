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

    async createPrintItem(fileData) {
        const {
            file_details_json, duration_details_json,
            measurement_details_json, filament_details_json
        } = fileData;
        const sql = `
            INSERT INTO print_items (file_details_json, duration_details_json, measurement_details_json, filament_details_json)
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

    async getPrintItemById(id) {
        try {
            return await dbGet('SELECT * FROM print_items WHERE id = ?', [id]);
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

    async getPrintJobById(id) {
        const sql = `
            SELECT 
                pj.*,
                pi.duration_details_json
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

    async getAllPrintJobs() {
        const sql = `
            SELECT 
                pj.*,
                pi.duration_details_json
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