type TerminalAdapterId = "terminal-app" | "iterm2" | "ghostty" | "cmux";

interface AppSettings {
  terminalAdapterId: TerminalAdapterId;
}

interface SettingsApi {
  getSettings(): Promise<{ settings: AppSettings; availableAdapters: TerminalAdapterId[] }>;
  setTerminal(id: TerminalAdapterId): Promise<{ ok: boolean }>;
}

const api = (window as unknown as { api: SettingsApi }).api;

const ADAPTER_LABELS: Record<TerminalAdapterId, string> = {
  "terminal-app": "Terminal.app",
  iterm2: "iTerm2",
  ghostty: "Ghostty",
  cmux: "cmux (tmux)",
};

async function main(): Promise<void> {
  const select = document.getElementById("terminal-select") as HTMLSelectElement;
  const status = document.getElementById("terminal-status") as HTMLParagraphElement;

  const { settings, availableAdapters } = await api.getSettings();

  const allIds: TerminalAdapterId[] = ["terminal-app", "iterm2", "ghostty", "cmux"];
  for (const id of allIds) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = ADAPTER_LABELS[id];
    if (!availableAdapters.includes(id)) {
      opt.textContent += " (not detected)";
      opt.disabled = true;
    }
    if (id === settings.terminalAdapterId) opt.selected = true;
    select.append(opt);
  }

  select.addEventListener("change", async () => {
    const chosen = select.value as TerminalAdapterId;
    select.disabled = true;
    status.textContent = "Saving…";
    const result = await api.setTerminal(chosen);
    select.disabled = false;
    status.textContent = result.ok ? "Saved." : "Failed to save.";
    setTimeout(() => { status.textContent = ""; }, 2000);
  });
}

void main();

export {};
