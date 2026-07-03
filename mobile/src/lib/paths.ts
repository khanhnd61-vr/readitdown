// Repo paths are forward-slash paths relative to the repo root, no leading
// slash ("docs/guide/intro.md"). "" is the root itself.

export function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}

export function basename(p: string): string {
  return p.slice(p.lastIndexOf("/") + 1);
}

export function normalize(p: string): string {
  const out: string[] = [];
  for (const part of p.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

export function resolvePath(baseDir: string, rel: string): string {
  return normalize(baseDir + "/" + rel);
}
