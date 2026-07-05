import MarkdownIt from "markdown-it";
import { convertFileSrc } from "@tauri-apps/api/core";
import { dirname, normalize, resolvePath } from "./paths";

const md = new MarkdownIt({ html: true, linkify: true });

export const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function resolveLink(href: string, fileDir: string, root: string): string {
  const clean = decodeURI(href.split("#")[0].split("?")[0]);
  if (clean.startsWith("/")) return normalize(root + clean);
  return resolvePath(fileDir, clean);
}

// Renders markdown to HTML, then rewrites the result so it works inside the app:
// - relative <img> srcs (from markdown or embedded html) -> tauri asset urls
// - external links marked data-external, relative links resolved to data-file
// - headings get github-style ids so #anchor links work
export function renderMarkdown(src: string, filePath: string, root: string): string {
  const tpl = document.createElement("template");
  tpl.innerHTML = md.render(src);
  const fileDir = dirname(filePath);

  for (const img of tpl.content.querySelectorAll("img")) {
    const s = img.getAttribute("src") ?? "";
    if (s && !SCHEME.test(s) && !s.startsWith("//")) {
      img.setAttribute("src", convertFileSrc(resolveLink(s, fileDir, root)));
    }
  }

  for (const a of tpl.content.querySelectorAll("a")) {
    const href = a.getAttribute("href") ?? "";
    if (!href || href.startsWith("#")) continue;
    if (SCHEME.test(href) || href.startsWith("//")) {
      a.dataset.external = "true";
    } else {
      a.dataset.file = resolveLink(href, fileDir, root);
    }
  }

  const used = new Set<string>();
  for (const h of tpl.content.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    const base = (h.textContent ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^\w\- ]+/g, "")
      .replace(/ +/g, "-");
    let slug = base;
    let n = 1;
    while (used.has(slug)) slug = `${base}-${n++}`;
    used.add(slug);
    h.id = slug;
  }

  return tpl.innerHTML;
}
