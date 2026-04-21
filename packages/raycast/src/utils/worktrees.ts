import {
  NodeGitExecutor,
  parseWorktreeList,
  checkDirty,
  type Worktree,
  type WorktreeWithDirty,
  type DirtyBadge,
} from "@worktree-todo/core";
import type { StoredRepo } from "./config.js";

export interface RepoWorktrees {
  repo: StoredRepo;
  worktrees: WorktreeWithDirty[];
  error: string | null;
}

const git = new NodeGitExecutor();

export async function loadWorktreesForRepo(repo: StoredRepo): Promise<RepoWorktrees> {
  try {
    const porcelain = await git.exec(
      ["-C", repo.rootPath, "worktree", "list", "--porcelain"],
    );
    const parsed: Worktree[] = parseWorktreeList(porcelain);
    const worktrees: WorktreeWithDirty[] = parsed.map((w) => ({ ...w, dirty: "unknown" }));
    return { repo, worktrees, error: null };
  } catch (err) {
    return {
      repo,
      worktrees: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function loadAllWorktrees(repos: StoredRepo[]): Promise<RepoWorktrees[]> {
  return Promise.all(repos.map((r) => loadWorktreesForRepo(r)));
}

export async function checkDirtyFor(path: string): Promise<DirtyBadge> {
  return checkDirty(path, git);
}
