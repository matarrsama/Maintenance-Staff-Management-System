// Preload script. Exposes a small, safe API to the renderer.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  platform: process.platform,
});
