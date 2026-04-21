import { describe, it, expect } from "vitest";
import {
  terminalAppAdapter,
  iterm2Adapter,
  ghosttyAdapter,
  cmuxAdapter,
  getAdapter,
} from "../src/terminal.js";

describe("terminalAppAdapter.buildArgs", () => {
  it("builds correct args for simple path", () => {
    const { cmd, args } = terminalAppAdapter.buildArgs("/home/user/project");
    expect(cmd).toBe("open");
    expect(args).toEqual(["-na", "-b", "com.apple.Terminal", "/home/user/project"]);
  });

  it("includes path with spaces", () => {
    const { args } = terminalAppAdapter.buildArgs("/home/user/my project");
    expect(args[3]).toBe("/home/user/my project");
  });
});

describe("iterm2Adapter.buildArgs", () => {
  it("builds correct args for simple path", () => {
    const { cmd, args } = iterm2Adapter.buildArgs("/home/user/project");
    expect(cmd).toBe("open");
    expect(args).toEqual(["-na", "-b", "com.googlecode.iterm2", "/home/user/project"]);
  });

  it("includes path with spaces", () => {
    const { args } = iterm2Adapter.buildArgs("/Users/dev/my cool project");
    expect(args[3]).toBe("/Users/dev/my cool project");
  });
});

describe("ghosttyAdapter.buildArgs", () => {
  it("builds correct primary args", () => {
    const { cmd, args } = ghosttyAdapter.buildArgs("/home/user/project");
    expect(cmd).toBe("open");
    expect(args).toEqual(["-a", "Ghostty", "/home/user/project"]);
  });
});

describe("cmuxAdapter.buildArgs", () => {
  it("uses cmux new-workspace --cwd as canonical create form", () => {
    const { cmd, args } = cmuxAdapter.buildArgs("/home/user/project");
    expect(cmd).toBe("cmux");
    expect(args).toEqual(["new-workspace", "--cwd", "/home/user/project"]);
  });

  it("passes path as-is (execFile argv, no shell escaping needed)", () => {
    const { args } = cmuxAdapter.buildArgs("/home/user/my's project");
    expect(args).toEqual(["new-workspace", "--cwd", "/home/user/my's project"]);
  });
});

describe("getAdapter", () => {
  it("returns correct adapter by id", () => {
    expect(getAdapter("terminal-app").id).toBe("terminal-app");
    expect(getAdapter("iterm2").id).toBe("iterm2");
    expect(getAdapter("ghostty").id).toBe("ghostty");
    expect(getAdapter("cmux").id).toBe("cmux");
  });

  it("throws for unknown id", () => {
    expect(() => getAdapter("unknown" as never)).toThrow();
  });
});
