// Electron Main Process for OttoStudio
// Handles window creation, backend server startup, and app lifecycle

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;
let backendProcess;
const isDev = process.argv.includes('--dev');

// Backend server configuration
const BACKEND_PORT = 3001;
const FRONTEND_PORT = 5173; // Vite dev server port
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = isDev
  ? `http://localhost:${FRONTEND_PORT}`
  : `file://${path.join(__dirname, '../frontend/dist/index.html')}`;

/**
 * Start the Express backend server
 */
function startBackendServer() {
  return new Promise((resolve, reject) => {
    console.log('[Electron] Starting backend server...');

    const backendPath = isDev
      ? path.join(__dirname, '../backend')
      : path.join(__dirname, '../backend');

    // Check if backend exists
    if (!fs.existsSync(backendPath)) {
      console.error('[Electron] Backend directory not found:', backendPath);
      reject(new Error('Backend not found'));
      return;
    }

    const serverFile = path.join(backendPath, 'src', 'app.js');

    if (!fs.existsSync(serverFile)) {
      console.error('[Electron] Backend app.js not found:', serverFile);
      reject(new Error('Backend app.js not found'));
      return;
    }

    // Find node executable (Finder doesn't include /usr/local/bin in PATH)
    const { execSync } = require('child_process');
    let nodePath = 'node';
    try {
      // Try to find node in common locations
      nodePath = execSync('which node', { encoding: 'utf8' }).trim();
    } catch (e) {
      // If which fails, try common paths
      const commonPaths = [
        '/usr/local/bin/node',
        '/opt/homebrew/bin/node',
        '/usr/bin/node'
      ];
      for (const path of commonPaths) {
        if (fs.existsSync(path)) {
          nodePath = path;
          break;
        }
      }
    }

    console.log('[Electron] Using Node.js at:', nodePath);

    // Set up Application Support directory for user data
    const userDataPath = app.getPath('userData'); // ~/Library/Application Support/Ottostudio
    const dbDir = path.join(userDataPath, 'db');

    // Ensure database directory exists
    if (!fs.existsSync(dbDir)) {
      console.log('[Electron] Creating database directory:', dbDir);
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = path.join(dbDir, 'ottomat3d.db');
    console.log('[Electron] Database will be stored at:', dbPath);

    // Start backend as child process
    backendProcess = spawn(nodePath, [serverFile], {
      cwd: backendPath,
      stdio: 'inherit',
      env: {
        ...process.env,
        PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin',
        PORT: BACKEND_PORT,
        NODE_ENV: isDev ? 'development' : 'production',
        ELECTRON_MODE: 'true',
        // Database configuration - store in Application Support
        SQLITE_DB_PATH: dbPath,
        DB_PERSIST_DATA: 'false'
      }
    });

    backendProcess.on('error', (error) => {
      console.error('[Electron] Failed to start backend:', error);
      reject(error);
    });

    backendProcess.on('exit', (code) => {
      console.log(`[Electron] Backend process exited with code ${code}`);
      if (code !== 0 && code !== null) {
        console.error('[Electron] Backend crashed!');
      }
    });

    // Wait for backend to be ready
    setTimeout(() => {
      console.log('[Electron] Backend server should be ready');
      resolve();
    }, 3000);
  });
}

/**
 * Create the main application window
 */
function createWindow() {
  console.log('[Electron] Creating main window...');
  console.log('[Electron] Loading URL:', FRONTEND_URL);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#1a1a1a',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    show: false, // Don't show until ready
    title: 'OttoStudio - 3D Print Farm Management'
  });

  // Load the frontend
  if (isDev) {
    mainWindow.loadURL(FRONTEND_URL);
    mainWindow.webContents.openDevTools(); // Open DevTools in dev mode
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    console.log('[Electron] Window ready to show');
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}

/**
 * Create application menu
 */
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About OttoStudio',
          click: () => {
            // Could open an about dialog
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Stop the backend server
 */
function stopBackendServer() {
  if (backendProcess) {
    console.log('[Electron] Stopping backend server...');
    backendProcess.kill();
    backendProcess = null;
  }
}

/**
 * App lifecycle: When Electron is ready
 */
app.whenReady().then(async () => {
  console.log('[Electron] App ready, starting backend...');
  console.log('[Electron] Mode:', isDev ? 'DEVELOPMENT' : 'PRODUCTION');

  try {
    // Start backend server
    await startBackendServer();

    // Create window
    createWindow();

    // macOS: Re-create window when dock icon clicked
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

  } catch (error) {
    console.error('[Electron] Failed to start app:', error);
    app.quit();
  }
});

/**
 * App lifecycle: All windows closed
 */
app.on('window-all-closed', () => {
  // On macOS, apps typically stay open until Cmd+Q
  if (process.platform !== 'darwin') {
    stopBackendServer();
    app.quit();
  }
});

/**
 * App lifecycle: Before quit
 */
app.on('before-quit', () => {
  console.log('[Electron] App quitting...');
  stopBackendServer();
});

/**
 * Handle uncaught errors
 */
process.on('uncaughtException', (error) => {
  console.error('[Electron] Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[Electron] Unhandled rejection:', error);
});
