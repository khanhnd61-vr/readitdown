<script lang="ts">
  import { untrack } from "svelte";
  import { confirm, message } from "@tauri-apps/plugin-dialog";
  import { prefs, toggleFavorite } from "../lib/prefs.svelte";
  import {
    app,
    closeRoot,
    createNewFile,
    createNewFolder,
    deleteEntry,
    moveEntry,
    reloadTab,
    tabsUnderRoots,
    type SidebarSection,
  } from "../lib/state.svelte";
  import { loadChildren, type Node } from "../lib/tree";
  import TreeNode from "./TreeNode.svelte";

  let { openFolder }: { openFolder: (sectionId?: number) => void } = $props();

  let trees: Record<string, Node[]> = $state({});
  let creating: { kind: "file" | "folder"; base: Node | null; sectionId: number } | null =
    $state(null);
  let newName = $state("");
  let error = $state("");
  let menu: { x: number; y: number; node: Node } | null = $state(null);

  const creatingSection = $derived(
    creating ? (app.sections.find((s) => s.id === creating!.sectionId) ?? null) : null,
  );

  $effect(() => {
    void app.treeVersion;
    for (const s of app.sections) {
      const root = s.activeRoot;
      loadChildren(root, untrack(() => trees[root] ?? null)).then((n) => (trees[root] = n));
    }
  });

  function selectRoot(section: SidebarSection, path: string) {
    app.activeSectionId = section.id;
    if (section.activeRoot === path) return;
    section.activeRoot = path;
    creating = null;
    menu = null;
  }

  function closeRootTab(e: MouseEvent, path: string) {
    e.stopPropagation();
    if (creating || menu) {
      creating = null;
      menu = null;
    }
    delete trees[path];
    closeRoot(path);
  }

  function startCreate(kind: "file" | "folder", base: Node | null, sectionId: number) {
    menu = null;
    creating = { kind, base, sectionId };
    app.activeSectionId = sectionId;
    newName = "";
    error = "";
  }

  // Section showing the tree this node belongs to (its root is the section's
  // active root while the node is visible).
  function sectionIdFor(node: Node): number {
    const s = app.sections.find(
      (x) => node.path === x.activeRoot || node.path.startsWith(x.activeRoot + "/"),
    );
    return s?.id ?? app.activeSectionId;
  }

  function destLabel(): string {
    const root = creatingSection?.activeRoot ?? "";
    if (!creating?.base) return root.split("/").pop() + "/";
    return creating.base.path.slice(root.length + 1) + "/";
  }

  async function submitNew() {
    if (!creating || !creatingSection) return;
    const dir = creating.base?.path ?? creatingSection.activeRoot;
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

  // Drag-and-drop move. Errors (name clash, folder-into-itself) surface as a
  // dialog instead of failing silently.
  async function handleMove(src: string, destDir: string) {
    try {
      await moveEntry(src, destDir);
    } catch (e) {
      await message(String(e), { title: "Move failed", kind: "error" });
    }
  }

  // Dropping onto the empty area of a folder's tree moves the item to that
  // folder's top level.
  function onRootDrop(e: DragEvent, root: string) {
    e.preventDefault();
    const src = e.dataTransfer?.getData("text/plain");
    if (src) handleMove(src, root);
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

  // Re-read every open file that lives under one of this section's folders,
  // and refresh its tree. Reload is manual by design (no file watching).
  async function reloadSection(section: SidebarSection) {
    const tabs = tabsUnderRoots(section.roots);
    const dirty = tabs.filter((t) => t.content !== t.savedContent);
    if (
      dirty.length > 0 &&
      !(await confirm(
        `Reload ${tabs.length} open file${tabs.length > 1 ? "s" : ""} from disk and discard unsaved changes in ${dirty.length}?`,
        { title: "Reload folder", kind: "warning" },
      ))
    )
      return;
    await Promise.all(tabs.map(reloadTab));
    app.treeVersion++;
  }

  function startSectionDrag(e: PointerEvent) {
    if (app.sections.length < 2) return;
    e.preventDefault();
    const [top, bottom] = app.sections;
    const pair = top.size + bottom.size;
    const startY = e.clientY;
    const startTop = top.size;
    const height = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect().height;
    function move(ev: PointerEvent) {
      const delta = ((ev.clientY - startY) / height) * pair;
      top.size = Math.min(pair - 0.15, Math.max(0.15, startTop + delta));
      bottom.size = pair - top.size;
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function autofocus(el: HTMLInputElement) {
    el.focus();
  }
</script>

<aside class="sidebar" style="width: {app.sidebarWidth}px">
  {#each app.sections as section, si (section.id)}
    {@const fav = prefs.favorites.includes(section.activeRoot)}
    {#if si > 0}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="divider-h" onpointerdown={startSectionDrag}></div>
    {/if}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="sidebar-section"
      style="flex-grow: {section.size}"
      onpointerdown={() => (app.activeSectionId = section.id)}
    >
      <div class="folder-tabs">
        {#each section.roots as r (r)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div
            class="folder-tab"
            class:active={r === section.activeRoot}
            title={r}
            onclick={() => selectRoot(section, r)}
          >
            <span class="folder-tab-name">{r.split("/").pop()}</span>
            <button class="tab-close" onclick={(e) => closeRootTab(e, r)}>&#10005;</button>
          </div>
        {/each}
      </div>
      <div class="sidebar-header">
        <span class="root-name" title={section.activeRoot}>{section.activeRoot.split("/").pop()}</span>
        <button
          class="star"
          class:fav
          title={fav ? "Remove from favorites" : "Mark as favorite"}
          onclick={() => toggleFavorite(section.activeRoot)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
        <button title="New file" onclick={() => startCreate("file", null, section.id)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </button>
        <button title="New folder" onclick={() => startCreate("folder", null, section.id)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
        </button>
        <button title="Reload open files from disk" onclick={() => reloadSection(section)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
        <button title="Open folder in this view" onclick={() => openFolder(section.id)}>&#8943;</button>
        {#if si === 0}
          <button title="Hide sidebar (Ctrl+B)" onclick={() => (app.sidebarVisible = false)}>&#171;</button>
        {/if}
      </div>
      {#if creating && creating.sectionId === section.id}
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
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="tree"
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => onRootDrop(e, section.activeRoot)}
      >
        {#each trees[section.activeRoot] ?? [] as node (node.path)}
          <TreeNode {node} oncontext={onTreeContext} onmove={handleMove} />
        {/each}
      </div>
    </div>
  {/each}
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
      <button onclick={() => menu && startCreate("file", menu.node, sectionIdFor(menu.node))}>New File...</button>
      <button onclick={() => menu && startCreate("folder", menu.node, sectionIdFor(menu.node))}>New Folder...</button>
      <div class="ctx-sep"></div>
      <button onclick={del}>Delete Folder</button>
    {:else}
      <button onclick={del}>Delete File</button>
    {/if}
  </div>
{/if}
