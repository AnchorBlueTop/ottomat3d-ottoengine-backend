# OTTOMAT3D Backend

A Node.js backend system for autonomous 3D printing operations, enabling 24/7 unattended manufacturing through coordinated printer control, intelligent storage management, and automated workflow orchestration.

## Overview

OTTOMAT3D addresses the operational challenges of continuous 3D printing by automating the complete print-to-storage workflow. The system manages multiple printers, ejection devices, and storage racks, coordinating hardware through a comprehensive REST API and real-time monitoring system.

### Key Capabilities

- **Autonomous Operation**: Complete print job lifecycle from file upload to finished part storage without human intervention
- **Multi-Brand Integration**: Extensible adapter pattern supporting different 3D printer manufacturers through standardized interfaces
- **Intelligent Storage**: Height-aware slot assignment algorithm optimizing storage density while preserving space for tall prints
- **Real-Time Orchestration**: Sub-second conflict detection and automatic job reassignment during manual interventions
- **Concurrent Processing**: Simultaneous management of multiple printers with independent progress tracking

## Technical Challenges & Solutions

### Challenge 1: Platform Selection

**Problem**: Initial Python + Flask approach lacked the multithreading capabilities required for managing multiple concurrent printer connections and real-time monitoring.

**Solution**: Migrated to Node.js + Express, leveraging JavaScript's event loop and non-blocking I/O. This required building a custom Bambu Labs API package since existing Python packages (`bambulabs-api`, `bambu-connect`) weren't compatible with Node.js.

**Implementation**: Developed a complete MQTT + FTP client for Bambu Labs printers by studying the Python implementations and reverse-engineering the protocol communication patterns.

### Challenge 2: MQTT Connection Stability

**Problem**: Printer connections dropped during long print jobs (60+ minutes), causing loss of status updates and breaking the monitoring system.

**Solution**: Implemented robust reconnection logic with exponential backoff, connection health monitoring, and automatic recovery. Enhanced the MQTT client with connection state tracking and graceful reconnection that preserves ongoing operations.

**Results**: Achieved stable connections over 12+ hour print runs with automatic recovery from network interruptions.

### Challenge 3: Storage Optimization

**Problem**: Simple bottom-up storage wasted vertical space and blocked slots needed for taller prints.

**Solution**: Developed a height-aware slot assignment algorithm with multi-factor scoring:
- Height efficiency (40%): How well print height matches available clearance
- Slot position (30%): Bottom-up preference with height category consideration
- Clearance waste (20%): Penalty for inefficient space utilization
- Future flexibility (10%): Impact on queued jobs

**Validation**: Created a Node.js simulator to test the algorithm against various rack configurations and job mixes, achieving 30-40% better space utilization compared to naive approaches.

### Challenge 4: Architectural Evolution

**Initial Approach**: Python scripts acting as orchestrators, using the backend APIs as proxies for device communication.

**Evolution**:
1. **Phase 1**: Standalone Python scripts with hardcoded workflows
2. **Phase 2**: Python orchestrator calling backend REST APIs (see `__python_scripts/dual_printer_orchestrator.py`)
3. **Phase 3**: Complete Node.js backend with integrated orchestration service

**Python Orchestrator Learnings**:
- Implemented multithreading with `ThreadPoolExecutor` for concurrent printer monitoring
- Developed coordination primitives (ejection lock) for resource arbitration
- Validated workflow logic before porting to Node.js

This incremental approach de-risked the migration and provided a working reference implementation during backend development.

## System Architecture

```
┌─────────────────────────────────────────┐
│             REST API Layer              │
│    (Express + Route Controllers)        │
└───────────────────┬─────────────────────┘
                    │
┌───────────────────▼─────────────────────┐
│              Service Layer              │
│  ┌──────────────┐  ┌────────────────┐   │
│  │ Orchestrator │  │ Printer Adapter│   │
│  │   Service    │  │  State Manager │   │
│  └──────────────┘  └────────────────┘   │
│  ┌──────────────┐  ┌────────────────┐   │
│  │ Slot Manager │  │ Event Emitter  │   │
│  │  Algorithm   │  │ + Resolver     │   │
│  └──────────────┘  └────────────────┘   │
└───────────────────┬─────────────────────┘
                    │
┌───────────────────▼─────────────────────┐
│            Integration Layer            │
│  ┌──────────────┐  ┌────────────────┐   │
│  │  Bambu Labs  │  │    Klipper     │   │
│  │ (MQTT + FTP) │  │  (Moonraker)   │   │
│  └──────────────┘  └────────────────┘   │
└───────────────────┬─────────────────────┘
                    │
┌───────────────────▼─────────────────────┐
│             SQLite Database             │
│      (Jobs, Printers, Racks, State)     │
└─────────────────────────────────────────┘
```

## Development Process

This project was developed in a collaborative environment using GitLab for version control and workflow management. The experience provided hands-on practice with professional development practices:

### GitLab Workflow

- **Branch Strategy**: Feature branches for all development work, with `develop` as integration test branch
- **Merge Requests**: All code changes went through MR process with detailed descriptions and technical context
- **Code Reviews**: Regular review cycles with team members, focusing on architecture decisions and implementation quality
- **Conflict Resolution**: Managed merge conflicts across multiple concurrent feature branches
- **Branch Management**: Created focused feature branches for specific capabilities (adapter integration, slot management, orchestration engine, event system, API integration)

### Engineering Practices

- **Incremental Development**: Built system in logical phases, validating each layer before proceeding
- **Documentation**: Maintained comprehensive technical documentation throughout development
- **Testing**: Created Postman collection for API validation and simulator for algorithm testing
- **Refactoring**: Iteratively improved architecture based on code review feedback

The GitLab experience reinforced the importance of clear communication in MRs, proper branch hygiene, and the value of collaborative code review in catching architectural issues early.

## API Design

The backend exposes a RESTful API organized into logical resource groups:

### Core Endpoints

**Printers** (`/api/printers`)
- CRUD operations for printer management
- Live status monitoring with adapter integration
- Command execution (start, pause, resume, stop)
- File upload and G-code sending

**Print Jobs** (`/api/print-jobs`)
- Two-step workflow: file upload/parse, then job creation
- Lifecycle management (queued, printing, completed)
- Progress tracking and status updates

**OttoEject Devices** (`/api/ottoeject`)
- Device registration and management
- Macro execution for automation sequences
- Live status monitoring

**Storage Racks** (`/api/ottoracks`)
- Rack creation with configurable shelves
- Shelf state management
- Event emission for conflict detection

**Orchestration** (`/api/orchestration`)
- Real-time system status
- Active job monitoring
- Health checks and service management

Complete API documentation available in `backend/OttoEngine API Documentation.md`.

## Technology Stack

**Backend Runtime**
- Node.js 18+ with Express framework
- SQLite for embedded database
- Native MQTT client for printer communication

**Printer Integration**
- Custom Bambu Labs MQTT + FTP package
- Klipper/Moonraker HTTP API client
- Adapter pattern for multi-brand support

**Development Tools**
- Postman for API testing
- GitLab for version control and collaboration
- VS Code for development

## Repository Structure

This repository contains:

**`backend/`** - Main Node.js backend (primary focus)
- Complete Express application with service layer
- Custom Bambu Labs integration package
- REST API implementation
- Orchestration and automation services

**`__python_scripts/`** - Historical Python implementations
- `dual_printer_orchestrator.py` - Intermediate orchestration solution
- Demonstrates evolution from scripts to integrated backend
- Reference implementation for workflow validation

**`frontend/`** - React frontend (future work)
- Web interface for system monitoring and control
- Currently under development

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- 3D printer with network connectivity (Bambu Labs or Klipper-based)
- OttoEject device (optional, for automated ejection)

### Installation

```bash
cd backend
npm install
```

### Configuration

1. Copy `.env.example` to `.env` (if available) or create `.env` with:
   ```
   NODE_ENV=development
   SQLITE_DB_PATH=./db/ottomat3d.db
   PORT=3000
   ```

2. Update printer configuration with your device details (see API documentation for registration endpoints)

### Running the Backend

```bash
npm start
```

The API will be available at `http://localhost:3000/api`

### Testing

Import the Postman collection from `backend/_testing/postman/` for comprehensive API testing.

## Future Work

- Additional printer brand adapters (Prusa, Ultimaker, Creality)
- Enhanced web frontend with real-time updates
- Advanced scheduling and queue management
- Predictive maintenance tracking
- Integration with MES/ERP systems

## Technical Skills Demonstrated

- Backend API development with Node.js and Express
- Real-time system integration and event-driven architecture
- Custom protocol implementation (MQTT, FTP)
- Algorithm design and optimization
- Database schema design and transaction management
- Service-oriented architecture and design patterns
- Hardware integration and device control
- Version control workflow and collaboration
- Code review and technical documentation

## License

MIT License - See LICENSE file for details

---

**Note**: This repository is a portfolio showcase. Sensitive information (IP addresses, access codes, serial numbers) has been sanitized for public sharing.
