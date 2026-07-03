<script lang="ts">
  import type { OutlineItem } from "../lib/markdown";

  let {
    outline,
    onselect,
    onclose,
  }: {
    outline: OutlineItem[];
    onselect: (id: string) => void;
    onclose: () => void;
  } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onclose}></div>
<div class="panel">
  <div class="panel-title">Outline</div>
  {#each outline as item, i (i)}
    <button style="padding-left: {16 + (item.level - 1) * 14}px" onclick={() => onselect(item.id)}>
      {item.text}
    </button>
  {/each}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 10;
  }

  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(80vw, 320px);
    display: flex;
    flex-direction: column;
    background: var(--bg-side);
    border-left: 1px solid var(--border);
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.4);
    z-index: 11;
    overflow-y: auto;
    padding: calc(var(--safe-top) + 4px) 0 calc(var(--safe-bottom) + 8px);
  }

  .panel-title {
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--fg-muted);
  }

  .panel button {
    flex: none;
    text-align: left;
    border-radius: 0;
    padding-top: 10px;
    padding-bottom: 10px;
    padding-right: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .panel button:active {
    background: var(--bg-hover);
  }
</style>
