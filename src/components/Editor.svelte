<script lang="ts">
  import { onMount } from "svelte";
  import { EditorView, basicSetup } from "codemirror";
  import { html } from "@codemirror/lang-html";
  import { markdown } from "@codemirror/lang-markdown";
  import { Compartment } from "@codemirror/state";
  import { keymap } from "@codemirror/view";
  import { vscodeDark } from "@uiw/codemirror-theme-vscode";
  import type { Tab } from "../lib/state.svelte";

  let { tab, wrap, onsave }: { tab: Tab; wrap: boolean; onsave: () => void } = $props();

  let el: HTMLElement;
  let view: EditorView | undefined;
  const wrapComp = new Compartment();

  onMount(() => {
    view = new EditorView({
      doc: tab.content,
      parent: el,
      extensions: [
        keymap.of([
          {
            key: "Mod-s",
            run: () => {
              onsave();
              return true;
            },
          },
        ]),
        basicSetup,
        tab.kind === "html" ? html() : markdown(),
        wrapComp.of(wrap ? EditorView.lineWrapping : []),
        vscodeDark,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) tab.content = u.state.doc.toString();
        }),
      ],
    });
    return () => view?.destroy();
  });

  $effect(() => {
    view?.dispatch({ effects: wrapComp.reconfigure(wrap ? EditorView.lineWrapping : []) });
  });

  // External file change refreshed tab.content (file watcher) -> sync the
  // editor. No-op right after typing since the update listener just set
  // tab.content to the current doc.
  $effect(() => {
    const text = tab.content;
    if (view && text !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    }
  });
</script>

<div class="editor" bind:this={el}></div>
