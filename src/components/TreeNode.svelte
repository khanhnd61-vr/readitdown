<script lang="ts">
  import TreeNode from "./TreeNode.svelte";
  import { listDir } from "../lib/api";
  import { toNode, type Node } from "../lib/tree";
  import { fileKind, openFile } from "../lib/state.svelte";

  let {
    node,
    depth = 0,
    oncontext,
  }: { node: Node; depth?: number; oncontext: (e: MouseEvent, node: Node) => void } = $props();

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
</script>

<button
  class="tree-item"
  class:dim={!node.isDir && !fileKind(node.path)}
  style="padding-left: {8 + depth * 14}px"
  title={node.path}
  onclick={activate}
  oncontextmenu={(e) => oncontext(e, node)}
>
  <span class="chevron">{node.isDir ? (node.expanded ? "▾" : "▸") : ""}</span>
  <span class="tree-name">{node.name}</span>
</button>
{#if node.expanded && node.children}
  {#each node.children as child (child.path)}
    <TreeNode node={child} depth={depth + 1} {oncontext} />
  {/each}
{/if}
