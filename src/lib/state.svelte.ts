import { createDir, createFile, deletePath, readTextFile, writeTextFile } from "./api";
import { basename, extname } from "./paths";
import { addRecent } from "./prefs.svelte";
import { createTerminal, disposeTerminal, setTermExitHandler } from "./terminals";

export type TabKind = "markdown" | "html" | "pdf" | "image" | "terminal";

export interface Tab {
  id: number;
  path: string;
  title: string;
  kind: TabKind;
  editing: boolean;
  content: string;
  savedContent: string;
  // bumped when the file changes on disk (image/pdf tabs re-render from it)
  fileVersion: number;
  termId?: number;
  editSplit?: number;
}

export interface Pane {
  id: number;
  tabs: Tab[];
  activeTabId: number | null;
  size: number;
  wrap: boolean;
}

const MD_EXT = new Set(["md", "markdown", "mdown", "txt"]);
const HTML_EXT = new Set(["html", "htm"]);
const IMG_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);

let nextTabId = 1;
let nextPaneId = 1;

// The sidebar holds up to two stacked sections (split views). Opening a second
// folder auto-splits; further folders become tabs in the active section; when a
// section's last folder tab closes, the split merges back into one section.
export interface SidebarSection {
  id: number;
  roots: string[];
  activeRoot: string;
  size: number;
}

let nextSectionId = 1;

export const app = $state({
  sections: [] as SidebarSection[],
  activeSectionId: 0,
  panes: [{ id: 0, tabs: [], activeTabId: null, size: 1, wrap: true }] as Pane[],
  activePaneId: 0,
  treeVersion: 0,
  sidebarVisible: true,
  sidebarWidth: 240,
});

export function allRoots(): string[] {
  return app.sections.flatMap((s) => s.roots);
}

export function activeSection(): SidebarSection | null {
  return app.sections.find((s) => s.id === app.activeSectionId) ?? app.sections[0] ?? null;
}

export function activeRoot(): string | null {
  return activeSection()?.activeRoot ?? null;
}

export function addRoot(path: string, sectionId?: number) {
  addRecent(path);
  const owner = app.sections.find((s) => s.roots.includes(path));
  if (owner) {
    owner.activeRoot = path;
    app.activeSectionId = owner.id;
    return;
  }
  if (app.sections.length < 2) {
    // first folder, or second folder with no split yet: new section (auto-split)
    const s: SidebarSection = { id: nextSectionId++, roots: [path], activeRoot: path, size: 1 };
    app.sections.push(s);
    app.activeSectionId = s.id;
  } else {
    // already split: further folders become tabs in the target (or active) section
    const s =
      (sectionId !== undefined ? app.sections.find((x) => x.id === sectionId) : undefined) ??
      activeSection()!;
    s.roots.push(path);
    s.activeRoot = path;
    app.activeSectionId = s.id;
  }
}

export function closeRoot(path: string) {
  const s = app.sections.find((x) => x.roots.includes(path));
  if (!s) return;
  const i = s.roots.indexOf(path);
  s.roots.splice(i, 1);
  if (s.activeRoot === path && s.roots.length > 0) {
    s.activeRoot = s.roots[Math.min(i, s.roots.length - 1)];
  }
  if (s.roots.length === 0) {
    // last tab of this view closed: merge the split back into one
    app.sections.splice(app.sections.indexOf(s), 1);
    if (app.activeSectionId === s.id && app.sections.length > 0) {
      app.activeSectionId = app.sections[0].id;
    }
    if (app.sections.length === 1) app.sections[0].size = 1;
  }
}

// Root a file belongs to (longest matching prefix), for resolving root-absolute
// links. Falls back to the active root for files outside every open folder.
export function rootFor(path: string): string {
  let best = "";
  for (const r of allRoots()) {
    if ((path === r || path.startsWith(r + "/")) && r.length > best.length) best = r;
  }
  return best || activeRoot() || "";
}

export function fileKind(path: string): TabKind | null {
  const e = extname(path).toLowerCase();
  if (MD_EXT.has(e)) return "markdown";
  if (HTML_EXT.has(e)) return "html";
  if (e === "pdf") return "pdf";
  if (IMG_EXT.has(e)) return "image";
  return null;
}

export function activePane(): Pane {
  return app.panes.find((p) => p.id === app.activePaneId) ?? app.panes[0];
}

export async function openFile(path: string, paneId?: number) {
  const kind = fileKind(path);
  if (!kind) return;
  const pane =
    paneId === undefined ? activePane() : (app.panes.find((p) => p.id === paneId) ?? activePane());
  app.activePaneId = pane.id;
  const existing = pane.tabs.find((t) => t.path === path);
  if (existing) {
    pane.activeTabId = existing.id;
    return;
  }
  let content = "";
  if (kind === "markdown" || kind === "html") {
    try {
      content = await readTextFile(path);
    } catch (e) {
      console.error("read failed:", e);
      return;
    }
  }
  const tab: Tab = {
    id: nextTabId++,
    path,
    title: basename(path),
    kind,
    editing: false,
    content,
    savedContent: content,
    fileVersion: 0,
  };
  pane.tabs.push(tab);
  pane.activeTabId = tab.id;
}

// Re-read the file from disk (another process may have changed it). Text tabs
// replace their buffer (caller confirms first if there are unsaved edits);
// image/pdf tabs re-render via fileVersion.
export async function reloadTab(tab: Tab) {
  if (tab.kind === "image" || tab.kind === "pdf") {
    tab.fileVersion++;
    return;
  }
  if (tab.kind !== "markdown" && tab.kind !== "html") return;
  try {
    const content = await readTextFile(tab.path);
    tab.content = content;
    tab.savedContent = content;
  } catch (e) {
    console.error("reload failed:", e);
  }
}

export function closeTab(pane: Pane, tabId: number) {
  const i = pane.tabs.findIndex((t) => t.id === tabId);
  if (i < 0) return;
  const [closed] = pane.tabs.splice(i, 1);
  if (closed.termId !== undefined) disposeTerminal(closed.termId);
  if (pane.activeTabId === tabId) {
    pane.activeTabId = pane.tabs[Math.min(i, pane.tabs.length - 1)]?.id ?? null;
  }
}

let nextTermNumber = 1;

export async function openTerminal(paneId?: number) {
  const pane =
    paneId === undefined ? activePane() : (app.panes.find((p) => p.id === paneId) ?? activePane());
  app.activePaneId = pane.id;
  let termId: number;
  try {
    termId = await createTerminal(activeRoot());
  } catch (e) {
    console.error("terminal failed:", e);
    return;
  }
  const tab: Tab = {
    id: nextTabId++,
    path: "",
    title: `Terminal ${nextTermNumber++}`,
    kind: "terminal",
    editing: false,
    content: "",
    savedContent: "",
    fileVersion: 0,
    termId,
  };
  pane.tabs.push(tab);
  pane.activeTabId = tab.id;
}

// the shell exited (e.g. the user typed `exit`) -> close its tab
setTermExitHandler((termId) => {
  for (const pane of app.panes) {
    const tab = pane.tabs.find((t) => t.termId === termId);
    if (tab) {
      closeTab(pane, tab.id);
      return;
    }
  }
});

export function splitPane() {
  const pane = activePane();
  const idx = app.panes.indexOf(pane);
  const newPane: Pane = {
    id: nextPaneId++,
    tabs: [],
    activeTabId: null,
    size: pane.size,
    wrap: pane.wrap,
  };
  const active = pane.tabs.find((t) => t.id === pane.activeTabId);
  if (active && active.kind !== "terminal") {
    const copy: Tab = { ...active, id: nextTabId++, editing: false };
    newPane.tabs.push(copy);
    newPane.activeTabId = copy.id;
  }
  app.panes.splice(idx + 1, 0, newPane);
  app.activePaneId = newPane.id;
  // splitting a terminal starts a fresh shell in the new pane, like VS Code
  if (active?.kind === "terminal") openTerminal(newPane.id);
}

export function closePane(paneId: number) {
  if (app.panes.length <= 1) return;
  const i = app.panes.findIndex((p) => p.id === paneId);
  if (i < 0) return;
  const [closed] = app.panes.splice(i, 1);
  for (const t of closed.tabs) {
    if (t.termId !== undefined) disposeTerminal(t.termId);
  }
  if (app.activePaneId === paneId) app.activePaneId = app.panes[Math.max(0, i - 1)].id;
}

export async function saveTab(tab: Tab) {
  try {
    await writeTextFile(tab.path, tab.content);
    tab.savedContent = tab.content;
  } catch (e) {
    console.error("save failed:", e);
  }
}

export async function createNewFile(dir: string, relPath: string) {
  const path = await createFile(dir, relPath);
  app.treeVersion++;
  await openFile(path);
  const pane = activePane();
  const tab = pane.tabs.find((t) => t.id === pane.activeTabId);
  if (tab?.kind === "markdown" || tab?.kind === "html") tab.editing = true;
}

export async function createNewFolder(dir: string, relPath: string) {
  await createDir(dir, relPath);
  app.treeVersion++;
}

export async function deleteEntry(path: string, isDir: boolean) {
  await deletePath(path);
  for (const pane of app.panes) {
    const doomed = pane.tabs.filter(
      (t) => t.path === path || (isDir && t.path.startsWith(path + "/")),
    );
    for (const t of doomed) closeTab(pane, t.id);
  }
  app.treeVersion++;
}
