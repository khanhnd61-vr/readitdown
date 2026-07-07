<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { confirm } from "@tauri-apps/plugin-dialog";
  import {
    allPanes,
    app,
    closePane,
    closeTab,
    openTerminal,
    reloadTab,
    saveTab,
    splitPane,
    splitPaneDown,
    type Pane,
    type Tab,
  } from "../lib/state.svelte";
  import Editor from "./Editor.svelte";
  import PdfView from "./PdfView.svelte";
  import TerminalView from "./TerminalView.svelte";
  import Viewer from "./Viewer.svelte";

  let { pane }: { pane: Pane } = $props();

  const activeTab = $derived(pane.tabs.find((t) => t.id === pane.activeTabId) ?? null);

  function isDirty(t: Tab) {
    return t.content !== t.savedContent;
  }

  async function onCloseTab(e: MouseEvent, t: Tab) {
    e.stopPropagation();
    if (isDirty(t) && !(await confirm(`Close "${t.title}" without saving?`))) return;
    closeTab(pane, t.id);
  }

  async function onReload(t: Tab) {
    if (isDirty(t) && !(await confirm(`Reload "${t.title}" from disk and discard unsaved changes?`)))
      return;
    reloadTab(t);
  }

  function startEditDrag(e: PointerEvent, tab: Tab) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
    function move(ev: PointerEvent) {
      const f = (ev.clientX - rect.left) / rect.width;
      tab.editSplit = Math.min(0.85, Math.max(0.15, f));
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<section
  class="pane"
  class:focused={app.activePaneId === pane.id}
  style="flex-grow: {pane.size}; flex-basis: 0;"
  onpointerdown={() => (app.activePaneId = pane.id)}
>
  <div class="tabbar">
    <div class="tabs">
      {#each pane.tabs as t (t.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="tab" class:active={t.id === pane.activeTabId} onclick={() => (pane.activeTabId = t.id)}>
          <span class="tab-title">{t.title}{isDirty(t) ? " •" : ""}</span>
          <button class="tab-close" onclick={(e) => onCloseTab(e, t)}>&#10005;</button>
        </div>
      {/each}
    </div>
    <div class="controls">
      {#if activeTab && isDirty(activeTab)}
        <button onclick={() => activeTab && saveTab(activeTab)}>Save</button>
      {/if}
      {#if activeTab && activeTab.kind !== "terminal"}
        <button title="Reload from disk" onclick={() => activeTab && onReload(activeTab)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      {/if}
      {#if activeTab?.kind === "markdown" || activeTab?.kind === "html"}
        <button
          title="Edit / preview side by side (Ctrl+E)"
          class:active={activeTab.editing}
          onclick={() => activeTab && (activeTab.editing = !activeTab.editing)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        </button>
      {/if}
      <button title="New terminal (Ctrl+`)" onclick={() => openTerminal(pane.id)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      </button>
      <button
        title="Word wrap (off = horizontal scroll)"
        class:active={pane.wrap}
        onclick={() => (pane.wrap = !pane.wrap)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 5h18" />
          <path d="M3 12h13a4 4 0 0 1 0 8h-3" />
          <polyline points="15 17 12 20 15 23" />
          <path d="M3 19h5" />
        </svg>
      </button>
      <button title="Split right (Ctrl+\)" onclick={splitPane}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      </button>
      <button title="Split down (Ctrl+Shift+\)" onclick={splitPaneDown}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      </button>
      {#if allPanes().length > 1}
        <button title="Close pane" onclick={() => closePane(pane.id)}>&#10005;</button>
      {/if}
    </div>
  </div>
  {#if activeTab}
    {#key `${activeTab.id}:${activeTab.fileVersion}`}
      {#if activeTab.kind === "terminal"}
        <TerminalView termId={activeTab.termId ?? -1} />
      {:else if activeTab.kind === "image"}
        <div class="content image-view">
          <!-- ?v= busts the webview cache when the file changes on disk -->
          <img src={`${convertFileSrc(activeTab.path)}?v=${activeTab.fileVersion}`} alt={activeTab.title} />
        </div>
      {:else if activeTab.kind === "pdf"}
        <PdfView tab={activeTab} />
      {:else if activeTab.kind === "text"}
        <Editor tab={activeTab} wrap={pane.wrap} onsave={() => activeTab && saveTab(activeTab)} />
      {:else if activeTab.editing}
        <div class="edit-split">
          <div class="edit-cell" style="flex-grow: {activeTab.editSplit ?? 0.5}">
            <Editor tab={activeTab} wrap={pane.wrap} onsave={() => activeTab && saveTab(activeTab)} />
          </div>
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="divider" onpointerdown={(e) => activeTab && startEditDrag(e, activeTab)}></div>
          <div class="edit-cell" style="flex-grow: {1 - (activeTab.editSplit ?? 0.5)}">
            <Viewer tab={activeTab} paneId={pane.id} wrap={pane.wrap} />
          </div>
        </div>
      {:else}
        <Viewer tab={activeTab} paneId={pane.id} wrap={pane.wrap} />
      {/if}
    {/key}
  {:else}
    <div class="placeholder">Open a file from the sidebar</div>
  {/if}
</section>
