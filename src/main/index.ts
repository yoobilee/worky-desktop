import { app, BrowserWindow, ipcMain, nativeTheme, shell, screen } from 'electron'
import path from 'path'
import http from 'http'
import { openKakaoChat, isKakaoRunning, launchKakao } from './kakao'

const isDev = process.env.NODE_ENV === 'development'

// 개발 환경에서는 electron 실행 파일 + 앱 경로를 명시적으로 등록
if (isDev) {
  app.setAsDefaultProtocolClient('worky', process.execPath, [app.getAppPath()])
} else {
  app.setAsDefaultProtocolClient('worky')
}

let mainWindow: BrowserWindow | null = null
let callbackServer: http.Server | null = null

function startCallbackServer() {
  callbackServer = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:7777')
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        `<html><head><meta charset="utf-8"></head>` +
        `<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center;padding:80px 40px;background:#efefff;color:#1a1a2e;margin:0">` +
        `<div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#6C63FF,#8B85FF);margin-bottom:20px">` +
        `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` +
        `</div>` +
        `<h2 style="margin:0 0 8px;font-size:20px;font-weight:700">로그인 완료!</h2>` +
        `<p style="color:#6b6b8a;margin:0;font-size:14px">이 탭을 닫고 WORKY mini로 돌아가세요.</p>` +
        `</body></html>`
      )

      if (code) {
        const callbackUrl = `http://localhost:7777/callback?code=${code}${state ? `&state=${state}` : ''}`
        mainWindow?.webContents.send('deep-link', callbackUrl)
      }
    } else {
      res.writeHead(404).end()
    }
  })
  callbackServer.listen(7777)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 700,
    minWidth: 340,
    minHeight: 500,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    backgroundColor: '#0a0a12',
    show: false,
    icon: path.join(__dirname, '../../public/icon.png'),
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  const SNAP = 20
  mainWindow.on('move', () => {
    if (!mainWindow?.isAlwaysOnTop()) return
    const [x, y] = mainWindow.getPosition()
    const [w, h] = mainWindow.getSize()
    const { width, height } = screen.getPrimaryDisplay().workArea
    let nx = x, ny = y
    if (x <= SNAP) nx = 0
    else if (x + w >= width - SNAP) nx = width - w
    if (y <= SNAP) ny = 0
    else if (y + h >= height - SNAP) ny = height - h
    if (nx !== x || ny !== y) mainWindow.setPosition(nx, ny)
  })
  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('theme:updated', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  })

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
ipcMain.handle('theme:set', (_e, theme: 'light' | 'dark' | 'system') => {
  nativeTheme.themeSource = theme
  mainWindow?.webContents.send('theme:updated', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
})
ipcMain.handle('theme:get', () => ({
  source: nativeTheme.themeSource,
  resolved: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
}))
ipcMain.handle('kakao:is-running', () => isKakaoRunning())
ipcMain.handle('kakao:launch', () => launchKakao())
ipcMain.handle('window:pin', (_e, pinned: boolean) => mainWindow?.setAlwaysOnTop(pinned))
ipcMain.handle('window:get-pin', () => mainWindow?.isAlwaysOnTop() ?? false)


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

  app.whenReady().then(async () => {
    startCallbackServer()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
    try {
      const running = await isKakaoRunning()
      if (!running) await launchKakao()
    } catch { /* 카카오톡 없는 환경 무시 */ }
  })
}

app.on('window-all-closed', () => {
  callbackServer?.close()
  if (process.platform !== 'darwin') app.quit()
})
