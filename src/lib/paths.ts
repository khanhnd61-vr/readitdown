// The whole app works in forward-slash paths. The Rust backend already normalizes
// what it returns; this handles paths that arrive straight from OS plugins (the
// folder-open dialog), which use `\` on Windows.
export function toUiPath(p: string): string {
  return p.replace(/\\/g, "/");
}

// Leading Windows drive letter, e.g. "C:" in "C:/Users/me".
const DRIVE = /^[A-Za-z]:/;

export function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i <= 0 ? "/" : p.slice(0, i);
}

export function basename(p: string): string {
  return p.slice(p.lastIndexOf("/") + 1);
}

export function extname(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf(".");
  return i < 0 ? "" : b.slice(i + 1);
}

export function normalize(p: string): string {
  // Preserve a Windows drive prefix ("C:") so it isn't collapsed to a leading "/".
  const drive = p.match(DRIVE)?.[0] ?? "";
  const out: string[] = [];
  for (const part of p.slice(drive.length).split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return drive + "/" + out.join("/");
}

export function resolvePath(baseDir: string, rel: string): string {
  return normalize(baseDir + "/" + rel);
}
