import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import { openKakaoChat, isKakaoRunning, launchKakao } from './kakao'

const isDev = process.env.NODE_ENV === 'development'

// 개발 환경에서는 electron 실행 파일 + 앱 경로를 명시적으로 등록
if (isDev) {
  app.setAsDefaultProtocolClient('worky', process.execPath, [app.getAppPath()])
} else {
  app.setAsDefaultProtocolClient('worky')
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    backgroundColor: '#0f172a',
    show: false,
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.restore()
  else mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())
ipcMain.on('open-external', (_e, url: string) => shell.openExternal(url))

ipcMain.handle('kakao:open-chat', (_e, chatName: string) => openKakaoChat(chatName))
ipcMain.handle('kakao:is-running', () => isKakaoRunning())
ipcMain.handle('kakao:launch', () => launchKakao())

// Windows: deep link via second instance
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    const deepLink = argv.find((arg) => arg.startsWith('worky://'))
    if (deepLink) mainWindow?.webContents.send('deep-link', deepLink)
  })

  // macOS: deep link via open-url
  app.on('open-url', (e, url) => {
    e.preventDefault()
    mainWindow?.webContents.send('deep-link', url)
  })

  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
