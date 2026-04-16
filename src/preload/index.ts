import { contextBridge, ipcRenderer } from "electron"
import { electronAPI } from "@electron-toolkit/preload"

const api = {
    // Window controls
    minimizeWindow: () => ipcRenderer.send("window-minimize"),
    maximizeWindow: () => ipcRenderer.send("window-maximize"),
    closeWindow: () => ipcRenderer.send("window-close"),

    // Settings
    getSettings: () => ipcRenderer.invoke("settings:get"),
    setSettings: (settings: unknown) => ipcRenderer.invoke("settings:set", settings),

    // Jira API proxy (runs in main process with credentials)
    jiraRequest: (opts: { method?: string; path: string; body?: unknown }) => ipcRenderer.invoke("jira:request", opts),

    // Nativní Windows notifikace
    notify: (title: string, body: string) => ipcRenderer.invoke("notify", { title, body }),

    // App preferences
    getPrefs: () => ipcRenderer.invoke("prefs:get"),
    setPrefs: (prefs: unknown) => ipcRenderer.invoke("prefs:set", prefs),

    // Media proxy
    fetchMedia: (contentUrl: string) => ipcRenderer.invoke("media:fetch", contentUrl),

    // Time tracking
    getTimeEntries: () => ipcRenderer.invoke("time:getEntries"),
    saveTimeEntry: (entry: unknown) => ipcRenderer.invoke("time:saveEntry", entry),
    deleteTimeEntry: (id: string) => ipcRenderer.invoke("time:deleteEntry", id),

    // Auto-update
    onUpdateAvailable: (cb: (version: string) => void) =>
        ipcRenderer.on("update:available", (_e, version) => cb(version)),
    onUpdateDownloaded: (cb: () => void) => ipcRenderer.on("update:downloaded", () => cb()),
    installUpdate: () => ipcRenderer.send("update:install"),
}

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld("electron", electronAPI)
        contextBridge.exposeInMainWorld("api", api)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore
    window.electron = electronAPI
    // @ts-ignore
    window.api = api
}
