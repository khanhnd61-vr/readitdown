<script lang="ts">
  import { untrack } from "svelte";
  import { confirm, message } from "@tauri-apps/plugin-dialog";
  import { app, createNewFile, createNewFolder, deleteEntry } from "../lib/state.svelte";
  import { loadChildren, type Node } from "../lib/tree";
  import TreeNode from "./TreeNode.svelte";

  let { openFolder }: { openFolder: () => void } = $props();

  let roots: Node[] = $state([]);
  let creating: { kind: "file" | "folder"; base: Node | null } | null = $state(null);
  let newName = $state("");
  let error = $state("");
  let menu: { x: number; y: number; node: Node } | null = $state(null);

  $effect(() => {
    const root = app.root;
    void app.treeVersion;
    if (!root) return;
    loadChildren(root, untrack(() => roots)).then((n) => (roots = n));
  });

  function startCreate(kind: "file" | "folder", base: Node | null) {
    menu = null;
    creating = { kind, base };
    newName = "";
    error = "";
  }

  function destLabel(): string {
    if (!creating?.base || !app.root) return (app.root ?? "").split("/").pop() + "/";
    return creating.base.path.slice(app.root.length + 1) + "/";
  }

  async function submitNew() {
    if (!app.root || !creating) return;
    const dir = creating.base?.path ?? app.root;
    const didExpand = creating.base && !creating.base.expanded;
    if (creating.base) creating.base.expanded = true;
    error = "";
    try {
      if (creating.kind === "file") await createNewFile(dir, newName.trim());
      else await createNewFolder(dir, newName.trim());
      creating = null;
      newName = "";
    } catch (e) {
      if (didExpand && creating?.base) creating.base.expanded = false;
      error = String(e);
    }
  }

  function onTreeContext(e: MouseEvent, node: Node) {
    e.preventDefault();
    menu = {
      x: Math.min(e.clientX, window.innerWidth - 180),
      y: Math.min(e.clientY, window.innerHeight - 140),
      node,
    };
  }

  async function del() {
    if (!menu) return;
    const n = menu.node;
    menu = null;
    const ok = await confirm(
      `Delete "${n.name}"${n.isDir ? " and all its contents" : ""}?`,
      { title: "Delete", kind: "warning" },
    );
    if (!ok) return;
    try {
      await deleteEntry(n.path, n.isDir);
    } catch (e) {
      await message(String(e), { title: "Delete failed", kind: "error" });
    }
  }

  function autofocus(el: HTMLInputElement) {
    el.focus();
  }
</script>

<aside class="sidebar" style="width: {app.sidebarWidth}px">
  <div class="sidebar-header">
    <span class="root-name" title={app.root}>{app.root?.split("/").pop()}</span>
    <button title="New file" onclick={() => startCreate("file", null)}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    </button>
    <button title="New folder" onclick={() => startCreate("folder", null)}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    </button>
    <button title="Open another folder" onclick={openFolder}>&#8943;</button>
    <button title="Hide sidebar (Ctrl+B)" onclick={() => (app.sidebarVisible = false)}>&#171;</button>
  </div>
  {#if creating}
    <div class="new-file">
      <div class="new-dest">New {creating.kind} in {destLabel()}</div>
      <input
        placeholder={creating.kind === "file" ? "name.md" : "folder-name"}
        bind:value={newName}
        use:autofocus
        onkeydown={(e) => {
          if (e.key === "Enter" && newName.trim()) submitNew();
          if (e.key === "Escape") creating = null;
        }}
      />
      {#if error}<div class="error">{error}</div>{/if}
    </div>
  {/if}
  <div class="tree">
    {#each roots as node (node.path)}
      <TreeNode {node} oncontext={onTreeContext} />
    {/each}
  </div>
</aside>

{#if menu}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="ctx-backdrop"
    onclick={() => (menu = null)}
    oncontextmenu={(e) => {
      e.preventDefault();
      menu = null;
    }}
  ></div>
  <div class="ctx-menu" style="left: {menu.x}px; top: {menu.y}px">
    {#if menu.node.isDir}
      <button onclick={() => menu && startCreate("file", menu.node)}>New File...</button>
      <button onclick={() => menu && startCreate("folder", menu.node)}>New Folder...</button>
      <div class="ctx-sep"></div>
      <button onclick={del}>Delete Folder</button>
    {:else}
      <button onclick={del}>Delete File</button>
    {/if}
  </div>
{/if}
