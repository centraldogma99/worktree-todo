import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(_execFile);

export type TerminalAdapterId = "terminal-app" | "iterm2" | "ghostty" | "cmux";

export interface TerminalAdapter {
  id: TerminalAdapterId;
  open(path: string): Promise<void>;
  isAvailable(): Promise<boolean>;
  buildArgs(path: string): { cmd: string; args: string[] };
}

function shellEscape(str: string): string {
  return `'${str.replace(/'/g, "'\\''")}'`;
}

export const terminalAppAdapter: TerminalAdapter = {
  id: "terminal-app",
  buildArgs(path: string) {
    return { cmd: "open", args: ["-na", "-b", "com.apple.Terminal", path] };
  },
  async open(path: string) {
    const { cmd, args } = this.buildArgs(path);
    await execFileAsync(cmd, args);
  },
  async isAvailable() {
    return process.platform === "darwin";
  },
};

export const iterm2Adapter: TerminalAdapter = {
  id: "iterm2",
  buildArgs(path: string) {
    return { cmd: "open", args: ["-na", "-b", "com.googlecode.iterm2", path] };
  },
  async open(path: string) {
    const { cmd, args } = this.buildArgs(path);
    await execFileAsync(cmd, args);
  },
  async isAvailable() {
    try {
      await execFileAsync("open", ["-Ra", "iTerm"]);
      return true;
    } catch {
      return false;
    }
  },
};

export const ghosttyAdapter: TerminalAdapter = {
  id: "ghostty",
  buildArgs(path: string) {
    return { cmd: "open", args: ["-a", "Ghostty", path] };
  },
  async open(path: string) {
    try {
      await execFileAsync("open", ["-a", "Ghostty", path]);
    } catch {
      await execFileAsync("open", ["-a", "Ghostty", "--args", `--working-directory=${path}`]);
    }
  },
  async isAvailable() {
    try {
      await execFileAsync("open", ["-Ra", "Ghostty"]);
      return true;
    } catch {
      return false;
    }
  },
};

interface CmuxWorkspace {
  ref: string;
  current_directory?: string | null;
}

interface CmuxWorkspaceListResult {
  workspaces: CmuxWorkspace[];
}

export const cmuxAdapter: TerminalAdapter = {
  id: "cmux",
  buildArgs(path: string) {
    // Canonical "create new" shape. open() falls back to this after reuse lookup.
    return { cmd: "cmux", args: ["new-workspace", "--cwd", path] };
  },
  async open(path: string) {
    // Reuse-or-create: query existing workspaces, switch to one whose current_directory matches.
    try {
      const { stdout } = await execFileAsync("cmux", ["rpc", "workspace.list"]);
      const data = JSON.parse(stdout) as CmuxWorkspaceListResult;
      const match = data.workspaces.find((w) => w.current_directory === path);
      if (match) {
        await execFileAsync("cmux", ["select-workspace", "--workspace", match.ref]);
        return;
      }
    } catch {
      // workspace.list rpc unavailable or parse failure → fall through to create path.
    }
    const { stdout: created } = await execFileAsync("cmux", ["new-workspace", "--cwd", path]);
    // new-workspace prints "OK workspace:<N>" but does not auto-focus. Select explicitly.
    const refMatch = created.match(/workspace:\d+/);
    if (refMatch) {
      await execFileAsync("cmux", ["select-workspace", "--workspace", refMatch[0]]);
    }
  },
  async isAvailable() {
    try {
      await execFileAsync("which", ["cmux"]);
      return true;
    } catch {
      return false;
    }
  },
};

export const allAdapters: TerminalAdapter[] = [
  terminalAppAdapter,
  iterm2Adapter,
  ghosttyAdapter,
  cmuxAdapter,
];

export function getAdapter(id: TerminalAdapterId): TerminalAdapter {
  const adapter = allAdapters.find((a) => a.id === id);
  if (!adapter) throw new Error(`Unknown terminal adapter: ${id}`);
  return adapter;
}
