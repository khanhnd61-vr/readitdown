<script lang="ts">
  import { onMount } from "svelte";
  import {
    attachTerminal,
    copyTerminalSelection,
    detachTerminal,
    pasteIntoTerminal,
    terminalHasSelection,
  } from "../lib/terminals";

  let { termId }: { termId: number } = $props();

  let el: HTMLElement;
  let menu: { x: number; y: number } | null = $state(null);
  let hasSel = $state(false);

  onMount(() => {
    attachTerminal(termId, el);
    return () => detachTerminal(termId);
  });

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    hasSel = terminalHasSelection(termId);
    menu = {
      x: Math.min(e.clientX, window.innerWidth - 120),
      y: Math.min(e.clientY, window.innerHeight - 80),
    };
  }

  function copy() {
    copyTerminalSelection(termId);
    menu = null;
  }

  function paste() {
    pasteIntoTerminal(termId);
    menu = null;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="terminal-view" bind:this={el} oncontextmenu={onContextMenu}></div>

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
    <button disabled={!hasSel} onclick={copy}>Copy</button>
    <button onclick={paste}>Paste</button>
  </div>
{/if}
