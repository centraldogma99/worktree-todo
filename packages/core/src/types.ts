export interface Worktree {
  path: string;
  head: string;
  branch: string | null;
  bare: boolean;
  detached: boolean;
  prunable: boolean;
  prunableReason: string | null;
  locked: boolean;
  lockedReason: string | null;
}

export interface Repository {
  id: string;
  path: string;
  label: string;
}

export type DirtyBadge = "clean" | "dirty" | "unknown";

export interface WorktreeWithDirty extends Worktree {
  dirty: DirtyBadge;
}
