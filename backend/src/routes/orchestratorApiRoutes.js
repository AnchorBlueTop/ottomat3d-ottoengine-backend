// backend/src/routes/orchestratorApiRoutes.js
// API routes for orchestrator debugging and monitoring

const express = require('express');
const router = express.Router();
const orchestratorService = require('../services/orchestratorService');
const logger = require('../utils/logger');

// Middleware for logging orchestrator API requests
router.use((req, res, next) => {
    logger.debug(`[OrchestratorAPI] ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
    next();
});

/**
 * GET /api/orchestrator/status
 * Get overall orchestrator status and statistics
 */
router.get('/status', async (req, res, next) => {
    try {
        const stats = orchestratorService.getStats();
        const jobStatus = orchestratorService.getJobProcessingStatus();
        
        res.status(200).json({
            status: 'operational',
            initialized: orchestratorService.isInitialized,
            statistics: stats,
            job_processing: jobStatus,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('[OrchestratorAPI] Error getting status:', error.message);
        next(error);
    }
});

/**
 * GET /api/orchestrator/health
 * Comprehensive health check for orchestrator service
 */
router.get('/health', async (req, res, next) => {
    try {
        const health = await orchestratorService.healthCheck();
        
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
        
    } catch (error) {
        logger.error('[OrchestratorAPI] Error getting health:', error.message);
        next(error);
    }
});

/**
 * POST /api/orchestrator/job-processing/enable
 * Enable automatic job processing
 */
router.post('/job-processing/enable', async (req, res, next) => {
    try {
        orchestratorService.enableJobProcessing();
        
        res.status(200).json({
            message: 'Job processing enabled',
            status: orchestratorService.getJobProcessingStatus(),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('[OrchestratorAPI] Error enabling job processing:', error.message);
        next(error);
    }
});

/**
 * POST /api/orchestrator/job-processing/disable
 * Disable automatic job processing
 */
router.post('/job-processing/disable', async (req, res, next) => {
    try {
        orchestratorService.disableJobProcessing();
        
        res.status(200).json({
            message: 'Job processing disabled',
            status: orchestratorService.getJobProcessingStatus(),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('[OrchestratorAPI] Error disabling job processing:', error.message);
        next(error);
    }
});

/**
 * POST /api/orchestrator/trigger-processing
 * Manually trigger job processing (for debugging)
 */
router.post('/trigger-processing', async (req, res, next) => {
    try {
        logger.info('[OrchestratorAPI] Manual job processing trigger requested');
        
        // Trigger processing asynchronously
        orchestratorService.triggerJobProcessing()
            .catch(error => logger.error('[OrchestratorAPI] Manual trigger error:', error.message));
        
        res.status(202).json({
            message: 'Job processing triggered',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('[OrchestratorAPI] Error triggering processing:', error.message);
        next(error);
    }
});

/**
 * POST /api/orchestrator/invalidate-cache
 * Invalidate all cached rack states (for debugging)
 */
router.post('/invalidate-cache', async (req, res, next) => {
    try {
        orchestratorService.invalidateAllCaches();
        
        res.status(200).json({
            message: 'All caches invalidated',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('[OrchestratorAPI] Error invalidating cache:', error.message);
        next(error);
    }
});

/**
 * GET /api/orchestrator/active-workflows
 * Get information about currently active workflows
 */
router.get('/active-workflows', async (req, res, next) => {
    try {
        const workflows = Array.from(orchestratorService.activeWorkflows.values());
        
        res.status(200).json({
            active_count: workflows.length,
            workflows: workflows,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('[OrchestratorAPI] Error getting active workflows:', error.message);
        next(error);
    }
});

/**
 * GET /api/orchestrator/statistics
 * Get detailed orchestrator statistics
 */
router.get('/statistics', async (req, res, next) => {
    try {
        const stats = orchestratorService.getStats();
        
        res.status(200).json({
            ...stats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('[OrchestratorAPI] Error getting statistics:', error.message);
        next(error);
    }
});

module.exports = router;
