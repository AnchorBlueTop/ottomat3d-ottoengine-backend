-- backend/db/001_initial_schema.sql
-- Version: v0.1-api-proxy (

PRAGMA foreign_keys = ON;

CREATE TABLE printers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    brand TEXT NULL,
    model TEXT NULL,
    type TEXT NOT NULL,              -- e.g., "FDM" or your internal "bambu", "klipper"
    ip_address TEXT NOT NULL UNIQUE,
    access_code TEXT NULL,
    serial_number TEXT NULL UNIQUE,
    build_volume_json TEXT NULL,     -- <<< ADDED: To store build volume object as JSON string
    current_filament_json TEXT NULL, -- <<< ADDED: To store current filament object as JSON string
    -- status column is NOT added, as status is always fetched live for API responses in v0.1 proxy
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc'))
);

CREATE TABLE ottoejects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_name TEXT NOT NULL UNIQUE,
    ip_address TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc'))
);

-- Triggers for updated_at
CREATE TRIGGER trigger_printers_updated_at AFTER UPDATE ON printers FOR EACH ROW
    BEGIN UPDATE printers SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc') WHERE id = OLD.id; END;
CREATE TRIGGER trigger_ottoejects_updated_at AFTER UPDATE ON ottoejects FOR EACH ROW
    BEGIN UPDATE ottoejects SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc') WHERE id = OLD.id; END;