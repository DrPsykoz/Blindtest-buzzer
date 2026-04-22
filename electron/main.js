const path = require('path');
const { app, BrowserWindow, shell } = require('electron');

let mainWindow = null;
let playersWindow = null;

function createPlayersWindow() {
    if (playersWindow && !playersWindow.isDestroyed()) {
        playersWindow.focus();
        return playersWindow;
    }

    playersWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'Blindtest Buzzer - Ecran joueurs',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    playersWindow.loadFile(path.join(__dirname, '..', 'players.html'));
    playersWindow.on('closed', () => {
        playersWindow = null;
    });

    return playersWindow;
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1500,
        height: 950,
        title: 'Blindtest Buzzer',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.endsWith('/players.html') || url.endsWith('players.html')) {
            createPlayersWindow();
            return { action: 'deny' };
        }

        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.whenReady().then(() => {
    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
