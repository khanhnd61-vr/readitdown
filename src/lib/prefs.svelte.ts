import { loadPrefs, savePrefs } from "./api";

const MAX_RECENTS = 8;

export const prefs = $state({
  favorites: [] as string[],
  recents: [] as string[],
});

export async function initPrefs() {
  try {
    const p = await loadPrefs();
    prefs.favorites = p.favorites;
    prefs.recents = p.recents;
  } catch (e) {
    console.error("load prefs failed:", e);
  }
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
