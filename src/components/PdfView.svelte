<script lang="ts">
  import { onMount } from "svelte";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
  import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
  import type { Tab } from "../lib/state.svelte";

  let { tab }: { tab: Tab } = $props();

  let container: HTMLElement;
  let status = $state("Loading...");
  let fitScale = $state(1);
  let zoom = $state(1);
  const pct = $derived(Math.round(fitScale * zoom * 100));

  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | undefined;
  let doc: PDFDocumentProxy | undefined;
  let generation = 0;

  // Renders every page at fitScale*zoom: a canvas plus a pdf.js text layer
  // (transparent spans over the canvas) so text is selectable. A new call
  // bumps `generation`, which aborts any render still in flight.
  async function renderAll() {
    if (!doc || !pdfjs) return;
    const gen = ++generation;
    const scale = fitScale * zoom;
    const ratio = window.devicePixelRatio || 1;
    // keep the view anchored on the same spot across zooms (empty container
    // on first render -> no anchor, start at the top)
    const anchor =
      container.scrollHeight > container.clientHeight
        ? (container.scrollTop + container.clientHeight / 2) / container.scrollHeight
        : 0;
    container.replaceChildren();
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      if (gen !== generation) return;
      const viewport = page.getViewport({ scale });
      const wrap = document.createElement("div");
      wrap.className = "pdf-page";
      wrap.style.width = `${Math.floor(viewport.width)}px`;
      wrap.style.height = `${Math.floor(viewport.height)}px`;
      wrap.style.setProperty("--scale-factor", `${viewport.scale}`);
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      await page.render({
        canvas,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      }).promise;
      if (gen !== generation) return;
      const textLayer = document.createElement("div");
      textLayer.className = "textLayer";
      await new pdfjs.TextLayer({
        textContentSource: page.streamTextContent(),
        container: textLayer,
        viewport,
      }).render();
      if (gen !== generation) return;
      wrap.append(canvas, textLayer);
      container.appendChild(wrap);
    }
    if (anchor > 0) {
      container.scrollTop = anchor * container.scrollHeight - container.clientHeight / 2;
    }
  }

  function setZoom(z: number) {
    zoom = Math.min(4, Math.max(0.25, z));
    renderAll().catch(console.error);
  }

  onMount(() => {
    let task: PDFDocumentLoadingTask | undefined;
    (async () => {
      try {
        // pdf.js is ~1MB, loaded on demand so it doesn't slow app startup
        pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const data = await (
          await fetch(convertFileSrc(tab.path), { cache: "no-store" })
        ).arrayBuffer();
        task = pdfjs.getDocument({ data });
        doc = await task.promise;
        if (generation < 0) return;
        const page1 = await doc.getPage(1);
        const width = Math.max(container.clientWidth - 48, 200);
        fitScale = width / page1.getViewport({ scale: 1 }).width;
        status = "";
        await renderAll();
      } catch (e) {
        console.error("pdf failed:", e);
        if (generation >= 0) status = `Could not load PDF: ${e}`;
      }
    })();
    return () => {
      generation = -1;
      task?.destroy();
    };
  });
</script>

<div class="pdf-wrap">
  {#if !status}
    <div class="pdf-controls">
      <button title="Zoom out" onclick={() => setZoom(zoom / 1.25)}>&minus;</button>
      <span class="pdf-zoom-label">{pct}%</span>
      <button title="Zoom in" onclick={() => setZoom(zoom * 1.25)}>+</button>
      <button title="Fit width" onclick={() => setZoom(1)}>Fit</button>
    </div>
  {/if}
  <div class="content pdf-view" bind:this={container}></div>
  {#if status}<div class="placeholder pdf-status">{status}</div>{/if}
</div>
