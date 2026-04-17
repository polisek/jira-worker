import { ElectronAPI } from "@electron-toolkit/preload"

declare global {
    interface Window {
        electron: ElectronAPI
        api: {
            minimizeWindow: () => void
            maximizeWindow: () => void
            closeWindow: () => void
            getSettings: () => Promise<JiraSettings | null>
            setSettings: (settings: JiraSettings) => Promise<boolean>
            jiraRequest: (opts: { method?: string; path: string; body?: unknown }) => Promise<unknown>
            notify: (title: string, body: string) => Promise<void>
            getPrefs: () => Promise<AppPrefs>
            setPrefs: (prefs: AppPrefs) => Promise<boolean>
            fetchMedia: (contentUrl: string) => Promise<string | null>
            getTimeEntries: () => Promise<unknown[]>
            saveTimeEntry: (entry: unknown) => Promise<boolean>
            deleteTimeEntry: (id: string) => Promise<boolean>
            onUpdateAvailable: (cb: (version: string) => void) => void
            onUpdateDownloaded: (cb: () => void) => void
            installUpdate: () => void
        }
    }
}

export interface JiraSettings {
    baseUrl: string
    email: string
    apiToken: string
    defaultProject?: string
}

export interface AppPrefs {
    doneMaxAgeDays: number // 0 = nezobrazovat, -1 = vše
    defaultFilter: "all" | "mine" | "unassigned"
    defaultView: "board" | "list"
    maxResults: number
    pollIntervalMinutes: number
    notifWindowHours: number
    selectedProjectKey: string | null
    dailyWorkHours: number
    theme: "dark" | "light" | "auto"
    hiddenProjectKeys: string[]
}
