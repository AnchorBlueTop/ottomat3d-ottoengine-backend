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
 * Comprehensive debug information for troubleshooting
 * Shows active workflows, locks, phases, monitoring status, and system state
 */
router.get('/status', async (req, res) => {
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
                pollingActive: !!orchestratorService.jobPollingInterval,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                nodeVersion: process.version
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

        res.json({
            success: true,
            data: debugInfo
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
