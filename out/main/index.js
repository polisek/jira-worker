"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const Store = require("electron-store");
const store = new Store();
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#0f1117",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  electron.ipcMain.on("window-minimize", () => mainWindow.minimize());
  electron.ipcMain.on("window-maximize", () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  electron.ipcMain.on("window-close", () => mainWindow.close());
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.jiraworker.app");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.handle("settings:get", () => {
    return store.get("settings", null);
  });
  electron.ipcMain.handle("settings:set", (_event, settings) => {
    store.set("settings", settings);
    electron.ipcMain.emit("settings:changed");
    return true;
  });
  electron.ipcMain.handle("prefs:get", () => {
    return store.get("prefs", {
      doneMaxAgeDays: 14,
      defaultFilter: "mine",
      defaultView: "board",
      maxResults: 100,
      pollIntervalMinutes: 2,
      notifWindowHours: 24
    });
  });
  electron.ipcMain.handle("prefs:set", (_event, prefs) => {
    store.set("prefs", prefs);
    return true;
  });
  electron.ipcMain.handle("jira:request", async (_event, { method, path: path2, body }) => {
    const settings = store.get("settings");
    if (!settings?.baseUrl || !settings?.email || !settings?.apiToken) {
      throw new Error("Jira není nakonfigurovaná. Jděte do Nastavení.");
    }
    const isAgile = path2.startsWith("__agile__");
    const cleanPath = isAgile ? path2.replace("__agile__", "") : path2;
    const base = isAgile ? "/rest/agile/1.0" : "/rest/api/3";
    const url = `${settings.baseUrl.replace(/\/$/, "")}${base}${cleanPath}`;
    const credentials = Buffer.from(`${settings.email}:${settings.apiToken}`).toString("base64");
    const response = await fetch(url, {
      method: method || "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: body ? JSON.stringify(body) : void 0
    });
    const text = await response.text();
    if (!response.ok) {
      let msg = `HTTP ${response.status}`;
      try {
        const json = JSON.parse(text);
        msg = json.errorMessages?.join(", ") || json.message || msg;
      } catch {
      }
      throw new Error(msg);
    }
    return text ? JSON.parse(text) : null;
  });
  electron.ipcMain.handle("notify", (_event, { title, body }) => {
    if (electron.Notification.isSupported()) {
      new electron.Notification({ title, body, silent: false }).show();
    }
  });
  setupMediaInterceptor();
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
function setupMediaInterceptor() {
  electron.ipcMain.on("settings:changed", () => attachInterceptor());
  attachInterceptor();
}
function attachInterceptor() {
  const settings = store.get("settings");
  if (!settings?.baseUrl || !settings?.email || !settings?.apiToken) return;
  const jiraHost = new URL(settings.baseUrl).hostname;
  const credentials = Buffer.from(`${settings.email}:${settings.apiToken}`).toString("base64");
  electron.session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: [`*://${jiraHost}/*`] },
    (details, callback) => {
      details.requestHeaders["Authorization"] = `Basic ${credentials}`;
      callback({ requestHeaders: details.requestHeaders });
    }
  );
}
