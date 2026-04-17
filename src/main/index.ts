import { app, shell, BrowserWindow, ipcMain, session, Notification } from "electron"
import { join } from "path"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"
import { autoUpdater } from "electron-updater"
import Store from "electron-store"

const store = new Store()

function createWindow(): void {
    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        show: false,
        frame: false,
        titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
        backgroundColor: "#0f1117",
        webPreferences: {
            preload: join(__dirname, "../preload/index.js"),
            sandbox: false,
        },
    })

    mainWindow.on("ready-to-show", () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: "deny" }
    })

    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
        mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
    } else {
        mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
    }

    // Window controls IPC
    ipcMain.on("window-minimize", () => mainWindow.minimize())
    ipcMain.on("window-maximize", () => {
        if (mainWindow.isMaximized()) mainWindow.unmaximize()
        else mainWindow.maximize()
    })
    ipcMain.on("window-close", () => mainWindow.close())
}

app.whenReady().then(() => {
    electronApp.setAppUserModelId("com.jiraworker.app")

    app.on("browser-window-created", (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    // ── Settings IPC ──────────────────────────────────────────────
    ipcMain.handle("settings:get", () => {
        return store.get("settings", null)
    })

    ipcMain.handle("settings:set", (_event, settings) => {
        store.set("settings", settings)
        ipcMain.emit("settings:changed")
        return true
    })

  // ── Time tracking IPC ────────────────────────────────────────
  ipcMain.handle('time:getEntries', () => {
    const entries = store.get('timeEntries', []) as any[]
    const seen = new Set<string>()
    return entries.filter((e: any) => {
      const key = String(e.id)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  })
  ipcMain.handle('time:saveEntry', (_e, entry) => {
    const entries = store.get('timeEntries', []) as any[]
    const filtered = entries.filter((e: any) => String(e.id) !== String(entry.id))
    filtered.unshift(entry)
    store.set('timeEntries', filtered.slice(0, 200))
    return true
  })
  ipcMain.handle('time:deleteEntry', (_e, id) => {
    const entries = store.get('timeEntries', []) as any[]
    store.set('timeEntries', entries.filter((e: any) => String(e.id) !== String(id)))
    return true
  })

    // ── App prefs IPC ─────────────────────────────────────────────
    ipcMain.handle("prefs:get", () => {
        const defaults = {
            doneMaxAgeDays: 14,
            defaultFilter: "mine",
            defaultView: "board",
            maxResults: 100,
            pollIntervalMinutes: 2,
            notifWindowHours: 24,
            dailyWorkHours: 8,
        }
        return { ...defaults, ...(store.get("prefs", {}) as object) }
    })

    ipcMain.handle("prefs:set", (_event, prefs) => {
        store.set("prefs", prefs)
        return true
    })

    // ── Jira API IPC ──────────────────────────────────────────────
    ipcMain.handle("jira:request", async (_event, { method, path, body }) => {
        const settings = store.get("settings") as any
        if (!settings?.baseUrl || !settings?.email || !settings?.apiToken) {
            throw new Error("Jira není nakonfigurovaná. Jděte do Nastavení.")
        }

        // Agile API má jiný base path
        const isAgile = path.startsWith("__agile__")
        const cleanPath = isAgile ? path.replace("__agile__", "") : path
        const base = isAgile ? "/rest/agile/1.0" : "/rest/api/3"
        const url = `${settings.baseUrl.replace(/\/$/, "")}${base}${cleanPath}`
        const credentials = Buffer.from(`${settings.email}:${settings.apiToken}`).toString("base64")

        const response = await fetch(url, {
            method: method || "GET",
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: body ? JSON.stringify(body) : undefined,
        })

        const text = await response.text()
        if (!response.ok) {
            let msg = `HTTP ${response.status}`
            try {
                const json = JSON.parse(text)
                msg = json.errorMessages?.join(", ") || json.message || msg
            } catch {}
            throw new Error(msg)
        }

        return text ? JSON.parse(text) : null
    })

    // ── Media proxy ───────────────────────────────────────────────
    ipcMain.handle("media:fetch", async (_e, contentUrl: string) => {
        const settings = store.get("settings") as any
        if (!settings?.email || !settings?.apiToken) return null
        const credentials = Buffer.from(`${settings.email}:${settings.apiToken}`).toString("base64")
        try {
            const res = await fetch(contentUrl, {
                headers: { Authorization: `Basic ${credentials}` },
                redirect: "follow",
            })
            if (!res.ok) return null
            const ct = res.headers.get("content-type") ?? "image/png"
            const buffer = await res.arrayBuffer()
            return `data:${ct.split(";")[0]};base64,${Buffer.from(buffer).toString("base64")}`
        } catch {
            return null
        }
    })

    // ── Nativní notifikace IPC ────────────────────────────────────
    ipcMain.handle("notify", (_event, { title, body }: { title: string; body: string }) => {
        if (Notification.isSupported()) {
            new Notification({ title, body, silent: false }).show()
        }
    })

    // ── Jira media interceptor ────────────────────────────────────
    // Přidá Basic auth hlavičku pro requesty na obrázky/přílohy z Jiry,
    // aby se <img> tagy v popisech načetly správně.
    setupMediaInterceptor()

    createWindow()
    if (!is.dev) setupAutoUpdater()

    app.on("activate", function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
})

function setupAutoUpdater() {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    // Zkontrolovat po 3 sekundách od spuštění
    setTimeout(() => autoUpdater.checkForUpdates(), 3000)
    // A pak každou hodinu
    setInterval(() => autoUpdater.checkForUpdates(), 60 * 60 * 1000)

    autoUpdater.on("update-available", (info: { version: string }) => {
        BrowserWindow.getAllWindows()[0]?.webContents.send("update:available", info.version)
    })

    autoUpdater.on("update-downloaded", () => {
        BrowserWindow.getAllWindows()[0]?.webContents.send("update:downloaded")
    })

    autoUpdater.on("error", (err: Error) => {
        console.error("AutoUpdater:", err.message)
    })

    ipcMain.on("update:install", () => autoUpdater.quitAndInstall())
}

function setupMediaInterceptor() {
    // Při každé změně nastavení znovu nastavíme interceptor
    ipcMain.on("settings:changed", () => attachInterceptor())
    attachInterceptor()
}

function attachInterceptor() {
    const settings = store.get("settings") as any
    if (!settings?.baseUrl || !settings?.email || !settings?.apiToken) return

    const jiraHost = new URL(settings.baseUrl).hostname
    const credentials = Buffer.from(`${settings.email}:${settings.apiToken}`).toString("base64")

    // Zachytí všechny requesty na Jira doménu a přidá auth header
    session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [`*://${jiraHost}/*`] }, (details, callback) => {
        details.requestHeaders["Authorization"] = `Basic ${credentials}`
        callback({ requestHeaders: details.requestHeaders })
    })
}
