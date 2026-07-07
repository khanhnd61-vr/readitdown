<script lang="ts">
  import TreeNode from "./TreeNode.svelte";
  import { listDir } from "../lib/api";
  import { dirname } from "../lib/paths";
  import { toNode, type Node } from "../lib/tree";
  import { fileKind, openFile } from "../lib/state.svelte";

  let {
    node,
    depth = 0,
    oncontext,
    onmove,
  }: {
    node: Node;
    depth?: number;
    oncontext: (e: MouseEvent, node: Node) => void;
    onmove: (src: string, destDir: string) => void;
  } = $props();

  let dragOver = $state(false);

  async function activate() {
    if (node.isDir) {
      node.expanded = !node.expanded;
      if (node.expanded && node.children === null) {
        node.children = (await listDir(node.path)).map(toNode);
      }
    } else {
      openFile(node.path);
    }
  }

  function onDragStart(e: DragEvent) {
    e.dataTransfer?.setData("text/plain", node.path);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

  // Folders take the drop inside themselves; a file takes it into its own
  // parent directory. Reordering within a directory is a no-op the backend
  // resolves harmlessly.
  function destDir(): string {
    return node.isDir ? node.path : dirname(node.path);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    dragOver = node.isDir;
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragOver = false;
    const src = e.dataTransfer?.getData("text/plain");
    if (src && src !== node.path) onmove(src, destDir());
  }
</script>

<button
  class="tree-item"
  class:dim={!node.isDir && !fileKind(node.path)}
  class:drop-target={dragOver}
  style="padding-left: {8 + depth * 14}px"
  title={node.path}
  draggable="true"
  ondragstart={onDragStart}
  ondragover={onDragOver}
  ondragleave={() => (dragOver = false)}
  ondrop={onDrop}
  onclick={activate}
  oncontextmenu={(e) => oncontext(e, node)}
>
  <span class="chevron">{node.isDir ? (node.expanded ? "▾" : "▸") : ""}</span>
  <span class="tree-name">{node.name}</span>
</button>
{#if node.expanded && node.children}
  {#each node.children as child (child.path)}
    <TreeNode node={child} depth={depth + 1} {oncontext} {onmove} />
  {/each}
{/if}
