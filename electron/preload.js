// Electron Preload Script for OttoStudio
// This script runs before the web page loads and provides a secure bridge
// between the main process and renderer process

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Platform information
  platform: process.platform,

  // App version
  appVersion: process.env.npm_package_version || '1.0.0',

  // Backend URL (for API calls)
  backendUrl: 'http://localhost:3001',

  // Future: Add IPC methods here if needed
  // Example:
  // send: (channel, data) => {
  //   let validChannels = ['toMain'];
  //   if (validChannels.includes(channel)) {
  //     ipcRenderer.send(channel, data);
  //   }
  // },
  // receive: (channel, func) => {
  //   let validChannels = ['fromMain'];
  //   if (validChannels.includes(channel)) {
  //     ipcRenderer.on(channel, (event, ...args) => func(...args));
  //   }
  // }
});

console.log('[Preload] OttoStudio preload script loaded');
