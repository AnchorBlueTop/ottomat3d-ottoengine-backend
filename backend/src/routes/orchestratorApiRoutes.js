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
        // Serialize workflows safely (exclude circular references like timeouts)
        const workflows = Array.from(orchestratorService.activeWorkflows.values()).map(workflow => ({
            jobId: workflow.jobId,
            printerId: workflow.printerId,
            rackId: workflow.rackId,
            storeSlot: workflow.storeSlot,
            postPrintGrabSlot: workflow.postPrintGrabSlot || null, // Which slot we'll grab from after storing
            phase: workflow.phase,
            startTime: workflow.startTime,
            lastUpdate: workflow.lastUpdate,
            error: workflow.error || null
        }));

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

/**
 * GET /api/orchestrator/debug
 * Comprehensive debug information for troubleshooting
 * Shows active workflows, locks, phases, monitoring status, and system state
 */
router.get('/debug', async (req, res, next) => {
    try {
        // Get active workflows with detailed information
        const activeWorkflows = Array.from(orchestratorService.activeWorkflows.values()).map(workflow => {
            const age = Date.now() - workflow.startTime;
            const lastUpdateAge = Date.now() - workflow.lastUpdate;

            return {
                jobId: workflow.jobId,
                printerId: workflow.printerId,
                ottoejectId: workflow.ottoejectId || null,
                rackId: workflow.rackId,
                storeSlot: workflow.storeSlot,
                postPrintGrabSlot: workflow.postPrintGrabSlot || null,
                phase: workflow.phase,
                startTime: workflow.startTime,
                lastUpdate: workflow.lastUpdate,
                ageMinutes: Math.floor(age / 60000),
                lastUpdateSeconds: Math.floor(lastUpdateAge / 1000),
                monitoringActive: !!workflow.monitorInterval,
                monitoringStartTime: workflow.monitoringStartTime || null,
                error: workflow.error || null,
                // Flag stale workflows
                isStale: lastUpdateAge > (10 * 60 * 1000)
            };
        });

        // Get locked resources
        const lockedPrinters = Array.from(orchestratorService.activePrinters);
        const lockedOttoejects = Array.from(orchestratorService.activeOttoejects);

        // Get rack state cache info
        const cacheInfo = {
            size: orchestratorService.rackStateCache.size,
            entries: Array.from(orchestratorService.rackStateCache.entries()).map(([rackId, cached]) => ({
                rackId,
                ageSeconds: Math.floor((Date.now() - cached.timestamp) / 1000)
            }))
        };

        // Get slot managers info
        const slotManagersInfo = {
            count: orchestratorService.slotManagers.size,
            rackIds: Array.from(orchestratorService.slotManagers.keys())
        };

        // Check for potential issues
        const issues = [];

        // Check for stale workflows
        const staleWorkflows = activeWorkflows.filter(wf => wf.isStale);
        if (staleWorkflows.length > 0) {
            issues.push({
                type: 'stale_workflows',
                severity: 'critical',
                message: `${staleWorkflows.length} workflow(s) have not updated in over 10 minutes`,
                affectedJobs: staleWorkflows.map(wf => wf.jobId)
            });
        }

        // Check for workflows without monitoring
        const workflowsWithoutMonitoring = activeWorkflows.filter(
            wf => wf.phase === 'printing' && !wf.monitoringActive
        );
        if (workflowsWithoutMonitoring.length > 0) {
            issues.push({
                type: 'missing_monitoring',
                severity: 'warning',
                message: `${workflowsWithoutMonitoring.length} printing job(s) without active monitoring`,
                affectedJobs: workflowsWithoutMonitoring.map(wf => wf.jobId)
            });
        }

        // Check for locked resources without workflows
        const workflowPrinters = new Set(activeWorkflows.map(wf => wf.printerId));
        const orphanedPrinterLocks = lockedPrinters.filter(id => !workflowPrinters.has(id));
        if (orphanedPrinterLocks.length > 0) {
            issues.push({
                type: 'orphaned_printer_locks',
                severity: 'warning',
                message: `${orphanedPrinterLocks.length} printer(s) locked without active workflow`,
                affectedPrinters: orphanedPrinterLocks
            });
        }

        const workflowOttoejects = new Set(activeWorkflows.map(wf => wf.ottoejectId).filter(id => id));
        const orphanedOttoejectLocks = lockedOttoejects.filter(id => !workflowOttoejects.has(id));
        if (orphanedOttoejectLocks.length > 0) {
            issues.push({
                type: 'orphaned_ottoeject_locks',
                severity: 'warning',
                message: `${orphanedOttoejectLocks.length} ottoeject(s) locked without active workflow`,
                affectedOttoejects: orphanedOttoejectLocks
            });
        }

        // Build comprehensive debug response
        const debugInfo = {
            status: issues.length === 0 ? 'healthy' : 'issues_detected',
            timestamp: new Date().toISOString(),

            // System state
            system: {
                isInitialized: orchestratorService.isInitialized,
                isShuttingDown: orchestratorService.isShuttingDown,
                jobProcessingEnabled: orchestratorService.jobProcessingEnabled,
                pollingActive: !!orchestratorService.jobPollingInterval
            },

            // Active workflows
            workflows: {
                count: activeWorkflows.length,
                details: activeWorkflows,
                byPhase: activeWorkflows.reduce((acc, wf) => {
                    acc[wf.phase] = (acc[wf.phase] || 0) + 1;
                    return acc;
                }, {})
            },

            // Resource locks
            locks: {
                printers: {
                    count: lockedPrinters.length,
                    ids: lockedPrinters,
                    orphaned: orphanedPrinterLocks
                },
                ottoejects: {
                    count: lockedOttoejects.length,
                    ids: lockedOttoejects,
                    orphaned: orphanedOttoejectLocks
                }
            },

            // Cache state
            cache: cacheInfo,

            // Slot managers
            slotManagers: slotManagersInfo,

            // Detected issues
            issues: {
                count: issues.length,
                details: issues
            }
        };

        res.status(200).json(debugInfo);

    } catch (error) {
        logger.error('[OrchestratorAPI] Error getting debug info:', error.message);
        next(error);
    }
});

module.exports = router;
