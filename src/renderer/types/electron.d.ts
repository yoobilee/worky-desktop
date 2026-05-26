export {}

declare global {
  interface Window {
    electronAPI: {
      platform: string
      windowControls: {
        minimize: () => void
        maximize: () => void
        close: () => void
      }
      openExternal: (url: string) => void
      onDeepLink: (callback: (url: string) => void) => void
      kakao: {
        openChat: (chatName: string) => Promise<{ success: boolean; message: string }>
        isRunning: () => Promise<boolean>
        launch: () => Promise<boolean>
      }
      theme: {
        set: (theme: 'light' | 'dark' | 'system') => Promise<void>
        get: () => Promise<{ source: 'light' | 'dark' | 'system'; resolved: 'dark' | 'light' }>
        onUpdated: (callback: (resolved: 'dark' | 'light') => void) => void
      }
    }
  }
}
