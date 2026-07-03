import { Preferences } from "@capacitor/preferences";
import { repoKey, type Repo } from "./github";

export type Screen =
  | { kind: "home" }
  | { kind: "repo"; repo: Repo }
  | { kind: "viewer"; repo: Repo; path: string };

export const app = $state({
  stack: [{ kind: "home" }] as Screen[],
  favorites: [] as Repo[],
  recents: [] as Repo[],
});

export function push(screen: Screen) {
  app.stack.push(screen);
}

// Returns false when already at the home screen.
export function pop(): boolean {
  if (app.stack.length <= 1) return false;
  app.stack.pop();
  return true;
}

export function openRepo(repo: Repo) {
  addRecent(repo);
  push({ kind: "repo", repo });
}

export function isFavorite(repo: Repo): boolean {
  return app.favorites.some((f) => repoKey(f) === repoKey(repo));
}

export function toggleFavorite(repo: Repo) {
  const i = app.favorites.findIndex((f) => repoKey(f) === repoKey(repo));
  if (i >= 0) app.favorites.splice(i, 1);
  else app.favorites.unshift({ ...repo });
  save("favorites", app.favorites);
}

const MAX_RECENTS = 8;

function addRecent(repo: Repo) {
  const i = app.recents.findIndex((r) => repoKey(r) === repoKey(repo));
  if (i >= 0) app.recents.splice(i, 1);
  app.recents.unshift({ ...repo });
  if (app.recents.length > MAX_RECENTS) app.recents.length = MAX_RECENTS;
  save("recents", app.recents);
}

function save(key: string, value: Repo[]) {
  Preferences.set({ key, value: JSON.stringify(value) }).catch(console.error);
}

export async function loadSaved() {
  for (const key of ["favorites", "recents"] as const) {
    try {
      const { value } = await Preferences.get({ key });
      if (value) app[key] = JSON.parse(value);
    } catch (e) {
      console.error("load failed:", e);
    }
  }
}
