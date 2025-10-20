// backend/src/services/ejectionSessionService.js

const { dbRun, dbGet, dbAll } = require('../db/utils');
const logger = require('../utils/logger');

const ejectionSessionService = {
  async start({ job_id = null, printer_id = null, ottoeject_id = null }) {
    const sql = `INSERT INTO ejection_sessions (job_id, printer_id, ottoeject_id, status) VALUES (?, ?, ?, 'STARTED')`;
    try {
      const result = await dbRun(sql, [job_id, printer_id, ottoeject_id]);
      return await dbGet('SELECT * FROM ejection_sessions WHERE id = ?', [result.lastID]);
    } catch (error) {
      logger.error(`[EjectionSessionService] Failed to start session: ${error.message}`);
      throw error;
    }
  },

  async setStatus(id, status, error_message = null) {
    const ended = (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') ? new Date().toISOString() : null;
    const sql = `UPDATE ejection_sessions SET status = ?, error_message = COALESCE(?, error_message), ended_at = COALESCE(?, ended_at) WHERE id = ?`;
    try {
      await dbRun(sql, [status, error_message, ended, id]);
      return await dbGet('SELECT * FROM ejection_sessions WHERE id = ?', [id]);
    } catch (error) {
      logger.error(`[EjectionSessionService] Failed to update session ${id}: ${error.message}`);
      throw error;
    }
  },

  async getById(id) {
    try { return await dbGet('SELECT * FROM ejection_sessions WHERE id = ?', [id]); }
    catch (error) { logger.error(`[EjectionSessionService] Failed getById ${id}: ${error.message}`); throw error; }
  },

  async listByJob(jobId) {
    try { return await dbAll('SELECT * FROM ejection_sessions WHERE job_id = ? ORDER BY created_at DESC', [jobId]); }
    catch (error) { logger.error(`[EjectionSessionService] Failed listByJob ${jobId}: ${error.message}`); throw error; }
  }
};

module.exports = ejectionSessionService;
