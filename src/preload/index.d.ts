import { ElectronAPI } from '@electron-toolkit/preload'

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
    }
  }
}

export interface JiraSettings {
  baseUrl: string
  email: string
  apiToken: string
  defaultProject?: string
}
