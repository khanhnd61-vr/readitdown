import { invoke } from "@tauri-apps/api/core";

export interface Entry {
  name: string;
  path: string;
  isDir: boolean;
}

export const listDir = (path: string) => invoke<Entry[]>("list_dir", { path });

export const readTextFile = (path: string) => invoke<string>("read_text_file", { path });

export const writeTextFile = (path: string, content: string) =>
  invoke<void>("write_text_file", { path, content });

export const createFile = (dir: string, relPath: string) =>
  invoke<string>("create_file", { dir, relPath });

export const createDir = (dir: string, relPath: string) =>
  invoke<string>("create_dir", { dir, relPath });

export const deletePath = (path: string) => invoke<void>("delete_path", { path });

// Move (rename) a file or folder into destDir, keeping its basename. Returns the
// new forward-slash path.
export const movePath = (src: string, destDir: string) =>
  invoke<string>("move_path", { src, destDir });

export const initialRoot = () => invoke<string | null>("initial_root");

export interface SearchMatch {
  line: number; // 1-based
  col: number; // UTF-16 offset within the line (CodeMirror units)
  length: number;
  preview: string;
}

export interface FileMatches {
  path: string;
  matches: SearchMatch[];
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

// Grep the given root folders on disk (Ctrl+Shift+F). Returns matches grouped
// by file; capped backend-side so huge trees stay responsive.
export const searchInFiles = (roots: string[], query: string, opts: SearchOptions) =>
  invoke<FileMatches[]>("search_in_files", {
    roots,
    query,
    caseSensitive: opts.caseSensitive,
    wholeWord: opts.wholeWord,
    useRegex: opts.regex,
  });

export interface Prefs {
  favorites: string[];
  recents: string[];
  editorFontSize?: number;
  previewFontSize?: number;
}

// Rename a file/folder in place (same parent dir). Returns the new path.
export const renamePath = (path: string, newName: string) =>
  invoke<string>("rename_path", { path, newName });

export const loadPrefs = () => invoke<Prefs>("load_prefs");

export const savePrefs = (prefs: Prefs) => invoke<void>("save_prefs", { prefs });
