<script lang="ts">
  import { onMount } from "svelte";
  import { EditorView, basicSetup } from "codemirror";
  import { indentWithTab } from "@codemirror/commands";
  import { html } from "@codemirror/lang-html";
  import { markdown } from "@codemirror/lang-markdown";
  import { indentUnit } from "@codemirror/language";
  import { search, searchKeymap, openSearchPanel } from "@codemirror/search";
  import { Compartment } from "@codemirror/state";
  import { keymap } from "@codemirror/view";
  import { vscodeDark } from "@uiw/codemirror-theme-vscode";
  import { prefs, resetEditorFontSize, setEditorFontSize } from "../lib/prefs.svelte";
  import type { Tab } from "../lib/state.svelte";

  let { tab, wrap, onsave }: { tab: Tab; wrap: boolean; onsave: () => void } = $props();

  let el: HTMLElement;
  let view: EditorView | undefined;
  const wrapComp = new Compartment();

  // Ctrl + mouse wheel zooms the editor text, like VS Code. The font size lives
  // in prefs (shared by every editor, persisted); the container carries it as a
  // CSS var that .cm-editor reads, so the change applies without reconfiguring.
  function onWheel(e: WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setEditorFontSize(prefs.editorFontSize - Math.sign(e.deltaY));
  }

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
          // Ctrl+H (VS Code's find-and-replace): CodeMirror's search panel
          // already carries the replace row, so we just open it. Ctrl+F and the
          // rest of the search shortcuts come from searchKeymap below.
          {
            key: "Mod-h",
            run: (v) => {
              openSearchPanel(v);
              return true;
            },
          },
          // Ctrl+0 resets the zoom, matching the Ctrl+wheel gesture.
          {
            key: "Mod-0",
            run: () => {
              resetEditorFontSize();
              return true;
            },
          },
          ...searchKeymap,
          // Tab inserts/indents (Makefile recipes need real tabs); Esc then
          // Tab still escapes focus via CodeMirror's default escape hatch
          indentWithTab,
        ]),
        basicSetup,
        // Find/replace: Ctrl+F opens the panel (case-sensitive, whole-word and
        // regexp toggles, replace one / replace all all live in it). basicSetup
        // already carries searchKeymap + match highlighting; search() adds the
        // panel itself, anchored at the top like VS Code.
        search({ top: true }),
        tab.kind === "html" ? html() : tab.kind === "markdown" ? markdown() : [],
        // real tabs in plain text files (Makefile recipes require them)
        tab.kind === "text" ? indentUnit.of("\t") : [],
        wrapComp.of(wrap ? EditorView.lineWrapping : []),
        vscodeDark,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) tab.content = u.state.doc.toString();
        }),
      ],
    });
    // Non-passive so the ctrl+wheel zoom can preventDefault the browser's own
    // page zoom; Svelte marks its onwheel handlers passive.
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      view?.destroy();
    };
  });

  $effect(() => {
    view?.dispatch({ effects: wrapComp.reconfigure(wrap ? EditorView.lineWrapping : []) });
  });

  // External file change refreshed tab.content (file watcher) -> sync the
  // editor. No-op right after typing since the update listener just set
  // tab.content to the current doc.
  //
  // Skip while an IME composition is in flight: this effect is batched, so it
  // can run a frame after the update listener wrote tab.content, by which point
  // the doc has moved on — re-dispatching the whole document then aborts the
  // composition, so accented/Telex/CJK input only landed on space or arrow.
  $effect(() => {
    const text = tab.content;
    if (view && !view.composing && text !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    }
  });

  // A cross-file search hit asked us to jump to a match: select it and scroll
  // it into view, then clear the request so it fires once.
  $effect(() => {
    const r = tab.reveal;
    if (!view || !r) return;
    const doc = view.state.doc;
    const line = doc.line(Math.min(Math.max(1, r.line), doc.lines));
    const from = Math.min(line.from + r.col, line.to);
    const to = Math.min(from + r.length, line.to);
    view.dispatch({
      selection: { anchor: from, head: to },
      effects: EditorView.scrollIntoView(from, { y: "center" }),
    });
    view.focus();
    tab.reveal = undefined;
  });
</script>

<div class="editor" bind:this={el} style="--editor-font-size: {prefs.editorFontSize}px"></div>
