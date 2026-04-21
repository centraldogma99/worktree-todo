import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(_execFile);

export class GitError extends Error {
  constructor(
    message: string,
    public readonly code: number | null,
    public readonly stderr: string
  ) {
    super(message);
    this.name = "GitError";
  }
}

export interface GitExecutor {
  exec(args: string[], options?: { cwd?: string }): Promise<string>;
}

export class NodeGitExecutor implements GitExecutor {
  async exec(args: string[], options?: { cwd?: string }): Promise<string> {
    try {
      const { stdout } = await execFileAsync("git", args, {
        cwd: options?.cwd,
        maxBuffer: 10 * 1024 * 1024,
      });
      return stdout;
    } catch (err: unknown) {
      const e = err as { code?: number; stderr?: string; message?: string };
      throw new GitError(
        e.message ?? "git failed",
        e.code ?? null,
        e.stderr ?? ""
      );
    }
  }
}

export class MockGitExecutor implements GitExecutor {
  private responses: Map<string, string> = new Map();
  public calls: Array<{ args: string[]; cwd?: string }> = [];

  setResponse(argsKey: string, output: string): void {
    this.responses.set(argsKey, output);
  }

  async exec(args: string[], options?: { cwd?: string }): Promise<string> {
    this.calls.push({ args, cwd: options?.cwd });
    const key = args.join(" ");
    if (this.responses.has(key)) {
      return this.responses.get(key)!;
    }
    throw new GitError(`No mock for: git ${key}`, 128, "");
  }
}
