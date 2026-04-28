const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

// Substituição segura para o electron-is-dev
const isDev = !app.isPackaged;

// Capturar erros no arranque para mostrar janela em vez de fechar silenciosamente
process.on('uncaughtException', (error) => {
    dialog.showErrorBox('Erro Fatal no Arranque', error.stack || error.message);
    process.exit(1);
});

// Importar o servidor backend para iniciar junto com a aplicação
// O server.js não pode bloquerar o thread principal do Electron (tem de rodar em segundo plano)
try {
    require('./backend/server');
} catch (err) {
    dialog.showErrorBox('Erro ao Iniciar Backend', `Falha ao carregar o servidor:\n${err.message}\n\nStack:\n${err.stack}`);
    process.exit(1);
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1366,
        height: 768,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },

        // Ícone da aplicação
        icon: path.join(__dirname, 'frontend/build/favicon.ico'),
    });

    //Carregar a aplicação 
    //Em desenvolvimento carrega do localhost:3000
    //Em produção carrega o index.html compilado
    mainWindow.loadURL(
        isDev
            ? 'http://localhost:3000' : `file://${path.join(__dirname, './frontend/build/index.html')}`
    );

    // Abrir as DevTools em modo desenvolvimento
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    return mainWindow;
}

// Quando o electron estiver pronto, cria a janela
app.whenReady().then(() => {
    const win = createWindow();

    if (!isDev) {
        autoUpdater.checkForUpdates();

        autoUpdater.on('update-downloaded', () => {
            dialog.showMessageBox(win, {
                type: 'info',
                title: 'Atualização disponível',
                message: 'Uma nova versão do MaqManager foi instalada e está pronta.\nA aplicação vai reiniciar para aplicar a atualização.',
                buttons: ['Reiniciar agora', 'Mais tarde']
            }).then((result) => {
                if (result.response === 0) {
                    autoUpdater.quitAndInstall();
                }
            });
        });
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Forçar o encerramento do processo (mata o servidor backend fantasma)
app.on('quit', () => {
    process.exit(0);
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});