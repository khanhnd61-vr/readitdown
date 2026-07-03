import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

// xterm instances live here, keyed by the backend PTY id, so a terminal tab
// keeps its scrollback when it's hidden behind another tab and re-shown.

interface Session {
  term: Terminal;
  fit: FitAddon;
  el: HTMLDivElement;
  opened: boolean;
  ro: ResizeObserver | null;
}

const sessions = new Map<number, Session>();

let onExit: (id: number) => void = () => {};
export function setTermExitHandler(cb: (id: number) => void) {
  onExit = cb;
}

let listening = false;
async function ensureListeners() {
  if (listening) return;
  listening = true;
  await listen<{ id: number; data: string }>("term-data", (e) => {
    sessions.get(e.payload.id)?.term.write(e.payload.data);
  });
  await listen<number>("term-exit", (e) => onExit(e.payload));
}

export async function createTerminal(cwd: string | null): Promise<number> {
  await ensureListeners();
  const id = await invoke<number>("term_create", { cwd, cols: 80, rows: 24 });

  const el = document.createElement("div");
  el.style.height = "100%";
  const term = new Terminal({
    cursorBlink: true,
    scrollback: 5000,
    fontSize: 13,
    fontFamily: 'Menlo, Monaco, "Droid Sans Mono", "Courier New", monospace',
    theme: {
      background: "#1e1e1e",
      foreground: "#cccccc",
      cursor: "#cccccc",
      selectionBackground: "#264f78",
      black: "#000000",
      red: "#cd3131",
      green: "#0dbc79",
      yellow: "#e5e510",
      blue: "#2472c8",
      magenta: "#bc3fbc",
      cyan: "#11a8cd",
      white: "#e5e5e5",
      brightBlack: "#666666",
      brightRed: "#f14c4c",
      brightGreen: "#23d18b",
      brightYellow: "#f5f543",
      brightBlue: "#3b8eea",
      brightMagenta: "#d670d6",
      brightCyan: "#29b8db",
      brightWhite: "#e5e5e5",
    },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.onData((data) => invoke("term_write", { id, data }).catch(console.error));
  term.onResize(({ cols, rows }) => invoke("term_resize", { id, cols, rows }).catch(console.error));
  term.attachCustomKeyEventHandler((e) => {
    // let app shortcuts bubble instead of feeding them to the shell
    if (e.ctrlKey && !e.shiftKey && (e.key === "`" || e.key === "b")) return false;
    if (e.type === "keydown" && e.ctrlKey && e.shiftKey && e.code === "KeyC" && term.hasSelection()) {
      navigator.clipboard.writeText(term.getSelection()).catch(console.error);
      return false;
    }
    if (e.type === "keydown" && e.ctrlKey && e.shiftKey && e.code === "KeyV") {
      navigator.clipboard
        .readText()
        .then((t) => t && term.paste(t))
        .catch(console.error);
      return false;
    }
    return true;
  });

  sessions.set(id, { term, fit, el, opened: false, ro: null });
  return id;
}

export function attachTerminal(id: number, container: HTMLElement) {
  const s = sessions.get(id);
  if (!s) return;
  container.appendChild(s.el);
  if (!s.opened) {
    s.term.open(s.el);
    s.opened = true;
  }
  s.fit.fit();
  s.term.focus();
  s.ro = new ResizeObserver(() => s.fit.fit());
  s.ro.observe(container);
}

export function detachTerminal(id: number) {
  const s = sessions.get(id);
  if (!s) return;
  s.ro?.disconnect();
  s.ro = null;
  s.el.remove();
}

export function disposeTerminal(id: number) {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  s.ro?.disconnect();
  s.term.dispose();
  s.el.remove();
  invoke("term_kill", { id }).catch(console.error);
}
