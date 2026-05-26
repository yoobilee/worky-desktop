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
  kakao: {
    openChat: (chatName: string): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke('kakao:open-chat', chatName),
    isRunning: (): Promise<boolean> =>
      ipcRenderer.invoke('kakao:is-running'),
    launch: (): Promise<boolean> =>
      ipcRenderer.invoke('kakao:launch'),
  },
  theme: {
    set: (theme: 'light' | 'dark' | 'system'): Promise<void> =>
      ipcRenderer.invoke('theme:set', theme),
    get: (): Promise<{ source: 'light' | 'dark' | 'system'; resolved: 'dark' | 'light' }> =>
      ipcRenderer.invoke('theme:get'),
    onUpdated: (callback: (resolved: 'dark' | 'light') => void) => {
      ipcRenderer.on('theme:updated', (_e, resolved) => callback(resolved))
    },
  },
})
