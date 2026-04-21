import { describe, it, expect } from "vitest";
import { parseWorktreeList } from "../src/parser.js";

const FIXTURE_N1 = `worktree /home/user/repo
HEAD abc1234abc1234abc1234abc1234abc1234abc1234
branch refs/heads/main

`;

const FIXTURE_N3 = `worktree /home/user/repo
HEAD abc1234abc1234abc1234abc1234abc1234abc1234
branch refs/heads/main

worktree /home/user/repo-feat-a
HEAD def5678def5678def5678def5678def5678def5678
branch refs/heads/feat/a

worktree /home/user/repo-bugfix-1
HEAD 9999999999999999999999999999999999999999
branch refs/heads/bugfix/1

`;

// N=15 fixture: main + 14 worktrees
function buildN15(): string {
  let out = `worktree /home/user/repo\nHEAD ${"a".repeat(40)}\nbranch refs/heads/main\n\n`;
  for (let i = 1; i <= 14; i++) {
    out += `worktree /home/user/repo-feat-${i}\nHEAD ${"b".repeat(40)}\nbranch refs/heads/feat/${i}\n\n`;
  }
  return out;
}

// N=30 fixture: main + 29 worktrees
function buildN30(): string {
  let out = `worktree /home/user/repo\nHEAD ${"a".repeat(40)}\nbranch refs/heads/main\n\n`;
  for (let i = 1; i <= 29; i++) {
    out += `worktree /home/user/repo-feat-${i}\nHEAD ${"c".repeat(40)}\nbranch refs/heads/feat/${i}\n\n`;
  }
  return out;
}

// git <2.35: no prunable line
const FIXTURE_GIT_LT_235 = `worktree /home/user/repo
HEAD abc1234abc1234abc1234abc1234abc1234abc1234
branch refs/heads/main

worktree /home/user/repo-old
HEAD deadbeefdeadbeefdeadbeefdeadbeefdeadbeef
detached

`;

describe("parseWorktreeList", () => {
  it("N=1: parses single main worktree", () => {
    const result = parseWorktreeList(FIXTURE_N1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      path: "/home/user/repo",
      head: "abc1234abc1234abc1234abc1234abc1234abc1234",
      branch: "main",
      bare: false,
      detached: false,
      prunable: false,
      locked: false,
    });
  });

  it("N=3: parses three worktrees with correct branches", () => {
    const result = parseWorktreeList(FIXTURE_N3);
    expect(result).toHaveLength(3);
    expect(result[0].branch).toBe("main");
    expect(result[1].branch).toBe("feat/a");
    expect(result[2].branch).toBe("bugfix/1");
  });

  it("N=15: parses fifteen worktrees", () => {
    const result = parseWorktreeList(buildN15());
    expect(result).toHaveLength(15);
    expect(result[0].branch).toBe("main");
    expect(result[14].branch).toBe("feat/14");
  });

  it("N=30: parses thirty worktrees", () => {
    const result = parseWorktreeList(buildN30());
    expect(result).toHaveLength(30);
    expect(result[29].branch).toBe("feat/29");
  });

  it("git <2.35: gracefully handles missing prunable line", () => {
    const result = parseWorktreeList(FIXTURE_GIT_LT_235);
    expect(result).toHaveLength(2);
    expect(result[1].prunable).toBe(false);
    expect(result[1].detached).toBe(true);
    expect(result[1].prunableReason).toBeNull();
  });

  it("parses prunable with reason", () => {
    const fixture = `worktree /home/user/repo
HEAD abc1234abc1234abc1234abc1234abc1234abc1234
branch refs/heads/main

worktree /tmp/gone
HEAD deadbeefdeadbeefdeadbeefdeadbeefdeadbeef
prunable gitdir file points to non-existent location

`;
    const result = parseWorktreeList(fixture);
    expect(result[1].prunable).toBe(true);
    expect(result[1].prunableReason).toBe("gitdir file points to non-existent location");
  });

  it("parses locked worktree with reason", () => {
    const fixture = `worktree /home/user/repo
HEAD abc1234abc1234abc1234abc1234abc1234abc1234
branch refs/heads/main

worktree /mnt/usb/repo-release
HEAD deadbeefdeadbeefdeadbeefdeadbeefdeadbeef
branch refs/heads/release/1.0
locked on removable device

`;
    const result = parseWorktreeList(fixture);
    expect(result[1].locked).toBe(true);
    expect(result[1].lockedReason).toBe("on removable device");
  });

  it("returns empty array for empty input", () => {
    expect(parseWorktreeList("")).toHaveLength(0);
    expect(parseWorktreeList("\n\n")).toHaveLength(0);
  });

  it("bare worktree is parsed correctly", () => {
    const fixture = `worktree /srv/bare.git
HEAD abc1234abc1234abc1234abc1234abc1234abc1234
bare

`;
    const result = parseWorktreeList(fixture);
    expect(result[0].bare).toBe(true);
    expect(result[0].branch).toBeNull();
  });
});
