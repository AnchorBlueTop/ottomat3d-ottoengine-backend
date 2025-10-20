// backend/src/services/jobEventService.js

const { dbRun, dbGet, dbAll } = require('../db/utils');
const logger = require('../utils/logger');

const jobEventService = {
  async createEvent(jobId, type, payload = null) {
    const sql = `INSERT INTO job_events (job_id, type, payload_json) VALUES (?, ?, ?)`;
    const params = [jobId, type, payload ? JSON.stringify(payload) : null];
    try {
      const result = await dbRun(sql, params);
      return await dbGet('SELECT * FROM job_events WHERE id = ?', [result.lastID]);
    } catch (error) {
      logger.error(`[JobEventService] Failed to create event for job ${jobId}: ${error.message}`);
      throw error;
    }
  },

  async listByJob(jobId, { limit = 200, offset = 0 } = {}) {
    const sql = `SELECT * FROM job_events WHERE job_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?`;
    try {
      return await dbAll(sql, [jobId, limit, offset]);
    } catch (error) {
      logger.error(`[JobEventService] Failed to list events for job ${jobId}: ${error.message}`);
      throw error;
    }
  }
};

module.exports = jobEventService;
