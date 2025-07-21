const { app, BrowserWindow } = require('electron');
const path = require('path');
const { exec } = require('child_process');

async function createWindow() {
    const isDev = await import('electron-is-dev').then(module => module.default);

    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    const startUrl = isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../build/index.html')}`;
    mainWindow.loadURL(startUrl);
}

app.on('ready', () => {
    // Iniciar o servidor backend
    exec('node ../backend/server.js', { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
        if (err) {
            console.error(`Erro ao iniciar o servidor backend: ${err}`);
            return;
        }
        console.log(`Servidor backend iniciado: ${stdout}`);
    });

    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});