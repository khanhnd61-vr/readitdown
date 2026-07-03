<script lang="ts">
  import { fetchTree, type Repo } from "../lib/github";
  import { isFavorite, pop, toggleFavorite } from "../lib/store.svelte";
  import TreeNode from "./TreeNode.svelte";

  let { repo }: { repo: Repo } = $props();
</script>

<div class="screen">
  <div class="header">
    <button onclick={() => pop()} aria-label="Back">&larr;</button>
    <span class="title">{repo.owner}/{repo.name}</span>
    <button
      class:starred={isFavorite(repo)}
      onclick={() => toggleFavorite(repo)}
      aria-label="Toggle favorite"
    >
      {isFavorite(repo) ? "★" : "☆"}
    </button>
  </div>
  <div class="body">
    {#await fetchTree(repo)}
      <div class="status">Loading file list...</div>
    {:then { tree, truncated }}
      {#if truncated}
        <div class="notice">Repo is very large; the file list may be incomplete.</div>
      {/if}
      {#if tree.length === 0}
        <div class="status">No markdown files in this repo.</div>
      {:else}
        <div class="tree">
          {#each tree as entry (entry.path)}
            <TreeNode {entry} {repo} />
          {/each}
        </div>
      {/if}
    {:catch err}
      <div class="status error">{err.message}</div>
    {/await}
  </div>
</div>

<style>
  .notice {
    padding: 8px 16px;
    font-size: 13px;
    color: var(--fg-muted);
    border-bottom: 1px solid var(--border);
  }

  .tree {
    padding: 4px 0 calc(16px + var(--safe-bottom));
  }
</style>
