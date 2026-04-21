import type { GitExecutor } from "./git.js";
import type { DirtyBadge } from "./types.js";

export async function checkDirty(
  path: string,
  git: GitExecutor
): Promise<DirtyBadge> {
  try {
    // NOTE: we do NOT pass `-uno` — `git worktree remove` treats untracked
    // files as a blocker too, so our dirty heuristic must match that
    // definition or users will hit unexpected "contains modified or
    // untracked files" errors from git.
    const out = await git.exec(
      ["status", "--porcelain=v2", "--no-renames"],
      { cwd: path }
    );
    return out.trim().length > 0 ? "dirty" : "clean";
  } catch {
    return "unknown";
  }
}

export async function fetchAheadCount(
  path: string,
  git: GitExecutor
): Promise<number | null> {
  try {
    const out = await git.exec(
      ["log", "@{u}..HEAD", "--oneline"],
      { cwd: path }
    );
    const lines = out.trim().split("\n").filter(Boolean);
    return lines.length;
  } catch {
    return null;
  }
}
