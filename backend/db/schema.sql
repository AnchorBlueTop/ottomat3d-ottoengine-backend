-- Ottomat3D Backend: Database Schema (print-jobs-apis)

PRAGMA foreign_keys = ON;

-- =============================================================================
-- SECTION 1: v0.1 Core Device Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS printers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    brand TEXT NULL,
    model TEXT NULL,
    type TEXT NOT NULL,              -- e.g., "bambu", "klipper", "prusa", "flashforge"
    ip_address TEXT NOT NULL UNIQUE,
    access_code TEXT NULL,
    serial_number TEXT NULL UNIQUE,
    build_volume_json TEXT NULL,     -- Stores build volume object as JSON string
    current_filament_json TEXT NULL, -- Stores default/fallback filament object as JSON string
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc'))
);

CREATE TABLE IF NOT EXISTS ottoejects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_name TEXT NOT NULL UNIQUE,
    ip_address TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc'))
);


-- =============================================================================
-- SECTION 2: v0.2 Print Job & Storage Rack Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS print_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- JSON object storing details about the file itself
    -- e.g., { "name": "...", "location": "...", "size_bytes": ..., "format": "..." }
    file_details_json TEXT NOT NULL,
    -- JSON object storing parsed duration estimates
    -- e.g., { "printing_seconds": 3600, "ejecting_seconds": 120 }
    duration_details_json TEXT NULL,
    -- JSON object storing parsed object measurements
    -- e.g., { "width_mm": 100, "depth_mm": 100, "height_mm": 50, "weight_grams": 25.5 }
    measurement_details_json TEXT NULL,
    -- JSON object storing parsed filament requirements
    -- e.g., { "type": "PLA", "required_weight_grams": 25.5, "color": "Blue" }
    filament_details_json TEXT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc'))
);

CREATE TABLE IF NOT EXISTS storage_racks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    shelf_count INTEGER NOT NULL,
    shelf_spacing_mm INTEGER NULL,
    -- Stores the compatible bed size, e.g., "256x256"
    bed_size TEXT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc'))
);

CREATE TABLE IF NOT EXISTS print_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL, -- e.g., 'QUEUED', 'PRINTING', 'FAILED', 'COMPLETED'
    status_message TEXT NULL, -- e.g., 'Waiting for filament', 'Error: Nozzle clog detected'
    progress_percent REAL DEFAULT 0.0,
    priority INTEGER DEFAULT 1, -- Lower number = higher priority
    auto_start INTEGER NOT NULL DEFAULT 0, -- Boolean (0/1)
    
    -- Foreign Keys to link the job to its components
    print_item_id INTEGER NOT NULL,
    printer_id INTEGER NULL,
    ottoeject_id INTEGER NULL,

    -- Timestamps for tracking the job's lifecycle
    submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    started_at TEXT NULL,
    finished_printing_at TEXT NULL,
    stored_at TEXT NULL,
    completed_at TEXT NULL,
    
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),

    FOREIGN KEY (print_item_id) REFERENCES print_items(id) ON DELETE RESTRICT,
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE SET NULL,
    FOREIGN KEY (ottoeject_id) REFERENCES ottoejects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS rack_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storage_rack_id INTEGER NOT NULL,
    slot_number INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'print_bed', -- e.g., 'print_bed', 'item_shelf'
    occupied INTEGER NOT NULL DEFAULT 0, -- Boolean (0/1)
    
    -- Link to the print job currently occupying this slot
    print_job_id INTEGER NULL,
    
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-m-%d %H:%M:%f', 'now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    
    -- If a rack is deleted, its slots are deleted too.
    FOREIGN KEY (storage_rack_id) REFERENCES storage_racks(id) ON DELETE CASCADE,
    -- If a print job is deleted, the slot becomes vacant but is not deleted itself.
    FOREIGN KEY (print_job_id) REFERENCES print_jobs(id) ON DELETE SET NULL,
    
    -- Ensure each slot number is unique within a single rack.
    UNIQUE (storage_rack_id, slot_number)
);


-- =============================================================================
-- SECTION 3: Triggers for 'updated_at' columns
-- =============================================================================

CREATE TRIGGER IF NOT EXISTS trigger_printers_updated_at AFTER UPDATE ON printers FOR EACH ROW
    BEGIN UPDATE printers SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc') WHERE id = OLD.id; END;

CREATE TRIGGER IF NOT EXISTS trigger_ottoejects_updated_at AFTER UPDATE ON ottoejects FOR EACH ROW
    BEGIN UPDATE ottoejects SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc') WHERE id = OLD.id; END;

CREATE TRIGGER IF NOT EXISTS trigger_print_items_updated_at AFTER UPDATE ON print_items FOR EACH ROW
    BEGIN UPDATE print_items SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc') WHERE id = OLD.id; END;

CREATE TRIGGER IF NOT EXISTS trigger_storage_racks_updated_at AFTER UPDATE ON storage_racks FOR EACH ROW
    BEGIN UPDATE storage_racks SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc') WHERE id = OLD.id; END;

CREATE TRIGGER IF NOT EXISTS trigger_print_jobs_updated_at AFTER UPDATE ON print_jobs FOR EACH ROW
    BEGIN UPDATE print_jobs SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc') WHERE id = OLD.id; END;

CREATE TRIGGER IF NOT EXISTS trigger_rack_slots_updated_at AFTER UPDATE ON rack_slots FOR EACH ROW
    BEGIN UPDATE rack_slots SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc') WHERE id = OLD.id; END;