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
    }
  }
}
