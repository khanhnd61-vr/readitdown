import { listDir, type Entry } from "./api";

export interface Node {
  name: string;
  path: string;
  isDir: boolean;
  expanded: boolean;
  children: Node[] | null;
}

export function toNode(e: Entry): Node {
  return { name: e.name, path: e.path, isDir: e.isDir, expanded: false, children: null };
}

// Re-lists a directory, preserving expansion state of nodes that still exist.
export async function loadChildren(path: string, old: Node[] | null): Promise<Node[]> {
  const entries = await listDir(path);
  return Promise.all(
    entries.map(async (e) => {
      const node = toNode(e);
      const prev = old?.find((n) => n.path === e.path);
      if (prev && e.isDir) {
        node.expanded = prev.expanded;
        if (prev.expanded) node.children = await loadChildren(e.path, prev.children);
      }
      return node;
    }),
  );
}
