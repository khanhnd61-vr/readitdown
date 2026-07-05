<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { resolveLink, SCHEME } from "../lib/markdown";
  import { dirname } from "../lib/paths";
  import { fileKind, openFile, rootFor, type Tab } from "../lib/state.svelte";

  let { tab, paneId }: { tab: Tab; paneId: number } = $props();

  let frame: HTMLIFrameElement;

  const fileDir = $derived(dirname(tab.path));
  // A <base> pointing at the file's directory (via the asset protocol) makes
  // relative css/js/img urls in the document resolve to disk, even though the
  // content is loaded from srcdoc (live edit buffer, not the saved file).
  const srcdoc = $derived(`<base href="${convertFileSrc(fileDir)}/">` + tab.content);

  // Same link rules as the markdown viewer: external -> system browser,
  // relative path to an openable file -> new tab, #anchor -> scroll in place.
  function onLoad() {
    // Click interception can't stop the page's own JS, form submits, or meta
    // refresh from navigating the iframe to a real website - and once there,
    // the preview has no way back. Detect any foreign document (cross-origin
    // access throws) and snap back to the file.
    let doc: Document | null = null;
    try {
      if (frame.contentWindow?.location.href === "about:srcdoc") doc = frame.contentDocument;
    } catch {
      doc = null;
    }
    if (!doc) {
      frame.srcdoc = srcdoc;
      return;
    }
    // the iframe has its own native context menu with Reload; block it too
    doc.addEventListener("contextmenu", (e) => e.preventDefault());
    const route = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (!href) return;
      e.preventDefault();
      if (href.startsWith("#")) {
        doc.querySelector(`[id="${CSS.escape(href.slice(1))}"]`)?.scrollIntoView({ behavior: "smooth" });
      } else if (SCHEME.test(href) || href.startsWith("//")) {
        openUrl(href).catch(console.error);
      } else {
        const path = resolveLink(href, fileDir, rootFor(tab.path));
        if (fileKind(path)) openFile(path, paneId);
      }
    };
    doc.addEventListener("click", route);
    // middle-click navigates the iframe by default; route it like a left
    // click (mouseup is the fallback where auxclick isn't fired)
    const middle = (e: MouseEvent) => {
      if (e.button !== 1) return;
      if (e.type === "mouseup" && "onauxclick" in window) return;
      route(e);
    };
    doc.addEventListener("auxclick", middle);
    doc.addEventListener("mouseup", middle);
    doc.addEventListener("mousedown", (e) => {
      if (e.button === 1) e.preventDefault();
    });
  }
</script>

<iframe class="html-view" title={tab.title} bind:this={frame} onload={onLoad} {srcdoc}></iframe>
