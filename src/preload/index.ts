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
    listWindows: (): Promise<string[]> =>
      ipcRenderer.invoke('kakao:list-windows'),
  },
})
