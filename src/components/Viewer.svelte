<script lang="ts">
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { renderMarkdown } from "../lib/markdown";
  import { app, openFile, type Tab } from "../lib/state.svelte";

  let { tab, paneId, wrap }: { tab: Tab; paneId: number; wrap: boolean } = $props();

  let container: HTMLElement;
  const html = $derived(renderMarkdown(tab.content, tab.path, app.root ?? ""));

  function onClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest("a");
    if (!a || !container.contains(a)) return;
    e.preventDefault();
    const href = a.getAttribute("href") ?? "";
    if (a.dataset.external) {
      openUrl(href).catch(console.error);
    } else if (a.dataset.file) {
      openFile(a.dataset.file, paneId);
    } else if (href.startsWith("#")) {
      container.querySelector(`[id="${CSS.escape(href.slice(1))}"]`)?.scrollIntoView({ behavior: "smooth" });
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="content {wrap ? 'wrap' : 'nowrap'}" bind:this={container} onclick={onClick}>
  <article class="markdown-body">{@html html}</article>
</div>
