import { basename, dirname } from "./paths";

export interface Repo {
  owner: string;
  name: string;
  branch: string;
}

export interface Entry {
  name: string;
  path: string;
  children?: Entry[];
}

export function repoKey(r: { owner: string; name: string }): string {
  return `${r.owner}/${r.name}`.toLowerCase();
}

// Accepts "owner/repo" or any github.com URL pointing at a repo.
export function parseRepoInput(input: string): { owner: string; name: string } | null {
  const s = input.trim().replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "");
  const m = s.match(/^([\w.-]+)\/([\w.-]+?)(\.git)?([/?#].*)?$/);
  return m ? { owner: m[1], name: m[2] } : null;
}

async function api(path: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`https://api.github.com${path}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
  } catch {
    throw new Error("Network error - are you online?");
  }
  if (res.status === 404) throw new Error("Repo not found (private repos are not supported)");
  if (res.status === 403 || res.status === 429)
    throw new Error("GitHub API rate limit reached, try again in a bit");
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  return res.json();
}

export async function fetchRepo(owner: string, name: string): Promise<Repo> {
  const data = await api(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
  return { owner: data.owner.login, name: data.name, branch: data.default_branch };
}

const MD = /\.(md|markdown|mdown)$/i;

const treeCache = new Map<string, { tree: Entry[]; truncated: boolean }>();

export async function fetchTree(repo: Repo): Promise<{ tree: Entry[]; truncated: boolean }> {
  const key = `${repoKey(repo)}@${repo.branch}`;
  const hit = treeCache.get(key);
  if (hit) return hit;
  const data = await api(
    `/repos/${repo.owner}/${repo.name}/git/trees/${encodeURIComponent(repo.branch)}?recursive=1`,
  );
  const paths = (data.tree as { path: string; type: string }[])
    .filter((e) => e.type === "blob" && MD.test(e.path))
    .map((e) => e.path);
  const result = { tree: buildTree(paths), truncated: !!data.truncated };
  treeCache.set(key, result);
  return result;
}

function buildTree(paths: string[]): Entry[] {
  const root: Entry[] = [];
  const dirs = new Map<string, Entry>();
  function childrenOf(dirPath: string): Entry[] {
    if (dirPath === "") return root;
    let dir = dirs.get(dirPath);
    if (!dir) {
      dir = { name: basename(dirPath), path: dirPath, children: [] };
      dirs.set(dirPath, dir);
      childrenOf(dirname(dirPath)).push(dir);
    }
    return dir.children!;
  }
  for (const p of paths) childrenOf(dirname(p)).push({ name: basename(p), path: p });
  sortEntries(root);
  return root;
}

function sortEntries(entries: Entry[]) {
  entries.sort(
    (a, b) =>
      (a.children ? 0 : 1) - (b.children ? 0 : 1) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  for (const e of entries) if (e.children) sortEntries(e.children);
}

function encodePath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

export function rawUrl(repo: Repo, path: string): string {
  return `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${encodePath(repo.branch)}/${encodePath(path)}`;
}

export function blobUrl(repo: Repo, path: string): string {
  return `https://github.com/${repo.owner}/${repo.name}/blob/${encodePath(repo.branch)}/${encodePath(path)}`;
}

// Small LRU so navigating back through the viewer stack doesn't refetch.
const fileCache = new Map<string, string>();
const FILE_CACHE_MAX = 30;

export async function fetchFile(repo: Repo, path: string): Promise<string> {
  const key = `${repoKey(repo)}@${repo.branch}:${path}`;
  const hit = fileCache.get(key);
  if (hit !== undefined) {
    fileCache.delete(key);
    fileCache.set(key, hit);
    return hit;
  }
  let res: Response;
  try {
    res = await fetch(rawUrl(repo, path));
  } catch {
    throw new Error("Network error - are you online?");
  }
  if (!res.ok)
    throw new Error(res.status === 404 ? `File not found: ${path}` : `Fetch failed (${res.status})`);
  const text = await res.text();
  fileCache.set(key, text);
  if (fileCache.size > FILE_CACHE_MAX) fileCache.delete(fileCache.keys().next().value!);
  return text;
}
