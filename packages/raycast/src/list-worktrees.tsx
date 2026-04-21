import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";
import { useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  Clipboard,
  Icon,
  List,
  closeMainWindow,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import {
  getAdapter,
  type DirtyBadge,
  type WorktreeWithDirty,
  type TerminalAdapterId,
} from "@worktree-todo/core";
import { readStoredConfig, type StoredConfig } from "./utils/config.js";
import { shortenHome } from "./utils/paths.js";
import {
  checkDirtyFor,
  loadAllWorktrees,
  type RepoWorktrees,
} from "./utils/worktrees.js";

const execFileAsync = promisify(_execFile);

const ADAPTER_LABEL: Record<TerminalAdapterId, string> = {
  "terminal-app": "Terminal",
  iterm2: "iTerm",
  ghostty: "Ghostty",
  cmux: "cmux",
};

type DirtyMap = Record<string, DirtyBadge>;

export default function ListWorktrees() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<StoredConfig | null>(null);
  const [groups, setGroups] = useState<RepoWorktrees[]>([]);
  const [dirty, setDirty] = useState<DirtyMap>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await readStoredConfig();
        if (cancelled) return;
        setConfig(cfg);
        if (!cfg || cfg.repositories.length === 0) {
          setLoading(false);
          return;
        }
        const result = await loadAllWorktrees(cfg.repositories);
        if (cancelled) return;
        setGroups(result);
        setLoading(false);

        const allPaths = result.flatMap((g) => g.worktrees.map((w) => w.path));
        await Promise.all(
          allPaths.map(async (p) => {
            const badge = await checkDirtyFor(p);
            if (cancelled) return;
            setDirty((prev) => ({ ...prev, [p]: badge }));
          }),
        );
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && loadError) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Failed to load config"
          description={loadError}
        />
      </List>
    );
  }

  if (!loading && (!config || config.repositories.length === 0)) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Info}
          title="No repositories registered"
          description="Open the Worktree Todo menubar app and add a repository first."
        />
      </List>
    );
  }

  const adapterId: TerminalAdapterId = config?.settings.terminalAdapterId ?? "cmux";

  return (
    <List isLoading={loading} searchBarPlaceholder="Search worktrees...">
      {groups.map((group) => (
        <List.Section key={group.repo.id} title={group.repo.displayName}>
          {group.error !== null ? (
            <List.Item
              icon={Icon.ExclamationMark}
              title="Failed to read worktrees"
              subtitle={group.error}
              accessories={[{ text: shortenHome(group.repo.rootPath) }]}
            />
          ) : (
            group.worktrees.map((w) => (
              <WorktreeItem
                key={w.path}
                worktree={w}
                repoName={group.repo.displayName}
                dirty={dirty[w.path] ?? "unknown"}
                adapterId={adapterId}
              />
            ))
          )}
        </List.Section>
      ))}
    </List>
  );
}

function WorktreeItem({
  worktree,
  repoName,
  dirty,
  adapterId,
}: {
  worktree: WorktreeWithDirty;
  repoName: string;
  dirty: DirtyBadge;
  adapterId: TerminalAdapterId;
}) {
  const title = worktree.detached
    ? `(detached ${worktree.head.slice(0, 7)})`
    : worktree.branch ?? worktree.head.slice(0, 7);
  const accessories: List.Item.Accessory[] = [];
  if (dirty === "dirty") {
    accessories.push({ icon: { source: Icon.Dot, tintColor: "#ff5555" }, tooltip: "Dirty" });
  }
  if (worktree.locked) {
    accessories.push({ icon: Icon.Lock, tooltip: worktree.lockedReason ?? "Locked" });
  }
  if (worktree.prunable) {
    accessories.push({
      icon: Icon.Warning,
      tooltip: worktree.prunableReason ?? "Prunable",
    });
  }

  return (
    <List.Item
      icon={Icon.Folder}
      title={title}
      subtitle={shortenHome(worktree.path)}
      keywords={[worktree.path, repoName, worktree.branch ?? "", worktree.head]}
      accessories={accessories}
      actions={
        <ActionPanel>
          <Action
            title={`Open in ${ADAPTER_LABEL[adapterId]}`}
            icon={Icon.Terminal}
            onAction={() => openInTerminal(worktree.path, adapterId)}
          />
          <Action
            title="Copy Path"
            icon={Icon.Clipboard}
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            onAction={async () => {
              await Clipboard.copy(worktree.path);
              await showHUD("Copied path");
            }}
          />
          <Action
            title="Show in Finder"
            icon={Icon.Finder}
            shortcut={{ modifiers: ["cmd"], key: "o" }}
            onAction={() => showInFinder(worktree.path)}
          />
          <Action
            title="Remove via Menubar App"
            icon={Icon.Info}
            onAction={() =>
              showToast({
                style: Toast.Style.Success,
                title: "Remove from the menubar app",
                message: "Worktree removal lives in the Worktree Todo menubar app.",
              })
            }
          />
        </ActionPanel>
      }
    />
  );
}

async function openInTerminal(path: string, adapterId: TerminalAdapterId) {
  try {
    const adapter = getAdapter(adapterId);
    await adapter.open(path);
    await showHUD(`Opened in ${ADAPTER_LABEL[adapterId]}`);
    await closeMainWindow();
  } catch (err) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to open terminal",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function showInFinder(path: string) {
  try {
    await execFileAsync("open", ["-R", path]);
    await closeMainWindow();
  } catch (err) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to reveal in Finder",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
