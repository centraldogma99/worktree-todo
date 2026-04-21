import { BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let settingsWin: BrowserWindow | null = null;

export function openSettingsWindow(preloadPath: string): void {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }

  settingsWin = new BrowserWindow({
    width: 480,
    height: 320,
    title: "Settings",
    resizable: false,
    minimizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const htmlPath = path.join(__dirname, "..", "renderer", "settings.html");
  settingsWin.loadFile(htmlPath);

  settingsWin.on("closed", () => {
    settingsWin = null;
  });
}
