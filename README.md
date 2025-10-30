# OTTOengine (Ottomat3D)

OTTOengine is the core software powering the Ottomat3D automation ecosystem. It orchestrates multi-printer management, print job workflows, and automation with the OTTOeject hardware, providing APIs and a web UI for print farms.

## Highlights

- OTTOeject management
- Printer management across brands (Bambu, Klipper/Moonraker, etc.)
- Job queueing with persistent state, events, and lifecycle timestamps
- OTTOeject integration for automated plate ejection and storage workflows
- Real-time monitoring and status polling 
- Modular adapter layer design to support more printers (Bambu Connect, Creality, …)

---

## Architecture at a glance

- Backend (Node.js/Express):
	- REST APIs at `/api/*`
	- Services: printer management, OTTOeject proxy (Moonraker), print jobs, parsing
	- SQLite database (auto-initialized) with tables for printers, ottoejects, print_items, print_jobs, racks, job_events, ejection_sessions
- Frontend (React + Vite):
	- UI for managing printers, jobs, and automation (in `frontend/`)
- Integrations:
	- Bambu Local via MQTT (present)
	- OTTOeject via Moonraker HTTP; WS planned for live ejection updates

Repository layout
- `backend/` — Node.js API server and database schema
- `frontend/` — React UI (Vite)
- `frontend-java/` — Legacy Java/Maven module (moved out of frontend to avoid path conflicts)
- `__beta_testing/` — Packaged Python app used during early beta (legacy)
- `__python_scripts/` — Internal Python scripts used for testing (legacy)
- `DATABASE_SETUP.md` — DB notes and troubleshooting

---

## Features

- Printer & Device Management
	- Register printers (brand/model/type/connection) and OTTOeject devices
	- Store access details, IPs, and live presence
	- Adapter-friendly design for multiple brands

- Print Job Management
	- Upload and parse print files (G-code or 3MF with embedded plate JSON)
	- Create/queue/cancel/complete jobs; set priority and auto-start
	- Persisted job lifecycle with timestamps
	- Job event log (append-only) for observability and audit

- Ejection & Storage Automation
	- Proxy to OTTOeject via Moonraker HTTP
	- Ejection sessions persisted (STARTED → COMPLETED/FAILED)
	- Planned WS bridge for live ejection progress

- Monitoring & Notifications
	- Polling for regular status
	- WebSocket broadcasting during ejection (planned)

---

## Development quick start

Prerequisites
- Node.js 18+ (LTS recommended) and npm
- Optional: `sqlite3` CLI for manual DB resets

### 1) Backend API

Set environment (create `backend/.env` if missing):

```
PORT=3000
SQLITE_DB_PATH=db/ottomat3d.db
DB_PERSIST_DATA=true
```

Install and run:

```bash
cd backend
npm install
npm start
```

The server starts on `http://localhost:3000`. API root: `http://localhost:3000/api`.

Database
- SQLite file is stored at `backend/db/ottomat3d.db` by default.
- Schema is applied automatically on startup from `backend/db/schema.sql`.
- Reset (optional):
	- Stop the server, then either delete the DB file or run the CLI:
		```bash
		sqlite3 backend/db/ottomat3d.db < backend/db/schema.sql
		```
	- You can also set `DB_PERSIST_DATA=false` for a fresh DB on next start.

### 2) Frontend UI (React/Vite)

```bash
cd frontend
npm install
npm run dev
```

Vite dev server runs locally (default `http://localhost:5173`).

---

## API surface (high-level)

Mounted under `/api`:
- `/printers` — Register/list/update printers
- `/ottoeject` — Register/list/update OTTOeject devices and access status
- `/print-jobs` — Upload, create, list, get, update priority, cancel, complete
- `/ottoracks` — Storage racks and slots (basic utils)

Some notable endpoints
- `POST /api/print-jobs/upload` — Upload a file (field: `file`) and parse metadata
- `POST /api/print-jobs` — Create a job with `print_item_id` (+ optional `printer_id`, `ottoeject_id`, `auto_start`, `priority`)
- `GET /api/print-jobs/:id` — Fetch a job (includes enriched duration snapshot)

Persistence details
- Jobs are stored in `print_jobs` with lifecycle timestamps
- `job_events` provides append-only event history per job
- `ejection_sessions` records the ejection lifecycle

---

## Typical workflow

1) Upload a file
- `POST /api/print-jobs/upload` to parse and create a `print_item`

2) Create a job
- `POST /api/print-jobs` with the `print_item_id` (and optional device IDs)

3) Start/monitor
- Orchestration is moving server-side; job events and status are persisted
- During ejection, the backend will bridge live updates (WS planned)

4) Completion & storage
- On completion, the job is marked `COMPLETED`, and an ejection session may be recorded

---

## Technical notes

- Backend
	- Express 5, `axios`, `multer` for file uploads, `sqlite3` for persistence
	- Moonraker proxy lives in `backend/src/services/moonrakerService.js`
	- Print job flow and events live in `backend/src/services/printJobService.js` and `jobEventService.js`

- Database
	- SQLite with schema at `backend/db/schema.sql`
	- Tables: `printers`, `ottoejects`, `print_items`, `print_jobs`, `storage_racks`, `rack_slots`, `job_events`, `ejection_sessions`

- Frontend
	- React + Vite in `frontend/`

- Legacy assets
	- `__beta_testing/` contains a packaged Python app used during beta
	- `__python_scripts/` contains internal Python scripts for earlier testing

---

## Support & contributions

Issues and PRs are welcome. Please avoid sharing sensitive network details (IPs, tokens) in logs or screenshots.
