<script lang="ts">
  import { onDestroy } from "svelte";
  import { searchInFiles, type FileMatches, type SearchMatch } from "../lib/api";
  import { basename } from "../lib/paths";
  import { allRoots, app, openFileAt } from "../lib/state.svelte";

  let query = $state("");
  let caseSensitive = $state(false);
  let wholeWord = $state(false);
  let regex = $state(false);
  let results = $state<FileMatches[]>([]);
  let error = $state("");
  let busy = $state(false);
  let collapsed = $state<Record<string, boolean>>({});
  // guards against a slow search overwriting the results of a newer one
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const totalMatches = $derived(results.reduce((n, f) => n + f.matches.length, 0));

  async function run() {
    const q = query.trim();
    if (!q) {
      results = [];
      error = "";
      busy = false;
      return;
    }
    const id = ++seq;
    busy = true;
    try {
      const r = await searchInFiles(allRoots(), q, { caseSensitive, wholeWord, regex });
      if (id !== seq) return;
      results = r;
      error = "";
    } catch (e) {
      if (id !== seq) return;
      results = [];
      error = String(e);
    } finally {
      if (id === seq) busy = false;
    }
  }

  // Re-run (debounced) whenever the query or any toggle changes.
  $effect(() => {
    query;
    caseSensitive;
    wholeWord;
    regex;
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  });

  // Bump seq so an in-flight search can't write state after unmount.
  onDestroy(() => {
    clearTimeout(timer);
    seq++;
  });

  function relPath(p: string): string {
    for (const root of allRoots()) {
      if (p.startsWith(root + "/")) return p.slice(root.length + 1);
    }
    return p;
  }

  function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Highlight the matched span inside the line preview. col/length are UTF-16
  // units from the backend, so they index the JS string directly.
  function previewHtml(m: SearchMatch): string {
    const p = m.preview;
    const start = Math.min(m.col, p.length);
    const end = Math.min(m.col + m.length, p.length);
    return `${esc(p.slice(0, start))}<mark>${esc(p.slice(start, end))}</mark>${esc(p.slice(end))}`;
  }

  function autofocus(el: HTMLInputElement) {
    el.focus();
    el.select();
  }
</script>

<aside class="sidebar search-panel" style="width: {app.sidebarWidth}px">
  <div class="sidebar-header">
    <span class="root-name">Search</span>
    <button title="Back to explorer (Ctrl+Shift+E)" onclick={() => (app.sidebarView = "files")}>
      &#10005;
    </button>
  </div>

  <div class="search-box">
    <div class="search-field">
      <input
        placeholder="Search across files"
        bind:value={query}
        use:autofocus
        onkeydown={(e) => {
          if (e.key === "Escape") app.sidebarView = "files";
          if (e.key === "Enter") run();
        }}
      />
      <div class="search-opts">
        <button class:active={caseSensitive} title="Match case" onclick={() => (caseSensitive = !caseSensitive)}>Aa</button>
        <button class:active={wholeWord} title="Match whole word" onclick={() => (wholeWord = !wholeWord)}>\b</button>
        <button class:active={regex} title="Use regular expression" onclick={() => (regex = !regex)}>.*</button>
      </div>
    </div>
  </div>

  {#if error}
    <div class="search-status error">{error}</div>
  {:else if busy}
    <div class="search-status">Searching…</div>
  {:else if query.trim() && results.length === 0}
    <div class="search-status">No results found</div>
  {:else if results.length > 0}
    <div class="search-status">
      {totalMatches} result{totalMatches === 1 ? "" : "s"} in {results.length} file{results.length === 1 ? "" : "s"}
    </div>
  {/if}

  <div class="search-results">
    {#each results as file (file.path)}
      <div class="result-file">
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <button
          class="result-file-head"
          onclick={() => (collapsed[file.path] = !collapsed[file.path])}
          title={file.path}
        >
          <span class="chevron">{collapsed[file.path] ? "▸" : "▾"}</span>
          <span class="result-file-name">{basename(file.path)}</span>
          <span class="result-file-dir">{relPath(file.path)}</span>
          <span class="result-count">{file.matches.length}</span>
        </button>
        {#if !collapsed[file.path]}
          {#each file.matches as m, i (i)}
            <button
              class="result-line"
              title="Line {m.line}"
              onclick={() => openFileAt(file.path, { line: m.line, col: m.col, length: m.length })}
            >
              <span class="result-lineno">{m.line}</span>
              <span class="result-preview">{@html previewHtml(m)}</span>
            </button>
          {/each}
        {/if}
      </div>
    {/each}
  </div>
</aside>
