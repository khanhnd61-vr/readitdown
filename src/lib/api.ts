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

export const initialRoot = () => invoke<string | null>("initial_root");
