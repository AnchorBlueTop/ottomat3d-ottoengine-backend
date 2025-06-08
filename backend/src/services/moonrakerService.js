// backend/src/services/moonrakerService.js
// This should be largely fine for v0.1, review timeouts.

const axios = require('axios');
const logger = require('../utils/logger');

// You increased this to 300000 (300s == 5min) before, which is probably good.
const MOONRAKER_TIMEOUT_MS = (1000 * 300); // Check if this is still your preferred value


const moonrakerService = {
    getBaseUrl(ipAddressOrHostname, port = 7125) {
        if (ipAddressOrHostname.startsWith('http://') || ipAddressOrHostname.startsWith('https://')) {
            return ipAddressOrHostname;
        }
        return `http://${ipAddressOrHostname}:${port}`;
    },

    async executeGcode(deviceIp, gcodeScript) {
        const baseUrl = this.getBaseUrl(deviceIp);
        const url = `${baseUrl}/printer/gcode/script`;
        const params = { script: gcodeScript };
        logger.info(`[MoonrakerService] Sending G-code to ${baseUrl}: ${gcodeScript.split('\n')[0]}...`);

        try {
            const response = await axios.post(url, null, {
                params: params,
                timeout: MOONRAKER_TIMEOUT_MS
            });
            logger.debug(`[MoonrakerService] G-code response from ${baseUrl}: ${response.status}`, response.data);

            // For v0.1 proxy, we might simplify: just return success if 2xx, or throw error.
            // The Python script can inspect the full response if needed.
            if (response.status >= 200 && response.status < 300) {
                 // Check if Moonraker itself reported an error within a 200 OK response
                 if (response.data && response.data.error) {
                    logger.error(`[MoonrakerService] Moonraker error for G-code on ${baseUrl}: ${response.data.error.message}`);
                    throw new Error(`Moonraker G-code error: ${response.data.error.message}`);
                 }
                 // Consider 'ok' or results containing 'ok' as success for command acceptance.
                 // Or simply rely on HTTP 200 OK as basic acceptance.
                 if (response.data && (response.data.result === 'ok' || response.data.result?.includes('ok'))) {
                    return { success: true, data: response.data };
                 } else {
                    // If result is not "ok" but still HTTP 200, treat as potential issue for v0.1, or success.
                    // For a simple proxy, just returning the data might be enough.
                    logger.warn(`[MoonrakerService] G-code response from ${baseUrl} was HTTP 200 but result not 'ok':`, response.data);
                    return { success: true, data: response.data }; // Still forward it
                 }
            } else {
                // This case should ideally be caught by axios throwing for non-2xx status codes.
                logger.error(`[MoonrakerService] Unexpected HTTP status ${response.status} for G-code on ${baseUrl}`);
                throw new Error(`Failed to execute G-code: HTTP Error ${response.status}`);
            }
        } catch (error) {
            logger.error(`[MoonrakerService] Error executing G-code on ${baseUrl} for script "${gcodeScript.split('\n')[0]}..."`);
            if (error.response) {
                logger.error(` - Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
                const moonrakerErrorMsg = error.response.data?.error?.message || `HTTP Error ${error.response.status}`;
                throw new Error(`Failed to execute G-code: ${moonrakerErrorMsg}`);
            } else if (error.request) {
                logger.error(` - No response received: ${error.message} (Code: ${error.code})`);
                throw new Error(`Failed to execute G-code: No response from ${deviceIp} (${error.code || 'Network Error'})`);
            } else {
                logger.error(` - Request setup error: ${error.message}`);
                throw new Error(`Failed to execute G-code: Request setup error - ${error.message}`);
            }
        }
    },

    async queryObjects(deviceIp, objects // e.g., ['idle_timeout'] or just 'idle_timeout' as string
    ) {
        const baseUrl = this.getBaseUrl(deviceIp);
        let queryString = "";
        if (Array.isArray(objects)) {
            queryString = objects.map(obj => `${encodeURIComponent(obj)}`).join('&');
        } else if (typeof objects === 'string') {
            queryString = encodeURIComponent(objects);
        } else {
            throw new Error("Invalid 'objects' parameter for queryObjects. Must be string or array of strings.");
        }
        
        const url = `${baseUrl}/printer/objects/query?${queryString}`;
        logger.debug(`[MoonrakerService] Querying objects from ${baseUrl}: ${queryString}`);

         try {
             const response = await axios.get(url, { timeout: MOONRAKER_TIMEOUT_MS / 2 }); // Shorter timeout for status
             logger.debug(`[MoonrakerService] Object query response from ${baseUrl}: ${response.status}`);
             if (response.data && response.data.result) {
                 return { success: true, data: response.data.result };
             } else {
                  logger.warn(`[MoonrakerService] Unexpected object query response format from ${baseUrl}:`, response.data);
                  throw new Error(`Unexpected response format during object query from ${deviceIp}`);
             }
         } catch (error) { // Simplified error handling for v0.1
             logger.error(`[MoonrakerService] Failed to query objects on ${baseUrl}: ${error.message}`);
             const errorMessage = error.response?.data?.error?.message || error.message;
             throw new Error(`Failed to query objects from ${deviceIp}: ${errorMessage}`);
         }
    }

};

module.exports = moonrakerService;