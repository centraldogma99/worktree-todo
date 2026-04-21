import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

type TerminalAdapterId = "terminal-app" | "iterm2" | "ghostty" | "cmux";

const api = {
  refresh: () => ipcRenderer.invoke("refresh"),
  remove: (path: string, force?: boolean) =>
    ipcRenderer.invoke("remove", { path, force }),
  open: (path: string) => ipcRenderer.invoke("open", { path }),
  addRepo: () => ipcRenderer.invoke("addRepo"),
  removeRepo: (id: string) => ipcRenderer.invoke("removeRepo", { id }),
  listRepos: () => ipcRenderer.invoke("listRepos"),
  getSettings: () => ipcRenderer.invoke("getSettings"),
  setTerminal: (id: TerminalAdapterId) =>
    ipcRenderer.invoke("setTerminal", { id }),
  onDirtyUpdate: (
    handler: (payload: { path: string; badge: "clean" | "dirty" | "unknown" }) => void
  ) => {
    const listener = (
      _e: IpcRendererEvent,
      payload: { path: string; badge: "clean" | "dirty" | "unknown" }
    ) => handler(payload);
    ipcRenderer.on("dirty-update", listener);
    return () => ipcRenderer.removeListener("dirty-update", listener);
  },
  hideWindow: () => ipcRenderer.send("hide-window"),
  setMutating: (flag: boolean) => ipcRenderer.send("set-mutating", flag),
};

contextBridge.exposeInMainWorld("api", api);

export type WorktreeApi = typeof api;
