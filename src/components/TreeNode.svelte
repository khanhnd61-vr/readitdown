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
    onrename,
    renamingPath,
    onrenamesubmit,
    onrenamecancel,
  }: {
    node: Node;
    depth?: number;
    oncontext: (e: MouseEvent, node: Node) => void;
    onmove: (src: string, destDir: string) => void;
    onrename: (node: Node) => void;
    renamingPath: string | null;
    onrenamesubmit: (node: Node, newName: string) => void;
    onrenamecancel: () => void;
  } = $props();

  let dragOver = $state(false);
  let draft = $state("");

  const renaming = $derived(renamingPath === node.path);

  async function expand() {
    node.expanded = !node.expanded;
    if (node.expanded && node.children === null) {
      node.children = (await listDir(node.path)).map(toNode);
    }
  }

  // Single click: folders toggle; files open as a reusable preview tab.
  function activate() {
    if (node.isDir) expand();
    else openFile(node.path, undefined, true);
  }

  // Double click pins a file (permanent tab), like VS Code.
  function pinOpen() {
    if (!node.isDir) openFile(node.path, undefined, false);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "F2") {
      e.preventDefault();
      onrename(node);
    }
  }

  function onDragStart(e: DragEvent) {
    e.dataTransfer?.setData("text/plain", node.path);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

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

  // Seed the draft with the current name, focus, and preselect the name minus
  // its extension (like a rename box). Runs when the input mounts (rename start).
  function focusRename(el: HTMLInputElement) {
    draft = node.name;
    el.value = node.name;
    el.focus();
    const dot = el.value.lastIndexOf(".");
    el.setSelectionRange(0, dot > 0 ? dot : el.value.length);
  }
</script>

{#if renaming}
  <div class="tree-item tree-rename" style="padding-left: {8 + depth * 14}px">
    <span class="chevron">{node.isDir ? (node.expanded ? "▾" : "▸") : ""}</span>
    <input
      bind:value={draft}
      use:focusRename
      onkeydown={(e) => {
        if (e.key === "Enter" && draft.trim()) onrenamesubmit(node, draft.trim());
        if (e.key === "Escape") onrenamecancel();
      }}
      onblur={onrenamecancel}
    />
  </div>
{:else}
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
    ondblclick={pinOpen}
    onkeydown={onKeydown}
    oncontextmenu={(e) => oncontext(e, node)}
  >
    <span class="chevron">{node.isDir ? (node.expanded ? "▾" : "▸") : ""}</span>
    <span class="tree-name">{node.name}</span>
  </button>
{/if}
{#if node.expanded && node.children}
  {#each node.children as child (child.path)}
    <TreeNode
      node={child}
      depth={depth + 1}
      {oncontext}
      {onmove}
      {onrename}
      {renamingPath}
      {onrenamesubmit}
      {onrenamecancel}
    />
  {/each}
{/if}
