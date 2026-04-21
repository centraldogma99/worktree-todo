import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { TerminalAdapterId } from "@worktree-todo/core";

export interface StoredRepo {
  id: string;
  rootPath: string;
  displayName: string;
  addedAt: string;
}

export interface StoredSettings {
  terminalAdapterId: TerminalAdapterId;
}

export interface StoredConfig {
  repositories: StoredRepo[];
  settings: StoredSettings;
}

const DEFAULT_TERMINAL: TerminalAdapterId = "cmux";

export function configPath(): string {
  return join(homedir(), "Library", "Application Support", "worktree-todo", "config.json");
}

export async function readStoredConfig(): Promise<StoredConfig | null> {
  try {
    const raw = await readFile(configPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredConfig>;
    const repositories = Array.isArray(parsed.repositories) ? parsed.repositories : [];
    const terminalAdapterId =
      parsed.settings?.terminalAdapterId ?? DEFAULT_TERMINAL;
    return {
      repositories,
      settings: { terminalAdapterId },
    };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    if (err instanceof SyntaxError) return null;
    throw err;
  }
}
