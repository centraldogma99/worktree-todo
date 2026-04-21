import { Tray, nativeImage, BrowserWindow, Rectangle, Display, Menu, app } from "electron";
import path from "node:path";
import fs from "node:fs";

const TRANSPARENT_PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function loadTrayImage(mainDir: string): Electron.NativeImage {
  const candidate = path.resolve(mainDir, "..", "..", "resources", "trayTemplate.png");
  if (fs.existsSync(candidate)) {
    const img = nativeImage.createFromPath(candidate);
    img.setTemplateImage(true);
    return img;
  }
  const buf = Buffer.from(TRANSPARENT_PNG_1X1_BASE64, "base64");
  const img = nativeImage.createFromBuffer(buf);
  img.setTemplateImage(true);
  return img;
}

export function createTray(
  mainDir: string,
  onClick: (bounds: Rectangle) => void,
  onOpenSettings: () => void,
): Tray {
  const image = loadTrayImage(mainDir);
  const tray = new Tray(image);
  tray.setToolTip("Worktrees");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Settings", click: onOpenSettings },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  // NOTE: do NOT call tray.setContextMenu() — on macOS it hijacks left-click
  // and opens the menu alongside our popup. Instead, show the menu manually
  // on right-click only via popUpContextMenu().
  tray.on("click", () => {
    onClick(tray.getBounds());
  });
  tray.on("right-click", () => {
    tray.popUpContextMenu(contextMenu);
  });

  return tray;
}

export function getPositionNearIcon(
  window: BrowserWindow,
  trayBounds: Rectangle,
  display: Display
): { x: number; y: number } {
  const [winWidth, winHeight] = window.getSize();
  const centerX = Math.round(trayBounds.x + trayBounds.width / 2 - winWidth / 2);
  const workArea = display.workArea;
  const minX = workArea.x;
  const maxX = workArea.x + workArea.width - winWidth;
  const clampedX = Math.min(Math.max(centerX, minX), maxX);
  const y = Math.round(trayBounds.y + trayBounds.height);
  const clampedY = Math.max(workArea.y, y);
  void winHeight;
  return { x: clampedX, y: clampedY };
}
