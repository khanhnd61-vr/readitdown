<script lang="ts">
  import { Browser } from "@capacitor/browser";
  import { fetchFile, type Repo } from "../lib/github";
  import { renderMarkdown, type OutlineItem } from "../lib/markdown";
  import { basename } from "../lib/paths";
  import { pop, push } from "../lib/store.svelte";
  import OutlinePanel from "./OutlinePanel.svelte";

  let { repo, path }: { repo: Repo; path: string } = $props();

  let container = $state<HTMLElement>();
  let outline = $state<OutlineItem[]>([]);
  let showOutline = $state(false);

  async function load(): Promise<string> {
    const text = await fetchFile(repo, path);
    const r = renderMarkdown(text, path, repo);
    outline = r.outline;
    return r.html;
  }

  function onClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest("a");
    if (!a || !container?.contains(a)) return;
    e.preventDefault();
    const href = a.getAttribute("href") ?? "";
    if (a.dataset.external) {
      Browser.open({ url: href }).catch(console.error);
    } else if (a.dataset.file) {
      push({ kind: "viewer", repo, path: a.dataset.file });
    } else if (href.startsWith("#")) {
      scrollToHeading(href.slice(1));
    }
  }

  function scrollToHeading(id: string) {
    container
      ?.querySelector(`[id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ behavior: "smooth" });
  }
</script>

<div class="screen">
  <div class="header">
    <button onclick={() => pop()} aria-label="Back">&larr;</button>
    <span class="title">{basename(path)}</span>
    <button
      onclick={() => (showOutline = true)}
      disabled={!outline.length}
      aria-label="Outline"
    >
      ☰
    </button>
  </div>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="body" bind:this={container} onclick={onClick}>
    {#await load()}
      <div class="status">Loading...</div>
    {:then html}
      <article class="markdown-body">{@html html}</article>
    {:catch err}
      <div class="status error">{err.message}</div>
    {/await}
  </div>
</div>

{#if showOutline}
  <OutlinePanel
    {outline}
    onselect={(id) => {
      showOutline = false;
      scrollToHeading(id);
    }}
    onclose={() => (showOutline = false)}
  />
{/if}
