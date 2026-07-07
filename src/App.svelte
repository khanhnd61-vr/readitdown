<script lang="ts">
  import { onMount } from "svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { initialRoot } from "./lib/api";
  import { basename, toUiPath } from "./lib/paths";
  import { initPrefs, prefs } from "./lib/prefs.svelte";
  import {
    activePane,
    addRoot,
    app,
    openTerminal,
    splitPane,
    splitPaneDown,
    type Column,
  } from "./lib/state.svelte";
  import PaneView from "./components/PaneView.svelte";
  import SearchPanel from "./components/SearchPanel.svelte";
  import Sidebar from "./components/Sidebar.svelte";

  const recentsToShow = $derived(prefs.recents.filter((p) => !prefs.favorites.includes(p)));

  onMount(async () => {
    await initPrefs();
    const root = await initialRoot();
    if (root && app.sections.length === 0) addRoot(root);
  });

  async function openFolder(sectionId?: number) {
    const dir = await open({ directory: true });
    if (typeof dir === "string") addRoot(toUiPath(dir), sectionId);
  }

  function drag(e: PointerEvent, move: (ev: PointerEvent) => void) {
    e.preventDefault();
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startSidebarDrag(e: PointerEvent) {
    const startX = e.clientX;
    const startW = app.sidebarWidth;
    drag(e, (ev) => {
      app.sidebarWidth = Math.max(140, Math.min(600, startW + ev.clientX - startX));
    });
  }

  function startColDrag(e: PointerEvent, i: number) {
    const left = app.columns[i - 1];
    const right = app.columns[i];
    const pair = left.size + right.size;
    const startX = e.clientX;
    const startLeft = left.size;
    const totalSize = app.columns.reduce((s, c) => s + c.size, 0);
    const width = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect().width;
    drag(e, (ev) => {
      const delta = ((ev.clientX - startX) / width) * totalSize;
      left.size = Math.min(pair - 0.15, Math.max(0.15, startLeft + delta));
      right.size = pair - left.size;
    });
  }

  function startRowDrag(e: PointerEvent, col: Column, i: number) {
    const top = col.panes[i - 1];
    const bottom = col.panes[i];
    const pair = top.size + bottom.size;
    const startY = e.clientY;
    const startTop = top.size;
    const totalSize = col.panes.reduce((s, p) => s + p.size, 0);
    const height = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect().height;
    drag(e, (ev) => {
      const delta = ((ev.clientY - startY) / height) * totalSize;
      top.size = Math.min(pair - 0.15, Math.max(0.15, startTop + delta));
      bottom.size = pair - top.size;
    });
  }

  function onKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    const inTerminal = !!(e.target as HTMLElement)?.closest?.(".terminal-view");
    if (mod && e.key === "b") {
      e.preventDefault();
      app.sidebarVisible = !app.sidebarVisible;
    }
    if (e.ctrlKey && e.key === "`" && app.sections.length > 0) {
      e.preventDefault();
      openTerminal();
    }
    // Editor shortcuts (skip terminals, where Ctrl+E/Ctrl+\ belong to the shell).
    if (mod && !inTerminal && app.sections.length > 0) {
      // Ctrl+E: toggle edit / preview on a markdown or html tab.
      if (!e.shiftKey && e.key.toLowerCase() === "e") {
        const pane = activePane();
        const tab = pane.tabs.find((t) => t.id === pane.activeTabId);
        if (tab && (tab.kind === "markdown" || tab.kind === "html")) {
          e.preventDefault();
          tab.editing = !tab.editing;
        }
      }
      // Ctrl+\ splits right, Ctrl+Shift+\ splits down (layout-independent code).
      if (e.code === "Backslash") {
        e.preventDefault();
        if (e.shiftKey) splitPaneDown();
        else splitPane();
      }
      // Ctrl+Shift+F cross-file search, Ctrl+Shift+E back to the explorer.
      if (e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        app.sidebarVisible = true;
        app.sidebarView = "search";
      }
      if (e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        app.sidebarVisible = true;
        app.sidebarView = "files";
      }
    }
    // a webview reload wipes the whole session (tabs, panes, terminals);
    // swallow the browser reload shortcuts, but keep Ctrl+R in terminals
    // (shell reverse search)
    if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r")) {
      if (!(e.target as HTMLElement)?.closest?.(".terminal-view")) e.preventDefault();
    }
  }

  // the native webview context menu offers Reload, same session-wiping hazard;
  // the app draws its own menus (file tree), so drop the native one everywhere
  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
  }
</script>

<svelte:window onkeydown={onKeydown} oncontextmenu={onContextMenu} />

{#if app.sections.length === 0}
  <div class="welcome">
    <h1>ReadItDown</h1>
    <p>Minimal markdown viewer</p>
    <button class="primary" onclick={() => openFolder()}>Open Folder</button>
    {#if prefs.favorites.length > 0}
      <div class="start-section">
        <h2>Favorites</h2>
        {#each prefs.favorites as p (p)}
          <button class="start-item" title={p} onclick={() => addRoot(p)}>
            <span class="start-star">&#9733;</span>
            <span class="start-name">{basename(p)}</span>
            <span class="start-path">{p}</span>
          </button>
        {/each}
      </div>
    {/if}
    {#if recentsToShow.length > 0}
      <div class="start-section">
        <h2>Recent</h2>
        {#each recentsToShow as p (p)}
          <button class="start-item" title={p} onclick={() => addRoot(p)}>
            <span class="start-name">{basename(p)}</span>
            <span class="start-path">{p}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <div class="layout">
    {#if app.sidebarVisible}
      {#if app.sidebarView === "search"}
        <SearchPanel />
      {:else}
        <Sidebar {openFolder} />
      {/if}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="divider" onpointerdown={startSidebarDrag}></div>
    {:else}
      <div class="rail">
        <button title="Show sidebar (Ctrl+B)" onclick={() => (app.sidebarVisible = true)}>&#9776;</button>
        <button title="Search across files (Ctrl+Shift+F)" onclick={() => { app.sidebarVisible = true; app.sidebarView = "search"; }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>
    {/if}
    <main class="panes">
      {#each app.columns as col, ci (col.id)}
        {#if ci > 0}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="divider" onpointerdown={(e) => startColDrag(e, ci)}></div>
        {/if}
        <div class="pane-col" style="flex-grow: {col.size}; flex-basis: 0;">
          {#each col.panes as pane, pi (pane.id)}
            {#if pi > 0}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="divider-h" onpointerdown={(e) => startRowDrag(e, col, pi)}></div>
            {/if}
            <PaneView {pane} />
          {/each}
        </div>
      {/each}
    </main>
  </div>
{/if}
