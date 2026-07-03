<script lang="ts">
  import { fetchRepo, parseRepoInput, type Repo } from "../lib/github";
  import { app, isFavorite, openRepo, toggleFavorite } from "../lib/store.svelte";

  let input = $state("");
  let loading = $state(false);
  let error = $state("");

  async function submit(e: Event) {
    e.preventDefault();
    const parsed = parseRepoInput(input);
    if (!parsed) {
      error = "Enter a repo as owner/name or a GitHub URL";
      return;
    }
    loading = true;
    error = "";
    try {
      openRepo(await fetchRepo(parsed.owner, parsed.name));
      input = "";
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }
</script>

{#snippet repoRow(repo: Repo)}
  <div class="row">
    <button class="repo" onclick={() => openRepo(repo)}>{repo.owner}/{repo.name}</button>
    <button
      class="star"
      class:starred={isFavorite(repo)}
      onclick={() => toggleFavorite(repo)}
      aria-label="Toggle favorite"
    >
      {isFavorite(repo) ? "★" : "☆"}
    </button>
  </div>
{/snippet}

<div class="screen">
  <div class="header">
    <span class="title app-title">ReadItDown</span>
  </div>
  <div class="body home">
    <form onsubmit={submit}>
      <input
        bind:value={input}
        placeholder="owner/repo or GitHub URL"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="go"
      />
      <button class="primary" disabled={loading || !input.trim()}>
        {loading ? "Opening..." : "Open"}
      </button>
    </form>
    {#if error}<p class="error">{error}</p>{/if}

    {#if app.favorites.length}
      <h2>Favorites</h2>
      {#each app.favorites as repo (repo.owner + "/" + repo.name)}
        {@render repoRow(repo)}
      {/each}
    {/if}

    {#if app.recents.length}
      <h2>Recent</h2>
      {#each app.recents as repo (repo.owner + "/" + repo.name)}
        {@render repoRow(repo)}
      {/each}
    {/if}

    {#if !app.favorites.length && !app.recents.length}
      <p class="hint">Open a public GitHub repo to read its markdown files.</p>
    {/if}
  </div>
</div>

<style>
  .app-title {
    padding-left: 8px;
    font-size: 16px;
  }

  .home {
    padding: 16px 16px calc(16px + var(--safe-bottom));
  }

  form {
    display: flex;
    gap: 8px;
  }

  input {
    flex: 1;
    min-width: 0;
    font: inherit;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-input);
    color: var(--fg);
  }

  input:focus {
    outline: none;
    border-color: var(--focus);
  }

  button.primary {
    background: var(--accent);
    color: var(--fg-bright);
    padding: 10px 20px;
  }

  button.primary:disabled {
    opacity: 0.5;
  }

  .error {
    color: var(--error);
    margin: 12px 4px 0;
  }

  .hint {
    color: var(--fg-muted);
    text-align: center;
    margin-top: 48px;
  }

  h2 {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--fg-muted);
    margin: 24px 4px 4px;
  }

  .row {
    display: flex;
    align-items: center;
  }

  .row .repo {
    flex: 1;
    min-width: 0;
    text-align: left;
    padding: 12px 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row .repo:active {
    background: var(--bg-hover);
  }

  .row .star {
    flex: none;
    font-size: 18px;
    min-width: 44px;
    min-height: 44px;
    color: var(--fg-muted);
  }

  .row .star.starred {
    color: var(--star);
  }
</style>
