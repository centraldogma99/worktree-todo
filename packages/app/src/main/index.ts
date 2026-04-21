import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTray, getPositionNearIcon } from "./tray.js";
import { createWindow } from "./window.js";
import { registerIpcHandlers } from "./ipc.js";
import { AppStore } from "./store.js";
import { openSettingsWindow } from "./settings-window.js";

// Pin the app name so electron-store's userData path is the same in dev
// (raw `electron` binary) and packaged builds. Without this, dev writes to
// ~/Library/Application Support/Electron/config.json while the Raycast
// extension expects ~/Library/Application Support/worktree-todo/config.json.
app.setName("worktree-todo");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let isMutating = false;

function toggleWindow(trayBounds: Electron.Rectangle) {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const { x, y } = getPositionNearIcon(mainWindow, trayBounds, display);
  mainWindow.setPosition(x, y, false);
  mainWindow.show();
  mainWindow.focus();
}

app.whenReady().then(() => {
  mainWindow = createWindow(path.join(__dirname, "..", "preload", "preload.js"));

  const store = new AppStore();
  registerIpcHandlers(store, mainWindow);

  mainWindow.on("blur", () => {
    if (!mainWindow) return;
    if (mainWindow.webContents.isDevToolsOpened()) return;
    if (isMutating) return;
    mainWindow.hide();
  });

  ipcMain.on("hide-window", () => {
    if (isMutating) return;
    mainWindow?.hide();
  });

  ipcMain.on("set-mutating", (_e, flag: boolean) => {
    isMutating = Boolean(flag);
  });

  createTray(
    __dirname,
    (bounds) => toggleWindow(bounds),
    () => openSettingsWindow(path.join(__dirname, "..", "preload", "preload.js")),
  );

  if (process.platform === "darwin") {
    app.dock?.hide();
  }
});

app.on("window-all-closed", (event: Electron.Event) => {
  event.preventDefault();
});
