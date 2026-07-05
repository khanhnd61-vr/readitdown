<script lang="ts">
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { renderMarkdown } from "../lib/markdown";
  import { openFile, rootFor, type Tab } from "../lib/state.svelte";
  import HtmlView from "./HtmlView.svelte";

  let { tab, paneId, wrap }: { tab: Tab; paneId: number; wrap: boolean } = $props();

  let container: HTMLElement | undefined = $state();
  const html = $derived(
    tab.kind === "markdown" ? renderMarkdown(tab.content, tab.path, rootFor(tab.path)) : "",
  );

  function handleLink(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest("a");
    if (!a || !container?.contains(a)) return;
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

  // Middle-click on a link would navigate the whole webview away (no way
  // back); route it like a left click. Older WebKitGTK doesn't fire auxclick,
  // so mouseup is the fallback.
  function onMiddle(e: MouseEvent) {
    if (e.button !== 1) return;
    if (e.type === "mouseup" && "onauxclick" in window) return;
    handleLink(e);
  }
</script>

{#if tab.kind === "html"}
  <HtmlView {tab} {paneId} />
{:else}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="content {wrap ? 'wrap' : 'nowrap'}"
    bind:this={container}
    onclick={handleLink}
    onauxclick={onMiddle}
    onmouseup={onMiddle}
    onmousedown={(e) => e.button === 1 && e.preventDefault()}
  >
    <article class="markdown-body">{@html html}</article>
  </div>
{/if}
