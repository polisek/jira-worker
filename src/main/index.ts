import { app, shell, BrowserWindow, ipcMain, session, Notification } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'

const store = new Store()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Window controls IPC
  ipcMain.on('window-minimize', () => mainWindow.minimize())
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('window-close', () => mainWindow.close())
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.jiraworker.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ── Settings IPC ──────────────────────────────────────────────
  ipcMain.handle('settings:get', () => {
    return store.get('settings', null)
  })

  ipcMain.handle('settings:set', (_event, settings) => {
    store.set('settings', settings)
    ipcMain.emit('settings:changed')
    return true
  })

  // ── Jira API IPC ──────────────────────────────────────────────
  ipcMain.handle('jira:request', async (_event, { method, path, body }) => {
    const settings = store.get('settings') as any
    if (!settings?.baseUrl || !settings?.email || !settings?.apiToken) {
      throw new Error('Jira není nakonfigurovaná. Jděte do Nastavení.')
    }

    const url = `${settings.baseUrl.replace(/\/$/, '')}/rest/api/3${path}`
    const credentials = Buffer.from(`${settings.email}:${settings.apiToken}`).toString('base64')

    const response = await fetch(url, {
      method: method || 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })

    const text = await response.text()
    if (!response.ok) {
      let msg = `HTTP ${response.status}`
      try {
        const json = JSON.parse(text)
        msg = json.errorMessages?.join(', ') || json.message || msg
      } catch {}
      throw new Error(msg)
    }

    return text ? JSON.parse(text) : null
  })

  // ── Nativní notifikace IPC ────────────────────────────────────
  ipcMain.handle('notify', (_event, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body, silent: false }).show()
    }
  })

  // ── Jira media interceptor ────────────────────────────────────
  // Přidá Basic auth hlavičku pro requesty na obrázky/přílohy z Jiry,
  // aby se <img> tagy v popisech načetly správně.
  setupMediaInterceptor()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function setupMediaInterceptor() {
  // Při každé změně nastavení znovu nastavíme interceptor
  ipcMain.on('settings:changed', () => attachInterceptor())
  attachInterceptor()
}

function attachInterceptor() {
  const settings = store.get('settings') as any
  if (!settings?.baseUrl || !settings?.email || !settings?.apiToken) return

  const jiraHost = new URL(settings.baseUrl).hostname
  const credentials = Buffer.from(`${settings.email}:${settings.apiToken}`).toString('base64')

  // Zachytí všechny requesty na Jira doménu a přidá auth header
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: [`*://${jiraHost}/*`] },
    (details, callback) => {
      details.requestHeaders['Authorization'] = `Basic ${credentials}`
      callback({ requestHeaders: details.requestHeaders })
    }
  )
}
