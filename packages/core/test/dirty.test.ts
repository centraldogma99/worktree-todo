import { describe, it, expect } from "vitest";
import { checkDirty, fetchAheadCount } from "../src/dirty.js";
import { MockGitExecutor } from "../src/git.js";

describe("checkDirty", () => {
  it("returns 'dirty' when porcelain output is non-empty", async () => {
    const mock = new MockGitExecutor();
    mock.setResponse(
      "status --porcelain=v2 --no-renames",
      "1 .M N... 100644 100644 100644 abc def README.md\n"
    );
    const result = await checkDirty("/repo", mock);
    expect(result).toBe("dirty");
  });

  it("returns 'clean' when porcelain output is empty", async () => {
    const mock = new MockGitExecutor();
    mock.setResponse("status --porcelain=v2 --no-renames", "");
    const result = await checkDirty("/repo", mock);
    expect(result).toBe("clean");
  });

  it("returns 'unknown' when git throws", async () => {
    const mock = new MockGitExecutor();
    const result = await checkDirty("/nonexistent", mock);
    expect(result).toBe("unknown");
  });

  it("records the cwd in the git call", async () => {
    const mock = new MockGitExecutor();
    mock.setResponse("status --porcelain=v2 --no-renames", "");
    await checkDirty("/my/worktree", mock);
    expect(mock.calls[0].cwd).toBe("/my/worktree");
  });
});

describe("fetchAheadCount", () => {
  it("returns count of unpushed commits", async () => {
    const mock = new MockGitExecutor();
    mock.setResponse(
      "log @{u}..HEAD --oneline",
      "aabbcc fix something\n112233 add feature\n"
    );
    const count = await fetchAheadCount("/repo", mock);
    expect(count).toBe(2);
  });

  it("returns 0 when no unpushed commits", async () => {
    const mock = new MockGitExecutor();
    mock.setResponse("log @{u}..HEAD --oneline", "");
    const count = await fetchAheadCount("/repo", mock);
    expect(count).toBe(0);
  });

  it("returns null when git throws (e.g. no upstream)", async () => {
    const mock = new MockGitExecutor();
    const count = await fetchAheadCount("/repo", mock);
    expect(count).toBeNull();
  });
});
