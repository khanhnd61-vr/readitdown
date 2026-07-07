import { loadPrefs, savePrefs } from "./api";

const MAX_RECENTS = 8;

export const DEFAULT_FONT_SIZE = 13;
export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 48;

export const prefs = $state({
  favorites: [] as string[],
  recents: [] as string[],
  editorFontSize: DEFAULT_FONT_SIZE,
});

export async function initPrefs() {
  try {
    const p = await loadPrefs();
    prefs.favorites = p.favorites;
    prefs.recents = p.recents;
    if (typeof p.editorFontSize === "number" && p.editorFontSize > 0) {
      prefs.editorFontSize = clampFontSize(p.editorFontSize);
    }
  } catch (e) {
    console.error("load prefs failed:", e);
  }
}

function clampFontSize(px: number): number {
  return Math.round(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, px)));
}

// Ctrl+Wheel zoom and any other caller nudges the shared editor font size; all
// open editors react to the change and it's persisted for next launch.
export function setEditorFontSize(px: number) {
  const next = clampFontSize(px);
  if (next === prefs.editorFontSize) return;
  prefs.editorFontSize = next;
  persist();
}

export function resetEditorFontSize() {
  setEditorFontSize(DEFAULT_FONT_SIZE);
}

function persist() {
  savePrefs($state.snapshot(prefs)).catch((e) => console.error("save prefs failed:", e));
}

export function isFavorite(path: string): boolean {
  return prefs.favorites.includes(path);
}

export function toggleFavorite(path: string) {
  const i = prefs.favorites.indexOf(path);
  if (i >= 0) prefs.favorites.splice(i, 1);
  else prefs.favorites.push(path);
  persist();
}

export function addRecent(path: string) {
  const i = prefs.recents.indexOf(path);
  if (i >= 0) prefs.recents.splice(i, 1);
  prefs.recents.unshift(path);
  if (prefs.recents.length > MAX_RECENTS) prefs.recents.length = MAX_RECENTS;
  persist();
}
