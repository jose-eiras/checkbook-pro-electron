/* Checkbook pro Entry point */

const electron = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const CheckBookAPI = require('./api-server');

app = electron.app;
BrowserWindow = electron.BrowserWindow;

// Load settings from settings.json
function loadSettings() {
    /* Check if development or build  */
    let settingsjson = "";
    if (app.isPackaged) {
      settingsjson = "settings server.json";
      console.log('Running in production mode.');
    } else {
      settingsjson = "settings local.json";
      console.log('Running in development mode.');
    }
    const settingsPath = path.join(__dirname, settingsjson);
    try {
        if (fs.existsSync(settingsPath)) {
            const settingsData = fs.readFileSync(settingsPath, 'utf8');
            return JSON.parse(settingsData);
        }
    } catch (error) {
        console.warn('Warning: Could not load settings.json, using defaults:', error.message);
    }
    // Default settings if file doesn't exist or can't be parsed
    return {
        database: {
            path: path.join(__dirname, 'checkbook-pro.sqlite3'),
            type: "sqlite"
        },
        server: {
            port: 5000,
            host: "localhost"
        }
    };
}

// Keep a global reference of the window object
let mainWindow;
let apiServer;
const settings = loadSettings();
let PORT = settings.server.port;

async function createServer() {
    try {
        console.log('Starting API server...');
        // Create the Node.js API server with database path from settings
        let dbPath = process.env.CHECKBOOK_DB_PATH || settings.database.path;
        
        // Handle Windows UNC paths and relative paths
        if (dbPath.startsWith('//') || dbPath.startsWith('\\\\')) {
            // UNC path - use as-is but convert forward slashes to backslashes on Windows
            if (process.platform === 'win32') {
                dbPath = dbPath.replace(/\//g, '\\');
            }
        } else if (!path.isAbsolute(dbPath)) {
            // Relative path - make it relative to project directory
            dbPath = path.join(__dirname, dbPath);
        }
        
        // Fallback to local database if the configured path doesn't exist
        if (!fs.existsSync(dbPath)) {
            const fallbackPath = path.join(__dirname, 'checkbook-pro.sqlite3');
            console.warn(`Database not found at ${dbPath}, falling back to ${fallbackPath}`);
            dbPath = fallbackPath;
        }
        console.log('Settings loaded from settings.json');
        console.log('Using database path:', dbPath);
        console.log('Server port:', PORT);
        apiServer = new CheckBookAPI(dbPath);
        
        // Add static file serving for the HTML file
        apiServer.app.use(express.static(__dirname));
        apiServer.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'checkbook-pro.html'));
        });
        
        // Add middleware to inject the correct API port into the HTML
        apiServer.app.get('/checkbook-pro.html', (req, res) => {
            const fs = require('fs');
            let html = fs.readFileSync(path.join(__dirname, 'checkbook-pro.html'), 'utf8');
            // Keep API_BASE_URL relative since we're serving from the same server
            res.send(html);
        });

        // Start the server with port conflict handling
        console.log('Calling apiServer.start()...');
        let attempts = 0;
        const maxAttempts = 10;
        
        let currentPort = PORT;
        while (attempts < maxAttempts) {
            try {
                const server = await apiServer.start(currentPort);
                PORT = currentPort; // Update the global PORT variable
                console.log(`✅ CheckBook Pro Node.js API running on http://localhost:${PORT}`);
                console.log('Creating Electron window...');
                createWindow();
                break;
            } catch (error) {
                if (error.code === 'EADDRINUSE' || error.message.includes('EADDRINUSE')) {
                    attempts++;
                    console.log(`Port ${currentPort} in use, trying port ${currentPort + 1}...`);
                    currentPort++;
                } else {
                    throw error;
                }
            }
        }
        
        if (attempts >= maxAttempts) {
            throw new Error('Could not find an available port');
        }
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        console.error('Stack trace:', error.stack);
    }
}

function createWindow() {
    // Skip window creation in web mode
    if (!app || !BrowserWindow) {
        console.log('✅ Web mode - No window needed');
        return;
    }
    
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, 'assets/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            webSecurity: true,
            // Fix Windows cache permissions
            ...(process.platform === 'win32' ? { 
                partition: 'persist:checkbook-pro',
                cache: false 
            } : {})
        },
        titleBarStyle: 'default',
        show: false // Don't show until ready
    });

    // Load the app - ensure we use the actual running port
    console.log(`Loading Electron window from: http://localhost:${PORT}`);
    mainWindow.loadURL(`http://localhost:${PORT}`);

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Focus on window
        if (process.platform === 'darwin') {
            app.dock.show();
        }
        mainWindow.focus();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
}

// App event handlers (only if Electron is available)
if (app) {
    app.whenReady().then(() => {
        createServer();
    });

    app.on('window-all-closed', async () => {
        // Close the API server when all windows are closed
        if (apiServer) {
            await apiServer.stop();
        }
        
        // On macOS, keep the app running even when all windows are closed
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        // On macOS, re-create a window when the dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            if (!apiServer) {
                createServer();
            } else {
                createWindow();
            }
        }
    });

    // Security: Prevent new window creation
    app.on('web-contents-created', (event, contents) => {
        contents.on('new-window', (event, navigationUrl) => {
            event.preventDefault();
        });
    });
} else {
    // Web mode - start server immediately
    console.log('Starting in web mode...');
    createServer();
}
