import { createDir, createFile, deletePath, readTextFile, writeTextFile } from "./api";
import { basename, extname } from "./paths";

export type TabKind = "markdown" | "image";

export interface Tab {
  id: number;
  path: string;
  title: string;
  kind: TabKind;
  editing: boolean;
  content: string;
  savedContent: string;
}

export interface Pane {
  id: number;
  tabs: Tab[];
  activeTabId: number | null;
  size: number;
  wrap: boolean;
}

const MD_EXT = new Set(["md", "markdown", "mdown", "txt"]);
const IMG_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);

let nextTabId = 1;
let nextPaneId = 1;

export const app = $state({
  root: null as string | null,
  panes: [{ id: 0, tabs: [], activeTabId: null, size: 1, wrap: true }] as Pane[],
  activePaneId: 0,
  treeVersion: 0,
  sidebarVisible: true,
  sidebarWidth: 240,
});

export function fileKind(path: string): TabKind | null {
  const e = extname(path).toLowerCase();
  if (MD_EXT.has(e)) return "markdown";
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
  if (kind === "markdown") {
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
  };
  pane.tabs.push(tab);
  pane.activeTabId = tab.id;
}

export function closeTab(pane: Pane, tabId: number) {
  const i = pane.tabs.findIndex((t) => t.id === tabId);
  if (i < 0) return;
  pane.tabs.splice(i, 1);
  if (pane.activeTabId === tabId) {
    pane.activeTabId = pane.tabs[Math.min(i, pane.tabs.length - 1)]?.id ?? null;
  }
}

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
  if (active) {
    const copy: Tab = { ...active, id: nextTabId++, editing: false };
    newPane.tabs.push(copy);
    newPane.activeTabId = copy.id;
  }
  app.panes.splice(idx + 1, 0, newPane);
  app.activePaneId = newPane.id;
}

export function closePane(paneId: number) {
  if (app.panes.length <= 1) return;
  const i = app.panes.findIndex((p) => p.id === paneId);
  if (i < 0) return;
  app.panes.splice(i, 1);
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
  if (tab?.kind === "markdown") tab.editing = true;
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
