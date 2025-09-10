# Database Initialization and Persistence

## Overview

The application now automatically initializes the SQLite database with the required schema when the server starts. This ensures a clean, working database environment every time you run the application.

## Configuration

The database behavior is controlled by environment variables in the `.env` file:

```properties
# Database Configuration
SQLITE_DB_PATH=./db/ottomat3d.db
DB_PERSIST_DATA=false
```

### Environment Variables

- **SQLITE_DB_PATH**: Path to the SQLite database file (relative to the backend directory)
- **DB_PERSIST_DATA**: Controls whether database data persists between server restarts
  - `false` (default): Database is recreated fresh on each startup
  - `true`: Database data is preserved between server restarts

## Database Initialization Process

When the server starts:

1. **Directory Creation**: Ensures the `backend/db/` directory exists
2. **Persistence Check**: If `DB_PERSIST_DATA=false`, removes any existing database file
3. **Database Connection**: Creates/opens the SQLite database file
4. **Schema Initialization**: Executes the `backend/db/schema.sql` file to create all tables and triggers
5. **Foreign Key Enforcement**: Enables SQLite foreign key constraints

## Usage

### Development Mode (Fresh Database Each Time)
```bash
# .env file
DB_PERSIST_DATA=false

# Start the server
npm run start:dev
```
This is ideal for development as it ensures a clean state every time.

### Production Mode (Persistent Database)
```bash
# .env file  
DB_PERSIST_DATA=true

# Start the server
npm run start:dev
```
This preserves data between server restarts.

## Git Tracking

The database file (`backend/db/ottomat3d.db`) is automatically excluded from Git tracking via `.gitignore`. This means:

- ✅ Schema changes are tracked (via `schema.sql`)
- ✅ Code changes are tracked
- ❌ Database data is NOT tracked
- ❌ Local database files are NOT committed

## Logs

The application logs the database initialization process:

```
[INFO] Database persistence mode: DISABLED
[INFO] DB_PERSIST_DATA is false, removing existing database file for fresh start...
[INFO] Successfully connected to the SQLite database.
[INFO] Foreign key enforcement enabled for SQLite connection.
[INFO] Database schema initialized successfully.
```

## Troubleshooting

### Schema Errors
If you see schema initialization errors, ensure:
- The `backend/db/schema.sql` file exists and is valid SQL
- You have write permissions to the `backend/db/` directory

### Permission Errors
If you get database file permission errors:
- Check write permissions on the `backend/db/` directory
- On Unix systems: `chmod 755 backend/db/`

### Fresh Start
To force a completely fresh database:
1. Stop the server
2. Set `DB_PERSIST_DATA=false` in `.env`
3. Delete `backend/db/ottomat3d.db` manually (optional)
4. Restart the server
