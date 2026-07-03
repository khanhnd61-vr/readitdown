<script lang="ts">
  import { onMount } from "svelte";
  import { attachTerminal, detachTerminal } from "../lib/terminals";

  let { termId }: { termId: number } = $props();

  let el: HTMLElement;

  onMount(() => {
    attachTerminal(termId, el);
    return () => detachTerminal(termId);
  });
</script>

<div class="terminal-view" bind:this={el}></div>
