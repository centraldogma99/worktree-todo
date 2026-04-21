import { randomBytes } from "node:crypto";
import { app } from "electron";
import Store from "electron-store";
import { NodeGitExecutor, GitError, type GitExecutor } from "@worktree-todo/core";

export interface RegisteredRepo {
  id: string;
  rootPath: string;
  displayName: string;
  addedAt: string;
}

export interface AppSettings {
  terminalAdapterId: "terminal-app" | "iterm2" | "ghostty" | "cmux";
}

interface StoreSchema {
  repositories: RegisteredRepo[];
  settings: AppSettings;
}

const DEFAULT_SETTINGS: AppSettings = { terminalAdapterId: "cmux" };

export class AppStore {
  private store: Store<StoreSchema>;
  private git: GitExecutor;

  constructor(git: GitExecutor = new NodeGitExecutor()) {
    this.git = git;
    this.store = new Store<StoreSchema>({
      name: "config",
      cwd: app.getPath("userData"),
      defaults: {
        repositories: [],
        settings: DEFAULT_SETTINGS,
      },
    });
  }

  async addRepository(rootPath: string): Promise<RegisteredRepo> {
    let resolvedPath: string;
    try {
      const out = await this.git.exec(
        ["-C", rootPath, "rev-parse", "--show-toplevel"],
      );
      resolvedPath = out.trim();
    } catch (err) {
      const msg = err instanceof GitError ? err.stderr || err.message : String(err);
      throw new Error(`Not a git repository: ${msg}`);
    }

    const existing = this.store.get("repositories").find(
      (r) => r.rootPath === resolvedPath
    );
    if (existing) return existing;

    const id = randomBytes(4).toString("hex");
    const displayName = resolvedPath.split("/").at(-1) ?? resolvedPath;
    const entry: RegisteredRepo = {
      id,
      rootPath: resolvedPath,
      displayName,
      addedAt: new Date().toISOString(),
    };

    const repos = this.store.get("repositories");
    repos.push(entry);
    this.store.set("repositories", repos);
    return entry;
  }

  removeRepository(id: string): void {
    const repos = this.store.get("repositories").filter((r) => r.id !== id);
    this.store.set("repositories", repos);
  }

  listRepositories(): RegisteredRepo[] {
    return this.store.get("repositories");
  }

  getSettings(): AppSettings {
    return this.store.get("settings");
  }

  setTerminal(id: AppSettings["terminalAdapterId"]): void {
    this.store.set("settings", { ...this.store.get("settings"), terminalAdapterId: id });
  }
}
