import { ipcMain, dialog, type BrowserWindow } from "electron";
import nodePath from "node:path";
import {
  NodeGitExecutor,
  GitError,
  parseWorktreeList,
  checkDirty,
  getAdapter,
  allAdapters,
  type Worktree,
  type TerminalAdapterId,
} from "@worktree-todo/core";
import type { AppStore, AppSettings, RegisteredRepo } from "./store.js";

export interface RepoWorktrees {
  repoId: string;
  repoName: string;
  repoPath: string;
  worktrees: Worktree[];
  error?: string;
}

async function runInChunks<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const cap = Math.max(1, Math.min(items.length, limit));
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: cap }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function registerIpcHandlers(
  store: AppStore,
  mainWindow: BrowserWindow
): void {
  const git = new NodeGitExecutor();
  let currentRefreshAbort: AbortController | null = null;

  ipcMain.handle("refresh", async (): Promise<RepoWorktrees[]> => {
    const repos = store.listRepositories();

    const results = await runInChunks(repos, 5, async (repo): Promise<RepoWorktrees> => {
      try {
        const out = await git.exec(
          ["-C", repo.rootPath, "worktree", "list", "--porcelain"],
        );
        return {
          repoId: repo.id,
          repoName: repo.displayName,
          repoPath: repo.rootPath,
          worktrees: parseWorktreeList(out),
        };
      } catch (err) {
        const msg = err instanceof GitError ? err.stderr || err.message : String(err);
        return {
          repoId: repo.id,
          repoName: repo.displayName,
          repoPath: repo.rootPath,
          worktrees: [],
          error: msg,
        };
      }
    });

    kickoffDirtyScan(results);
    return results;
  });

  function kickoffDirtyScan(results: RepoWorktrees[]): void {
    currentRefreshAbort?.abort();
    const abort = new AbortController();
    currentRefreshAbort = abort;

    const paths: string[] = [];
    for (const r of results) {
      for (const w of r.worktrees) paths.push(w.path);
    }
    if (paths.length === 0) return;

    void runInChunks(paths, 8, async (path) => {
      if (abort.signal.aborted) return;
      const badge = await checkDirty(path, git);
      if (abort.signal.aborted) return;
      if (mainWindow.isDestroyed()) return;
      mainWindow.webContents.send("dirty-update", { path, badge });
    }).catch(() => {
      // Swallow — individual errors are already "unknown" via checkDirty.
    });
  }

  async function findMainRepoRoot(worktreePath: string): Promise<string> {
    const out = await git.exec([
      "-C",
      worktreePath,
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ]);
    // out is the main repo's .git dir (absolute). Parent = main repo root.
    return nodePath.dirname(out.trim());
  }

  ipcMain.handle(
    "remove",
    async (_e, payload: { path: string; force?: boolean }) => {
      const { path, force } = payload;
      if (!force) {
        const badge = await checkDirty(path, git);
        if (badge === "dirty") {
          return { ok: false, error: "DIRTY" };
        }
      }
      try {
        // `git worktree remove` needs to run from the main repo root, not
        // wherever the main process's cwd happens to be. Derive the main
        // repo root from the worktree's .git gitlink via --git-common-dir.
        const repoRoot = await findMainRepoRoot(path);
        const args = ["-C", repoRoot, "worktree", "remove", path];
        if (force) args.splice(4, 0, "--force");
        await git.exec(args);
        return { ok: true };
      } catch (err) {
        const msg =
          err instanceof GitError ? err.stderr || err.message : String(err);
        // Git itself may block remove on modified/untracked files even if
        // our dirty heuristic missed them (e.g. edge cases with submodules).
        // Translate that into the DIRTY surface so the renderer can offer
        // Force Remove instead of just dumping the raw error.
        if (!force && /contains modified or untracked files/i.test(msg)) {
          return { ok: false, error: "DIRTY" };
        }
        return { ok: false, error: msg };
      }
    }
  );

  ipcMain.handle("open", async (_e, payload: { path: string }) => {
    try {
      const settings = store.getSettings();
      const adapter = getAdapter(settings.terminalAdapterId);
      await adapter.open(payload.path);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("addRepo", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false };
    }
    try {
      const repo = await store.addRepository(result.filePaths[0]);
      return { ok: true, repo };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dialog.showErrorBox("Cannot add repository", msg);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("removeRepo", async (_e, payload: { id: string }) => {
    store.removeRepository(payload.id);
    return { ok: true };
  });

  ipcMain.handle("listRepos", async (): Promise<RegisteredRepo[]> => {
    return store.listRepositories();
  });

  ipcMain.handle(
    "getSettings",
    async (): Promise<{
      settings: AppSettings;
      availableAdapters: TerminalAdapterId[];
    }> => {
      const available = await Promise.all(
        allAdapters.map(async (a) => ({ id: a.id, ok: await a.isAvailable() }))
      );
      return {
        settings: store.getSettings(),
        availableAdapters: available.filter((a) => a.ok).map((a) => a.id),
      };
    }
  );

  ipcMain.handle(
    "setTerminal",
    async (_e, payload: { id: TerminalAdapterId }) => {
      store.setTerminal(payload.id);
      return { ok: true };
    }
  );
}
