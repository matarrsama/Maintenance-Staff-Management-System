const { app, BrowserWindow, dialog, ipcMain, Notification, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let win;
let tray = null;

// ── Window ──

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'Bansang Hospital - Maintenance Leave System',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.removeMenu();

  var isAutoStart = process.argv.includes('--autostart');

  // Show splash screen immediately while the app loads
  win.loadFile(path.join(__dirname, '..', 'public', 'splash.html'));
  win.once('ready-to-show', () => {
    if (!isAutoStart) win.show();

    // Now load the real app
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    win.once('ready-to-show', () => {
      if (isAutoStart) {
        win.hide();
        if (Notification.isSupported()) {
          const notif = new Notification({
            title: 'Bansang Hospital',
            body: 'App is running in the background. Double-click the tray icon to open.',
            silent: true,
          });
          notif.on('click', () => { win.show(); win.focus(); });
          notif.show();
        }
      } else {
        win.maximize();
        win.show();
      }
    });
  });

  // Open DevTools with F12
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      win.webContents.toggleDevTools();
    }
  });

  // Minimize to tray instead of closing
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  createTray();
  checkForUpdates();
}

// ── System Tray ──

function createTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, '..', 'public', 'icon.ico');
  try {
    tray = new Tray(nativeImage.createFromPath(iconPath));
    tray.setToolTip('Bansang Hospital - Maintenance Leave System');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open', click: () => { win.show(); win.focus(); } },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
    ]));
    tray.on('double-click', () => { win.show(); win.focus(); });
  } catch (e) {
    console.warn('[tray] could not create tray icon', e.message);
  }
}

// ── Native Notifications ──

ipcMain.on('app:notify', (event, { title, body, tag }) => {
  if (!Notification.isSupported()) return;
  const notif = new Notification({ title, body, silent: false });
  notif.on('click', () => { if (win) { win.show(); win.focus(); } });
  notif.show();
});

// ── Auto-start at login ──

function getAutoLaunchSettings() {
  return app.getLoginItemSettings();
}

ipcMain.handle('app:getAutoLaunch', () => {
  return getAutoLaunchSettings().openAtLogin;
});

ipcMain.on('app:setAutoLaunch', (event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: !!enabled, args: enabled ? ['--autostart'] : [] });
  event.sender.send('app:autoLaunchChanged', enabled);
});

// ── Auto-updater ──

function checkForUpdates() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    if (win) win.webContents.send('app:update', { type: 'available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    if (win) {
      win.setProgressBar(progress.percent / 100);
      win.webContents.send('app:update', { type: 'progress', percent: Math.round(progress.percent) });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (win) {
      win.setProgressBar(-1);
      win.webContents.send('app:update', { type: 'downloaded', version: info.version });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err.message);
    if (win) win.webContents.send('app:update', { type: 'error', message: err.message });
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.warn('[updater] check failed', err.message);
  });
}

ipcMain.on('app:installUpdate', () => {
  autoUpdater.quitAndInstall();
});

// ── Single instance lock ──

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  // ── App lifecycle ──

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else { win.show(); win.focus(); }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
    if (tray) {
      tray.destroy();
      tray = null;
    }
  });
}
