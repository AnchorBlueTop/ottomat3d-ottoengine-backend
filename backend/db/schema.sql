-- Ottomat3D Backend: Database Schema (print-jobs-apis)
-- UPDATED: Default rack slots are completely empty (no plates) when created

PRAGMA foreign_keys = ON;

-- =============================================================================
-- SECTION 1: v0.1 Core Device Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS printers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    brand TEXT NULL,
    model TEXT NULL,
    type TEXT NULL,              -- e.g., "bambu", "klipper", "prusa", "flashforge"
    ip_address TEXT NOT NULL UNIQUE,
    access_code TEXT NULL,
    serial_number TEXT NULL UNIQUE,
    build_volume_json TEXT NULL,     -- Stores build volume object as JSON string
    current_filament_json TEXT NULL, -- Stores default/fallback filament object as JSON string
    has_build_plate INTEGER NOT NULL DEFAULT 1, -- Track if printer currently has a build plate
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
    -- Max Z height for slot assignment (extracted from measurement_details_json)
    max_z_height_mm DECIMAL(10,2) NULL,
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
    ottoeject_id INTEGER NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    FOREIGN KEY (ottoeject_id) REFERENCES ottoejects(id) ON DELETE SET NULL
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

    -- === NEW: Orchestration fields for slot assignment ===
    assigned_rack_id INTEGER NULL,
    assigned_store_slot INTEGER NULL,
    assigned_grab_slot INTEGER NULL,
    slot_assignment_reason TEXT NULL,
    effective_clearance_mm DECIMAL(10,2) NULL,
    orchestration_status TEXT DEFAULT 'waiting', -- 'waiting', 'printing', 'ejecting', 'storing', 'completed', 'paused'

    -- === Printer-specific settings ===
    use_ams INTEGER NOT NULL DEFAULT 0, -- Boolean (0/1) - Bambu Lab AMS support
    use_material_station INTEGER NOT NULL DEFAULT 0, -- Boolean (0/1) - FlashForge Material Station support

    -- Timestamps for tracking the job's lifecycle
    submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    queued_at TEXT NULL,
    started_at TEXT NULL,
    finished_printing_at TEXT NULL,
    stored_at TEXT NULL,
    completed_at TEXT NULL,

    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),

    FOREIGN KEY (print_item_id) REFERENCES print_items(id) ON DELETE RESTRICT,
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE SET NULL,
    FOREIGN KEY (ottoeject_id) REFERENCES ottoejects(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_rack_id) REFERENCES storage_racks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS rack_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storage_rack_id INTEGER NOT NULL,
    slot_number INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'print_bed', -- e.g., 'print_bed', 'item_shelf'

    -- Enhanced plate tracking columns
    -- DEFAULT: All new slots are completely empty (no plates)
    occupied INTEGER NOT NULL DEFAULT 0, -- Boolean (0/1) - for backwards compatibility
    has_plate INTEGER NOT NULL DEFAULT 0, -- Boolean (0/1) - whether slot contains a plate
    plate_state TEXT DEFAULT NULL CHECK (plate_state IN ('empty', 'with_print') OR plate_state IS NULL),

    -- Link to the print job currently occupying this slot
    print_job_id INTEGER NULL,
    
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    
    -- If a rack is deleted, its slots are deleted too.
    FOREIGN KEY (storage_rack_id) REFERENCES storage_racks(id) ON DELETE CASCADE,
    -- If a print job is deleted, the slot becomes vacant but is not deleted itself.
    FOREIGN KEY (print_job_id) REFERENCES print_jobs(id) ON DELETE SET NULL,
    
    -- Ensure each slot number is unique within a single rack.
    UNIQUE (storage_rack_id, slot_number)
);

-- =============================================================================
-- SECTION 3: Observability Tables (Job Events & Ejection Sessions)
-- =============================================================================

-- Job events table for tracking all job state transitions
CREATE TABLE IF NOT EXISTS job_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- e.g., 'status_changed', 'error', 'retry', 'assigned'
    payload_json TEXT NULL, -- Store additional event data as JSON
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    FOREIGN KEY (job_id) REFERENCES print_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_job_events_job_id_created_at
    ON job_events (job_id, created_at);

-- Ejection sessions table for tracking ottoeject operations
CREATE TABLE IF NOT EXISTS ejection_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NULL,
    printer_id INTEGER NULL,
    ottoeject_id INTEGER NULL,
    status TEXT NOT NULL DEFAULT 'STARTED', -- 'STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    error_message TEXT NULL,
    started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    ended_at TEXT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc')),
    FOREIGN KEY (job_id) REFERENCES print_jobs(id) ON DELETE SET NULL,
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE SET NULL,
    FOREIGN KEY (ottoeject_id) REFERENCES ottoejects(id) ON DELETE SET NULL
);

-- =============================================================================
-- SECTION 4: Triggers for 'updated_at' columns
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

CREATE TRIGGER IF NOT EXISTS trigger_ejection_sessions_updated_at AFTER UPDATE ON ejection_sessions FOR EACH ROW
    BEGIN UPDATE ejection_sessions SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc') WHERE id = OLD.id; END;

-- =============================================================================
-- SECTION 5: Data Initialization and Fixes
-- =============================================================================

-- Fix existing rack slots to have proper default state (completely empty)
-- This ensures slot assignment works correctly for new print jobs
UPDATE rack_slots SET
    occupied = 0,
    has_plate = 0,
    plate_state = NULL,
    print_job_id = NULL
WHERE has_plate IS NULL OR (has_plate = 1 AND plate_state IS NULL);

-- For testing: Initialize a few slots with empty plates if needed
-- Uncomment these lines if you want some slots to have plates ready for printing:
-- UPDATE rack_slots SET has_plate = 1, plate_state = 'empty' 
-- WHERE storage_rack_id = 1 AND slot_number IN (1, 2);
-- BEGIN UPDATE rack_slots SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', 'utc') WHERE id = OLD.id; END;
