import type { Worktree } from "./types.js";

/**
 * Parses the output of `git worktree list --porcelain`.
 * Handles git <2.35 where the `prunable` line may be absent.
 */
export function parseWorktreeList(porcelain: string): Worktree[] {
  const worktrees: Worktree[] = [];
  const blocks = porcelain.trim().split(/\n\n+/);

  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.split("\n");
    const wt: Partial<Worktree> & { path?: string } = {
      bare: false,
      detached: false,
      prunable: false,
      prunableReason: null,
      locked: false,
      lockedReason: null,
      branch: null,
      head: "",
    };

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        wt.path = line.slice("worktree ".length);
      } else if (line.startsWith("HEAD ")) {
        wt.head = line.slice("HEAD ".length);
      } else if (line.startsWith("branch ")) {
        const raw = line.slice("branch ".length);
        wt.branch = raw.startsWith("refs/heads/") ? raw.slice("refs/heads/".length) : raw;
      } else if (line === "bare") {
        wt.bare = true;
      } else if (line === "detached") {
        wt.detached = true;
      } else if (line === "prunable") {
        wt.prunable = true;
      } else if (line.startsWith("prunable ")) {
        wt.prunable = true;
        wt.prunableReason = line.slice("prunable ".length);
      } else if (line === "locked") {
        wt.locked = true;
      } else if (line.startsWith("locked ")) {
        wt.locked = true;
        wt.lockedReason = line.slice("locked ".length);
      }
    }

    if (wt.path !== undefined) {
      worktrees.push(wt as Worktree);
    }
  }

  return worktrees;
}
