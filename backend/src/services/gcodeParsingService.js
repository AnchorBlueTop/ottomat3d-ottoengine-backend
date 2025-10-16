// backend/src/services/gcodeParsingService.js

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const logger = require('../utils/logger');
const readline = require('readline');

const gcodeParsingService = {
    async parseGcodeFile(filePath) {
        logger.info(`[GcodeParsingService] Parsing .3mf file: ${filePath}`);
        const tempExtractionPath = path.join(path.dirname(filePath), `temp_extract_${Date.now()}`);
        
        try {
            await fs.promises.mkdir(tempExtractionPath, { recursive: true });

            const zip = new AdmZip(filePath);
            zip.extractAllTo(tempExtractionPath, true);
            logger.debug(`[GcodeParsingService] Extracted .3mf to ${tempExtractionPath}`);

            // === ENHANCED: Dynamic plate file detection ===
            const { gcodeFilePath, jsonFilePath } = await this._findPlateFiles(tempExtractionPath);

            // Read G-code header for metadata extraction
            const gcodeHeaderContent = await this._readGcodeHeader(gcodeFilePath, 500);
            
            const jsonContent = await fs.promises.readFile(jsonFilePath, 'utf-8');
            const plateJson = JSON.parse(jsonContent);

            // Extract metadata including max_z_height
            const filament_used_g = this._extractMetadata(gcodeHeaderContent, /total filament weight \[g\]\s*:\s*([\d.]+)/);
            const duration_string = this._extractMetadata(gcodeHeaderContent, /total estimated time:\s*(.*)/, 'string');
            const max_z_height_mm = this._extractMetadata(gcodeHeaderContent, /max_z_height:\s*([\d.]+)/);
            const filament_type = this._extractMetadata(gcodeHeaderContent, /filament_type\s*=\s*(.*)/, 'string');
            
            let x_mm = null;
            let y_mm = null;
            if (plateJson.bbox_all && plateJson.bbox_all.length === 4) {
                const [min_x, min_y, max_x, max_y] = plateJson.bbox_all;
                x_mm = parseFloat((max_x - min_x).toFixed(2));
                y_mm = parseFloat((max_y - min_y).toFixed(2));
            } else {
                logger.warn('[GcodeParsingService] bbox_all not found in plate JSON. Cannot calculate x/y dimensions.');
            }
            
            const metadata = {
                filament_used_g: filament_used_g,
                duration: duration_string, 
                dimensions: {
                    x: x_mm,
                    y: y_mm,
                    z: max_z_height_mm  // Height is available here in the z field
                },
                filament_type: filament_type || "Unknown"
            };
            
            logger.info(`[GcodeParsingService] Successfully parsed metadata:`, metadata);
            return { success: true, data: metadata };

        } catch (error) {
            logger.error(`[GcodeParsingService] Error parsing .3mf file ${filePath}: ${error.message}`, error);
            return { success: false, message: `Failed to parse .3mf file: ${error.message}` };
        } finally {
            try {
                await fs.promises.rm(tempExtractionPath, { recursive: true, force: true });
                logger.debug(`[GcodeParsingService] Cleaned up temp directory: ${tempExtractionPath}`);
            } catch (cleanupError) {
                logger.error(`[GcodeParsingService] Failed to clean up temp directory ${tempExtractionPath}: ${cleanupError.message}`);
            }
        }
    },

    /**
     * === NEW: Dynamic plate file detection ===
     * Finds any plate_*.gcode and corresponding plate_*.json files in the extraction
     * @param {string} tempExtractionPath - Path to extracted .3mf contents
     * @returns {Promise<{gcodeFilePath: string, jsonFilePath: string}>}
     * @private
     */
    async _findPlateFiles(tempExtractionPath) {
        const metadataDir = path.join(tempExtractionPath, 'Metadata');
        
        try {
            const files = await fs.promises.readdir(metadataDir);
            
            // Find any plate_*.gcode file (excluding .md5 files)
            const gcodeFiles = files.filter(file => 
                file.match(/^plate_\d+\.gcode$/) && !file.endsWith('.md5')
            );
            
            if (gcodeFiles.length === 0) {
                throw new Error('No plate_*.gcode file found in .3mf archive');
            }
            
            // Use the first plate file found
            const gcodeFileName = gcodeFiles[0];
            const plateNumber = gcodeFileName.match(/^plate_(\d+)\.gcode$/)[1];
            
            const gcodeFilePath = path.join(metadataDir, gcodeFileName);
            const jsonFilePath = path.join(metadataDir, `plate_${plateNumber}.json`);
            
            // Verify both files exist
            if (!await this._fileExists(gcodeFilePath)) {
                throw new Error(`G-code file not found: ${gcodeFileName}`);
            }
            if (!await this._fileExists(jsonFilePath)) {
                throw new Error(`JSON file not found: plate_${plateNumber}.json`);
            }
            
            logger.debug(`[GcodeParsingService] Found plate files: ${gcodeFileName} and plate_${plateNumber}.json`);
            
            return { gcodeFilePath, jsonFilePath };
            
        } catch (error) {
            throw new Error(`Failed to find plate files in .3mf archive: ${error.message}`);
        }
    },

    /**
     * Check if a file exists
     * @param {string} filePath - Path to check
     * @returns {Promise<boolean>}
     * @private
     */
    async _fileExists(filePath) {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Reads only the first N lines of a file, which is much faster for large files.
     * @param {string} filePath The path to the file.
     * @param {number} maxLines The maximum number of lines to read.
     * @returns {Promise<string>} A promise that resolves to the header content.
     * @private
     */
    _readGcodeHeader(filePath, maxLines) {
        return new Promise((resolve, reject) => {
            const fileStream = fs.createReadStream(filePath);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            let content = '';
            let lineCount = 0;

            rl.on('line', (line) => {
                lineCount++;
                content += line + '\n';
                if (lineCount >= maxLines) {
                    rl.close();
                    fileStream.destroy();
                }
            });

            rl.on('close', () => {
                logger.debug(`[GcodeParsingService] Read ${lineCount} lines from G-code header.`);
                resolve(content);
            });

            rl.on('error', (err) => {
                reject(err);
            });
        });
    },

    _extractMetadata(content, regex, type = 'number') {
        const match = content.match(regex);
        if (match && match[1]) {
            if (type === 'number') {
                return parseFloat(match[1]);
            }
            return match[1].trim();
        }
        return null;
    }
};

module.exports = gcodeParsingService;