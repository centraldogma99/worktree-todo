import { BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createWindow(preloadPath: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 360,
    height: 480,
    frame: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const htmlPath = path.join(__dirname, "..", "renderer", "index.html");
  win.loadFile(htmlPath);

  return win;
}
