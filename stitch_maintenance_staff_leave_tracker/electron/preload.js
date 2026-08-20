const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  platform: process.platform,

  // Native OS notifications
  notify: (title, body, tag) => {
    ipcRenderer.send('app:notify', { title, body, tag });
  },

  // Auto-start at login
  getAutoLaunch: () => ipcRenderer.invoke('app:getAutoLaunch'),
  setAutoLaunch: (enabled) => ipcRenderer.send('app:setAutoLaunch', enabled),

  // Minimize to tray instead of close
  minimizeToTray: () => ipcRenderer.send('app:minimizeToTray'),

  // Auto-update
  onUpdateEvent: (callback) => ipcRenderer.on('app:update', (_event, data) => callback(data)),
  installUpdate: () => ipcRenderer.send('app:installUpdate'),
});
