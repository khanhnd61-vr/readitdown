import MarkdownIt from "markdown-it";
import { blobUrl, rawUrl, type Repo } from "./github";
import { dirname, normalize, resolvePath } from "./paths";

const md = new MarkdownIt({ html: true, linkify: true });

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const MD = /\.(md|markdown|mdown)$/i;

export interface OutlineItem {
  level: number;
  text: string;
  id: string;
}

function resolveRepoPath(href: string, fileDir: string): string {
  const clean = decodeURI(href.split("#")[0].split("?")[0]);
  if (clean.startsWith("/")) return normalize(clean);
  return resolvePath(fileDir, clean);
}

// Renders markdown to HTML, then rewrites the result so it works inside the app:
// - relative <img> srcs (from markdown or embedded html) -> raw.githubusercontent.com
// - external links marked data-external; relative .md links resolved to data-file
//   (repo path); other relative links become external github.com blob links
// - headings get github-style ids and are collected into the outline
export function renderMarkdown(
  src: string,
  filePath: string,
  repo: Repo,
): { html: string; outline: OutlineItem[] } {
  const tpl = document.createElement("template");
  tpl.innerHTML = md.render(src);
  const fileDir = dirname(filePath);

  for (const img of tpl.content.querySelectorAll("img")) {
    const s = img.getAttribute("src") ?? "";
    if (s && !SCHEME.test(s) && !s.startsWith("//")) {
      img.setAttribute("src", rawUrl(repo, resolveRepoPath(s, fileDir)));
    }
    img.setAttribute("loading", "lazy");
  }

  for (const a of tpl.content.querySelectorAll("a")) {
    const href = a.getAttribute("href") ?? "";
    if (!href || href.startsWith("#")) continue;
    if (SCHEME.test(href) || href.startsWith("//")) {
      a.dataset.external = "true";
    } else {
      const path = resolveRepoPath(href, fileDir);
      if (MD.test(path)) {
        a.dataset.file = path;
      } else {
        a.dataset.external = "true";
        a.setAttribute("href", blobUrl(repo, path));
      }
    }
  }

  const outline: OutlineItem[] = [];
  const used = new Set<string>();
  for (const h of tpl.content.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    const text = (h.textContent ?? "").trim();
    const base = text
      .toLowerCase()
      .replace(/[^\w\- ]+/g, "")
      .replace(/ +/g, "-");
    let slug = base;
    let n = 1;
    while (used.has(slug)) slug = `${base}-${n++}`;
    used.add(slug);
    h.id = slug;
    outline.push({ level: Number(h.tagName[1]), text, id: slug });
  }

  return { html: tpl.innerHTML, outline };
}
