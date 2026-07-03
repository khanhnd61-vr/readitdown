<script lang="ts">
  import { App as CapApp } from "@capacitor/app";
  import { app, pop } from "./lib/store.svelte";
  import HomeScreen from "./components/HomeScreen.svelte";
  import RepoScreen from "./components/RepoScreen.svelte";
  import ViewerScreen from "./components/ViewerScreen.svelte";

  const current = $derived(app.stack[app.stack.length - 1]);

  CapApp.addListener("backButton", () => {
    if (!pop()) CapApp.exitApp();
  });
</script>

{#key current}
  {#if current.kind === "home"}
    <HomeScreen />
  {:else if current.kind === "repo"}
    <RepoScreen repo={current.repo} />
  {:else}
    <ViewerScreen repo={current.repo} path={current.path} />
  {/if}
{/key}
