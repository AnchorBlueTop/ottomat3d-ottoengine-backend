// src/services/rackEventEmitter.js
// Global event emitter for rack state changes

const { EventEmitter } = require('events');
const logger = require('../utils/logger');

// Create a global event emitter for rack state changes
const rackEventEmitter = new EventEmitter();

// Set max listeners to support multiple orchestrator instances
rackEventEmitter.setMaxListeners(20);

/**
 * Emit shelf updated event
 * @param {Object} eventData - Event data
 * @param {number} eventData.rackId - Rack ID
 * @param {number} eventData.shelfId - Shelf ID
 * @param {string} eventData.previousState - Previous state ('empty', 'occupied', 'unknown')
 * @param {string} eventData.newState - New state ('empty', 'occupied')
 * @param {number|null} eventData.printJobId - Print job ID if applicable
 * @param {string} eventData.triggeredBy - Source of the change ('manual_api', 'orchestrator', 'bulk_update')
 * @param {string} eventData.userId - User ID who triggered the change
 */
function emitShelfUpdated(eventData) {
    const eventPayload = {
        eventType: 'shelfUpdated',
        rackId: eventData.rackId,
        shelfId: eventData.shelfId,
        previousState: eventData.previousState,
        newState: eventData.newState,
        printJobId: eventData.printJobId || null,
        timestamp: new Date().toISOString(),
        triggeredBy: eventData.triggeredBy,
        userId: eventData.userId || 'unknown'
    };
    
    logger.debug(`[RackEventEmitter] Emitting shelfUpdated event: Rack ${eventData.rackId}, Shelf ${eventData.shelfId} -> ${eventData.newState}`);
    
    // Emit the specific event and a general rackStateChanged event
    rackEventEmitter.emit('shelfUpdated', eventPayload);
    rackEventEmitter.emit('rackStateChanged', eventPayload);
}

/**
 * Emit shelf reset event
 * @param {Object} eventData - Event data
 * @param {number} eventData.rackId - Rack ID
 * @param {number} eventData.shelfId - Shelf ID
 * @param {string} eventData.previousState - Previous state ('empty', 'occupied', 'unknown')
 * @param {string} eventData.triggeredBy - Source of the change ('manual_api', 'orchestrator', 'bulk_update')
 * @param {string} eventData.userId - User ID who triggered the change
 */
function emitShelfReset(eventData) {
    const eventPayload = {
        eventType: 'shelfReset',
        rackId: eventData.rackId,
        shelfId: eventData.shelfId,
        previousState: eventData.previousState,
        newState: 'empty',
        timestamp: new Date().toISOString(),
        triggeredBy: eventData.triggeredBy,
        userId: eventData.userId || 'unknown'
    };
    
    logger.debug(`[RackEventEmitter] Emitting shelfReset event: Rack ${eventData.rackId}, Shelf ${eventData.shelfId} -> empty`);
    
    // Emit the specific event and a general rackStateChanged event
    rackEventEmitter.emit('shelfReset', eventPayload);
    rackEventEmitter.emit('rackStateChanged', eventPayload);
}

/**
 * Emit bulk rack update event
 * @param {Object} eventData - Event data
 * @param {number} eventData.rackId - Rack ID
 * @param {Array} eventData.changedSlots - Array of changed slots
 * @param {string} eventData.triggeredBy - Source of the change
 * @param {string} eventData.userId - User ID who triggered the change
 */
function emitRackBulkUpdate(eventData) {
    const eventPayload = {
        eventType: 'rackBulkUpdate',
        rackId: eventData.rackId,
        changedSlots: eventData.changedSlots,
        timestamp: new Date().toISOString(),
        triggeredBy: eventData.triggeredBy,
        userId: eventData.userId || 'unknown'
    };
    
    logger.debug(`[RackEventEmitter] Emitting rackBulkUpdate event: Rack ${eventData.rackId}, ${eventData.changedSlots.length} slots changed`);
    
    // Emit the specific event and a general rackStateChanged event
    rackEventEmitter.emit('rackBulkUpdate', eventPayload);
    rackEventEmitter.emit('rackStateChanged', eventPayload);
}

/**
 * Emit orchestrator-triggered rack state change
 * @param {Object} eventData - Event data
 * @param {number} eventData.rackId - Rack ID
 * @param {number} eventData.shelfId - Shelf ID
 * @param {string} eventData.previousState - Previous state
 * @param {string} eventData.newState - New state
 * @param {number|null} eventData.printJobId - Print job ID if applicable
 * @param {string} eventData.operationId - Orchestrator operation ID
 */
function emitOrchestratorUpdate(eventData) {
    const eventPayload = {
        eventType: 'shelfUpdated',
        rackId: eventData.rackId,
        shelfId: eventData.shelfId,
        previousState: eventData.previousState,
        newState: eventData.newState,
        printJobId: eventData.printJobId || null,
        timestamp: new Date().toISOString(),
        triggeredBy: 'orchestrator',
        operationId: eventData.operationId
    };
    
    logger.debug(`[RackEventEmitter] Emitting orchestrator update: Rack ${eventData.rackId}, Shelf ${eventData.shelfId} -> ${eventData.newState}`);
    
    // Emit the general rackStateChanged event (orchestrator events don't trigger conflict resolution)
    rackEventEmitter.emit('rackStateChanged', eventPayload);
}

// Export the event emitter instance and helper methods
module.exports = {
    rackEventEmitter,
    emitShelfUpdated,
    emitShelfReset,
    emitRackBulkUpdate,
    emitOrchestratorUpdate,
    
    // Direct access to EventEmitter methods
    on: (event, listener) => rackEventEmitter.on(event, listener),
    off: (event, listener) => rackEventEmitter.off(event, listener),
    once: (event, listener) => rackEventEmitter.once(event, listener),
    emit: (event, ...args) => rackEventEmitter.emit(event, ...args),
    removeAllListeners: (event) => rackEventEmitter.removeAllListeners(event),
    setMaxListeners: (n) => rackEventEmitter.setMaxListeners(n)
};
