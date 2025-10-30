'use strict';

// Centralized configuration with sensible defaults.
// Values can be overridden via environment variables or an optional local.js file
// that exports a partial config object. This keeps code references stable while
// allowing per-environment overrides without changing source.

const fs = require('fs');
const path = require('path');

const env = process.env;

const defaults = {
  // Logging
  logLevel: env.LOG_LEVEL || 'INFO',

  // Integration flags
  bambuApiDebug: (env.BAMBU_API_DEBUG || '').toLowerCase() === 'true',

  // Timeouts (milliseconds)
  timeouts: {
    // Used by printerService.connect for temporary, non-persistent connection checks
    printerConnectMs: Number.parseInt(env.PRINTER_CONNECT_TIMEOUT_MS || '20000', 10),
    // Used for the optional pushall() warm-up right after connect
    pushAllMs: Number.parseInt(env.BAMBU_PUSHALL_TIMEOUT_MS || '20000', 10),
    // Generic default for HTTP or other short requests if needed elsewhere
    defaultRequestMs: Number.parseInt(env.DEFAULT_REQUEST_TIMEOUT_MS || '15000', 10),
  },
};

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    const sv = source[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], sv);
    } else {
      target[key] = sv;
    }
  }
  return target;
}

// Optional developer- or environment-specific overrides via local.js
// Do not commit local.js to version control.
let overrides = {};
const localPath = path.join(__dirname, 'local.js');
if (fs.existsSync(localPath)) {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    overrides = require(localPath);
  } catch (e) {
    // If local override cannot be loaded, continue with defaults and env.
    // Intentionally silent to avoid noisy logs during common dev workflows.
  }
}

const config = deepMerge({ ...defaults }, overrides);

module.exports = config;
