import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  windowControls: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  onDeepLink: (callback: (url: string) => void) => {
    ipcRenderer.on('deep-link', (_e, url) => callback(url))
  },
})
