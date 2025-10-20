# Backend Config

Central place for runtime configuration with sensible defaults.

How it works:
- `index.js` exports a single config object used across the backend.
- Defaults are provided in code so you don't need to set env vars for local dev.
- You can override values in two ways:
  1) Environment variables
  2) An optional `local.js` file placed next to `index.js` that exports a partial config object.

Environment variables:
- LOG_LEVEL (default: INFO)
- BAMBU_API_DEBUG (default: false)
- PRINTER_CONNECT_TIMEOUT_MS (default: 20000)
- BAMBU_PUSHALL_TIMEOUT_MS (default: 20000)
- DEFAULT_REQUEST_TIMEOUT_MS (default: 15000)

Example local override (do not commit this file):

```js
// backend/src/config/local.js
module.exports = {
  logLevel: 'DEBUG',
  bambuApiDebug: true,
  timeouts: {
    printerConnectMs: 25000,
    pushAllMs: 25000,
  },
};
```

Consumers should import once:
```js
const config = require('../config');
```