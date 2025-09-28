const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const orchestratorService = require('../services/orchestratorService');

/**
 * Phase 3 Orchestration Status API Routes
 * 
 * Provides endpoints for monitoring the orchestrator service
 * and getting real-time status of the Phase 3 workflow execution
 * 
 * FIXED: Now uses orchestratorService directly instead of duplicate printDispatchService
 */

/**
 * GET /api/orchestration/status
 * Get overall orchestration system status
 */
router.get('/status', async (req, res) => {
    try {
        const orchestratorStats = orchestratorService.getStats();
        const jobProcessingStatus = orchestratorService.getJobProcessingStatus();
        
        const status = {
            timestamp: new Date().toISOString(),
            phase3: {
                orchestrator: {
                    initialized: orchestratorService.isInitialized,
                    job_processing_enabled: jobProcessingStatus.enabled,
                    polling_active: jobProcessingStatus.polling_active,
                    active_workflows: jobProcessingStatus.active_workflows.length,
                    statistics: orchestratorStats
                },
                activeJobs: jobProcessingStatus.active_workflows.length,
                monitoring: jobProcessingStatus.active_workflows
            },
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                nodeVersion: process.version
            }
        };
        
        res.json({
            success: true,
            data: status
        });
        
    } catch (error) {
        logger.error('Error getting orchestration status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get orchestration status',
            message: error.message
        });
    }
});

/**
 * GET /api/orchestration/active-jobs
 * Get currently active print jobs being monitored
 */
router.get('/active-jobs', async (req, res) => {
    try {
        const jobProcessingStatus = orchestratorService.getJobProcessingStatus();
        const activeWorkflows = jobProcessingStatus.active_workflows || [];
        
        res.json({
            success: true,
            data: {
                activeJobs: activeWorkflows.length,
                jobs: activeWorkflows
            }
        });
        
    } catch (error) {
        logger.error('Error getting active jobs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get active jobs',
            message: error.message
        });
    }
});

/**
 * POST /api/orchestration/restart
 * Restart the orchestrator job processing
 */
router.post('/restart', async (req, res) => {
    try {
        logger.info('Restarting orchestrator job processing via API request');
        
        // Disable and re-enable job processing to restart
        orchestratorService.disableJobProcessing();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        orchestratorService.enableJobProcessing();
        
        res.json({
            success: true,
            message: 'Orchestrator job processing restarted successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Error restarting orchestrator job processing:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to restart orchestrator job processing',
            message: error.message
        });
    }
});

/**
 * GET /api/orchestration/health
 * Health check endpoint for Phase 3 services
 */
router.get('/health', async (req, res) => {
    try {
        const healthCheck = await orchestratorService.healthCheck();
        
        const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
        
        res.status(statusCode).json({
            success: true,
            data: healthCheck
        });
        
    } catch (error) {
        logger.error('Error checking health:', error);
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            message: error.message
        });
    }
});

module.exports = router;
