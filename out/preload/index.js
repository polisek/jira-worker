"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  // Window controls
  minimizeWindow: () => electron.ipcRenderer.send("window-minimize"),
  maximizeWindow: () => electron.ipcRenderer.send("window-maximize"),
  closeWindow: () => electron.ipcRenderer.send("window-close"),
  // Settings
  getSettings: () => electron.ipcRenderer.invoke("settings:get"),
  setSettings: (settings) => electron.ipcRenderer.invoke("settings:set", settings),
  // Jira API proxy (runs in main process with credentials)
  jiraRequest: (opts) => electron.ipcRenderer.invoke("jira:request", opts),
  // Nativní Windows notifikace
  notify: (title, body) => electron.ipcRenderer.invoke("notify", { title, body }),
  // App preferences
  getPrefs: () => electron.ipcRenderer.invoke("prefs:get"),
  setPrefs: (prefs) => electron.ipcRenderer.invoke("prefs:set", prefs)
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
