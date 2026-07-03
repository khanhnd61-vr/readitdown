<script lang="ts">
  import type { Entry, Repo } from "../lib/github";
  import { push } from "../lib/store.svelte";
  import TreeNode from "./TreeNode.svelte";

  let { entry, repo, depth = 0 }: { entry: Entry; repo: Repo; depth?: number } = $props();

  let expanded = $state(false);
</script>

{#if entry.children}
  <button
    class="tree-item dir"
    style="padding-left: {12 + depth * 16}px"
    onclick={() => (expanded = !expanded)}
  >
    <span class="chevron">{expanded ? "▾" : "▸"}</span>
    <span class="tree-name">{entry.name}</span>
  </button>
  {#if expanded}
    {#each entry.children as child (child.path)}
      <TreeNode entry={child} {repo} depth={depth + 1} />
    {/each}
  {/if}
{:else}
  <button
    class="tree-item"
    style="padding-left: {12 + depth * 16}px"
    onclick={() => push({ kind: "viewer", repo, path: entry.path })}
  >
    <span class="chevron"></span>
    <span class="tree-name">{entry.name}</span>
  </button>
{/if}

<style>
  .tree-item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    text-align: left;
    border-radius: 0;
    padding-top: 10px;
    padding-bottom: 10px;
    white-space: nowrap;
  }

  .tree-item:active {
    background: var(--bg-hover);
  }

  .tree-item.dir {
    color: var(--fg-muted);
  }

  .chevron {
    width: 14px;
    flex: none;
    color: var(--fg-muted);
    font-size: 11px;
  }

  .tree-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
