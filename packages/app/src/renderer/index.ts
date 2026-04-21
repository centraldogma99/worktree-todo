type DirtyBadge = "clean" | "dirty" | "unknown";

interface Worktree {
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

interface RepoWorktrees {
  repoId: string;
  repoName: string;
  repoPath: string;
  worktrees: Worktree[];
  error?: string;
}

interface RegisteredRepo {
  id: string;
  rootPath: string;
  displayName: string;
  addedAt: string;
}

interface WorktreeApi {
  refresh(): Promise<RepoWorktrees[]>;
  remove(path: string, force?: boolean): Promise<{ ok: boolean; error?: string }>;
  open(path: string): Promise<{ ok: boolean; error?: string }>;
  addRepo(): Promise<{ ok: boolean; repo?: RegisteredRepo; error?: string }>;
  removeRepo(id: string): Promise<{ ok: boolean }>;
  listRepos(): Promise<RegisteredRepo[]>;
  onDirtyUpdate(
    handler: (payload: { path: string; badge: DirtyBadge }) => void
  ): () => void;
  hideWindow(): void;
  setMutating(flag: boolean): void;
}

declare global {
  interface Window {
    api: WorktreeApi;
  }
}

interface FlatRow {
  repoId: string;
  worktree: Worktree;
  isFirstInRepo: boolean;
}

const COLLAPSED_STORAGE_KEY = "worktree-todo:collapsed-repos";

const TRASH_ICON_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`;

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function saveCollapsed(set: Set<string>): void {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* noop — local storage unavailable */
  }
}

const state = {
  repos: [] as RepoWorktrees[],
  flat: [] as FlatRow[],
  filtered: [] as FlatRow[],
  focusIndex: 0,
  dirty: new Map<string, DirtyBadge>(),
  collapsed: loadCollapsed(),
};

function matches(row: FlatRow, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const w = row.worktree;
  return (
    w.path.toLowerCase().includes(q) ||
    (w.branch?.toLowerCase().includes(q) ?? false) ||
    w.head.toLowerCase().includes(q)
  );
}

function flatten(repos: RepoWorktrees[]): FlatRow[] {
  const out: FlatRow[] = [];
  for (const r of repos) {
    r.worktrees.forEach((w, i) => {
      out.push({ repoId: r.repoId, worktree: w, isFirstInRepo: i === 0 });
    });
  }
  return out;
}

function branchLabel(w: Worktree): string {
  if (w.branch) return w.branch;
  if (w.detached) return `(detached ${w.head.slice(0, 7)})`;
  if (w.bare) return "(bare)";
  return w.head.slice(0, 7);
}

function renderEmpty(content: HTMLElement): void {
  content.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "empty";
  const h = document.createElement("h2");
  h.textContent = "No repositories registered";
  const p = document.createElement("p");
  p.textContent = "Add a git repository to list its worktrees.";
  const cta = document.createElement("button");
  cta.type = "button";
  cta.className = "empty__cta";
  cta.id = "empty-add-repo";
  cta.textContent = "Add Repository…";
  empty.append(h, p, cta);
  content.append(empty);
}

function render(content: HTMLElement, query: string): void {
  content.innerHTML = "";
  state.filtered = state.flat.filter((r) => matches(r, query));

  if (state.repos.length === 0) {
    renderEmpty(content);
    return;
  }

  let globalIndex = 0;
  for (const repo of state.repos) {
    const repoRows = state.filtered.filter((r) => r.repoId === repo.repoId);
    if (query && repoRows.length === 0) continue;

    const section = document.createElement("section");
    section.className = "repo";
    section.dataset.repoId = repo.repoId;

    // Collapse is ignored while the user is actively searching so they can
    // still see matches in all repos without manually expanding each one.
    const userCollapsed = state.collapsed.has(repo.repoId);
    const isCollapsed = userCollapsed && !query;
    if (isCollapsed) section.classList.add("is-collapsed");

    const header = document.createElement("div");
    header.className = "repo__header";

    // Entire toggle button wraps chevron + title + count so clicks anywhere
    // on the repo name area collapse/expand the section.
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "repo__toggle";
    toggle.dataset.repoId = repo.repoId;
    toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    toggle.setAttribute(
      "aria-label",
      isCollapsed ? `Expand ${repo.repoName}` : `Collapse ${repo.repoName}`
    );
    toggle.title = isCollapsed ? "Expand" : "Collapse";

    const chevron = document.createElement("span");
    chevron.className = "repo__chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = isCollapsed ? "▸" : "▾";

    const title = document.createElement("span");
    title.className = "repo__title";
    title.textContent = repo.repoName;

    const count = document.createElement("span");
    count.className = "repo__count";
    count.textContent = `(${repo.worktrees.length})`;

    toggle.append(chevron, title, count);

    const removeRepoBtn = document.createElement("button");
    removeRepoBtn.type = "button";
    removeRepoBtn.className = "repo__remove";
    removeRepoBtn.dataset.repoId = repo.repoId;
    removeRepoBtn.setAttribute("aria-label", `Remove repository ${repo.repoName}`);
    removeRepoBtn.title = "Remove repository from list";
    removeRepoBtn.innerHTML = TRASH_ICON_SVG;

    header.append(toggle, removeRepoBtn);
    section.append(header);

    if (isCollapsed) {
      content.append(section);
      continue;
    }

    if (repo.error) {
      const err = document.createElement("p");
      err.className = "repo__error";
      err.textContent = repo.error;
      section.append(err);
    }

    const ul = document.createElement("ul");
    ul.className = "repo__list";
    ul.setAttribute("role", "listbox");

    for (const row of repoRows) {
      const w = row.worktree;
      const li = document.createElement("li");
      li.className = "row";
      li.tabIndex = 0;
      li.dataset.index = String(globalIndex++);
      li.dataset.path = w.path;
      li.dataset.isMain = row.isFirstInRepo ? "1" : "0";

      if (row.isFirstInRepo) li.classList.add("is-main");
      if (w.prunable) li.classList.add("is-prunable");
      if (w.locked) li.classList.add("is-locked");
      const badge = state.dirty.get(w.path);
      if (badge === "dirty") li.classList.add("is-dirty");

      const main = document.createElement("div");
      main.className = "row__main";

      const branch = document.createElement("span");
      branch.className = "row__branch";
      branch.textContent = branchLabel(w);

      const badges = document.createElement("span");
      badges.className = "row__badges";
      if (row.isFirstInRepo) badges.append(makePill("main", "pill--main"));
      if (w.prunable) badges.append(makePill("prunable", "pill--prunable"));
      if (w.locked) badges.append(makePill("locked", "pill--locked"));
      badges.append(makeDirtyPill(badge));

      main.append(branch, badges);

      const pathEl = document.createElement("span");
      pathEl.className = "row__path";
      pathEl.textContent = w.path;

      const actions = document.createElement("div");
      actions.className = "row__actions";

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "row__action row__action--open";
      openBtn.dataset.action = "open";
      openBtn.setAttribute("aria-label", `Open ${w.path} in terminal`);
      openBtn.title = "Open in terminal (Enter)";
      openBtn.textContent = "↗";

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "row__action row__action--copy";
      copyBtn.dataset.action = "copy";
      copyBtn.setAttribute("aria-label", `Copy path ${w.path}`);
      copyBtn.title = "Copy path (⌘C)";
      copyBtn.textContent = "⧉";

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "row__action row__action--remove";
      removeBtn.dataset.action = "remove";
      removeBtn.setAttribute("aria-label", `Remove worktree ${w.path}`);
      removeBtn.title = "Remove worktree (Backspace)";
      removeBtn.textContent = "×";
      if (row.isFirstInRepo) removeBtn.disabled = true;

      actions.append(openBtn, copyBtn, removeBtn);
      li.append(main, pathEl, actions);
      ul.append(li);
    }

    section.append(ul);
    content.append(section);
  }

  if (state.filtered.length === 0 && query) {
    const no = document.createElement("p");
    no.className = "no-results";
    no.textContent = "No worktrees match the filter.";
    content.append(no);
  }
}

function makePill(text: string, cls: string): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = `pill ${cls}`;
  s.textContent = text;
  return s;
}

function makeDirtyPill(badge: DirtyBadge | undefined): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = "pill pill--dirty";
  if (badge === "dirty") {
    s.classList.add("pill--dirty-active");
    s.textContent = "dirty";
  } else {
    s.textContent = "";
  }
  return s;
}

function rowElements(content: HTMLElement): HTMLLIElement[] {
  return Array.from(content.querySelectorAll<HTMLLIElement>("li.row"));
}

function focusRowAt(content: HTMLElement, index: number): void {
  const items = rowElements(content);
  if (items.length === 0) return;
  const clamped = Math.max(0, Math.min(index, items.length - 1));
  state.focusIndex = clamped;
  items[clamped].focus();
}

function showToast(msg: string, opts?: { sticky?: boolean }): void {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  window.clearTimeout((toast as HTMLElement & { _t?: number })._t);
  if (!opts?.sticky) {
    (toast as HTMLElement & { _t?: number })._t = window.setTimeout(() => {
      toast.hidden = true;
    }, 1800);
  }
}

function dismissToast(): void {
  const toast = document.getElementById("toast");
  if (!toast) return;
  window.clearTimeout((toast as HTMLElement & { _t?: number })._t);
  toast.hidden = true;
}

function setRowPending(path: string, pending: boolean): void {
  const li = document.querySelector<HTMLLIElement>(
    `li[data-path="${CSS.escape(path)}"]`
  );
  if (!li) return;
  li.classList.toggle("is-pending", pending);
  if (pending) li.setAttribute("aria-busy", "true");
  else li.removeAttribute("aria-busy");
}

interface ModalButton {
  label: string;
  variant?: "primary" | "danger" | "cancel";
  value: string;
}

function openModal(
  title: string,
  body: string,
  buttons: ModalButton[]
): Promise<string> {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal") as HTMLElement;
    const titleEl = document.getElementById("modal-title") as HTMLElement;
    const bodyEl = document.getElementById("modal-body") as HTMLElement;
    const actionsEl = document.getElementById("modal-actions") as HTMLElement;

    titleEl.textContent = title;
    bodyEl.textContent = body;
    actionsEl.innerHTML = "";

    const lastFocus = document.activeElement as HTMLElement | null;

    const close = (value: string) => {
      modal.hidden = true;
      modal.removeEventListener("keydown", onKey);
      for (const el of modal.querySelectorAll("[data-modal-dismiss]")) {
        el.removeEventListener("click", onDismiss);
      }
      lastFocus?.focus?.();
      resolve(value);
    };

    const onDismiss = () => close("cancel");

    const onKey = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === "Escape") {
        ke.preventDefault();
        close("cancel");
      } else if (ke.key === "Enter") {
        const primary = actionsEl.querySelector<HTMLButtonElement>(
          "button[data-variant='primary'],button[data-variant='danger']"
        );
        primary?.click();
      }
    };

    buttons.forEach((b, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `modal__btn modal__btn--${b.variant ?? "cancel"}`;
      btn.dataset.variant = b.variant ?? "cancel";
      btn.textContent = b.label;
      btn.addEventListener("click", () => close(b.value));
      actionsEl.append(btn);
      if (i === buttons.length - 1) {
        queueMicrotask(() => btn.focus());
      }
    });

    for (const el of modal.querySelectorAll("[data-modal-dismiss]")) {
      el.addEventListener("click", onDismiss);
    }
    modal.addEventListener("keydown", onKey);
    modal.hidden = false;
  });
}

async function handleRemove(path: string): Promise<void> {
  const confirm = await openModal(
    "Remove worktree?",
    `This will run \`git worktree remove\` on:\n${path}`,
    [
      { label: "Cancel", variant: "cancel", value: "cancel" },
      { label: "Remove", variant: "danger", value: "ok" },
    ]
  );
  if (confirm !== "ok") return;

  setRowPending(path, true);
  showToast("Removing…", { sticky: true });
  window.api.setMutating(true);
  try {
    const result = await window.api.remove(path, false);
    if (result.ok) {
      await reload();
      dismissToast();
      showToast("Worktree removed");
      return;
    }
    if (result.error === "DIRTY") {
      dismissToast();
      setRowPending(path, false);
      const force = await openModal(
        "Worktree has uncommitted changes",
        `Force remove will discard local changes in:\n${path}`,
        [
          { label: "Cancel", variant: "cancel", value: "cancel" },
          { label: "Force Remove", variant: "danger", value: "force" },
        ]
      );
      if (force !== "force") return;
      setRowPending(path, true);
      showToast("Force removing…", { sticky: true });
      const forced = await window.api.remove(path, true);
      if (forced.ok) {
        await reload();
        dismissToast();
        showToast("Worktree force-removed");
      } else {
        setRowPending(path, false);
        dismissToast();
        showToast(`Remove failed: ${forced.error ?? "unknown"}`);
      }
      return;
    }
    setRowPending(path, false);
    dismissToast();
    showToast(`Remove failed: ${result.error ?? "unknown"}`);
  } catch (err) {
    setRowPending(path, false);
    dismissToast();
    showToast(`Remove failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    window.api.setMutating(false);
  }
}

async function handleCopy(path: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(path);
    showToast("Path copied");
  } catch {
    showToast("Copy failed");
  }
}

async function reload(): Promise<void> {
  const content = document.getElementById("content") as HTMLElement;
  const filter = document.getElementById("filter") as HTMLInputElement;

  const start = performance.now();
  const repos = await window.api.refresh();
  state.repos = repos;
  state.flat = flatten(repos);
  state.dirty.clear();
  render(content, filter.value);
  const elapsed = performance.now() - start;
  const count = state.flat.length;
  if (elapsed > 100) {
    console.error(
      `AC-1b breach: first paint ${elapsed.toFixed(1)}ms for ${count} worktrees (SLA <100ms)`
    );
  } else {
    console.info(`first paint ${elapsed.toFixed(1)}ms (${count} worktrees)`);
  }
}

async function main(): Promise<void> {
  const filter = document.getElementById("filter") as HTMLInputElement;
  const content = document.getElementById("content") as HTMLElement;
  const addRepoBtn = document.getElementById("add-repo") as HTMLButtonElement;

  await reload();

  window.api.onDirtyUpdate(({ path, badge }) => {
    state.dirty.set(path, badge);
    const li = content.querySelector<HTMLLIElement>(
      `li.row[data-path="${CSS.escape(path)}"]`
    );
    if (!li) return;
    li.classList.toggle("is-dirty", badge === "dirty");
    const pill = li.querySelector<HTMLSpanElement>(".pill--dirty");
    if (pill) {
      pill.classList.toggle("pill--dirty-active", badge === "dirty");
      pill.textContent = badge === "dirty" ? "dirty" : "";
    }
  });

  filter.addEventListener("input", () => {
    render(content, filter.value);
    state.focusIndex = 0;
  });

  filter.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      focusRowAt(content, 0);
    }
  });

  addRepoBtn.addEventListener("click", async () => {
    const res = await window.api.addRepo();
    if (res.ok) await reload();
  });

  content.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;

    const actionBtn = target.closest<HTMLButtonElement>(
      "button.row__action"
    );
    if (actionBtn) {
      e.stopPropagation();
      const li = actionBtn.closest<HTMLLIElement>("li.row");
      if (!li) return;
      const path = li.dataset.path ?? "";
      const action = actionBtn.dataset.action;
      if (action === "open") void window.api.open(path);
      else if (action === "copy") void handleCopy(path);
      else if (action === "remove") void handleRemove(path);
      return;
    }

    const toggleBtn = target.closest<HTMLButtonElement>("button.repo__toggle");
    if (toggleBtn) {
      e.stopPropagation();
      const repoId = toggleBtn.dataset.repoId ?? "";
      if (state.collapsed.has(repoId)) {
        state.collapsed.delete(repoId);
      } else {
        state.collapsed.add(repoId);
      }
      saveCollapsed(state.collapsed);
      const filter = document.getElementById("filter") as HTMLInputElement;
      render(content, filter.value);
      return;
    }

    const repoRemove = target.closest<HTMLButtonElement>("button.repo__remove");
    if (repoRemove) {
      const repoId = repoRemove.dataset.repoId ?? "";
      const repo = state.repos.find((r) => r.repoId === repoId);
      const confirm = await openModal(
        "Remove repository?",
        `Stop tracking ${repo?.repoName ?? repoId}? Worktrees on disk are not deleted.`,
        [
          { label: "Cancel", variant: "cancel", value: "cancel" },
          { label: "Remove", variant: "danger", value: "ok" },
        ]
      );
      if (confirm === "ok") {
        await window.api.removeRepo(repoId);
        if (state.collapsed.delete(repoId)) saveCollapsed(state.collapsed);
        await reload();
      }
      return;
    }

    const emptyCta = target.closest<HTMLButtonElement>("#empty-add-repo");
    if (emptyCta) {
      const res = await window.api.addRepo();
      if (res.ok) await reload();
      return;
    }

    const li = target.closest<HTMLLIElement>("li.row");
    if (li) li.focus();
  });

  content.addEventListener("dblclick", (e) => {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>("li.row");
    if (!li) return;
    const path = li.dataset.path ?? "";
    if (path) void window.api.open(path);
  });

  content.addEventListener("keydown", (e) => {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>("li.row");
    if (!li) return;
    const items = rowElements(content);
    const idx = items.indexOf(li);
    const path = li.dataset.path ?? "";
    const isMain = li.dataset.isMain === "1";

    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      focusRowAt(content, idx + 1);
    } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      if (idx === 0) {
        const filterEl = document.getElementById("filter") as HTMLInputElement;
        filterEl.focus();
      } else {
        focusRowAt(content, idx - 1);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (path) void window.api.open(path);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      if (isMain) {
        showToast("Cannot remove main worktree");
        return;
      }
      if (path) void handleRemove(path);
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
      if (path) {
        e.preventDefault();
        void handleCopy(path);
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("modal") as HTMLElement;
      if (!modal.hidden) return;
      e.preventDefault();
      window.api.hideWindow();
    }
  });
}

void main();

export {};
