mod terminal;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;
use tauri::Manager;

static INITIAL_ROOT: OnceLock<Option<String>> = OnceLock::new();

/// Convert a filesystem path to the forward-slash form the UI uses everywhere.
/// On Windows this strips the `\\?\` verbatim prefix that `canonicalize` adds and
/// turns backslashes into forward slashes; on Unix it's a plain lossy conversion.
/// The frontend assumes `/` separators, and `std::fs` accepts `/` on Windows, so
/// keeping everything forward-slashed on both sides just works.
fn to_ui_path(p: &Path) -> String {
    let s = p.to_string_lossy();
    let s = s.strip_prefix(r"\\?\").unwrap_or(s.as_ref());
    s.replace('\\', "/")
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    name: String,
    path: String,
    is_dir: bool,
}

#[tauri::command]
fn list_dir(path: String) -> Result<Vec<Entry>, String> {
    let mut entries: Vec<Entry> = fs::read_dir(&path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                return None;
            }
            let is_dir = e.file_type().ok()?.is_dir();
            Some(Entry {
                name,
                path: to_ui_path(&e.path()),
                is_dir,
            })
        })
        .collect();
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

fn resolve_new_path(dir: &str, rel_path: &str) -> Result<std::path::PathBuf, String> {
    let rel = Path::new(rel_path);
    if rel_path.is_empty()
        || rel.is_absolute()
        || rel.components().any(|c| matches!(c, Component::ParentDir))
    {
        return Err("invalid path".into());
    }
    let path = Path::new(dir).join(rel);
    if path.exists() {
        return Err("already exists".into());
    }
    Ok(path)
}

#[tauri::command]
fn create_file(dir: String, rel_path: String) -> Result<String, String> {
    let path = resolve_new_path(&dir, &rel_path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, "").map_err(|e| e.to_string())?;
    Ok(to_ui_path(&path))
}

#[tauri::command]
fn create_dir(dir: String, rel_path: String) -> Result<String, String> {
    let path = resolve_new_path(&dir, &rel_path)?;
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(to_ui_path(&path))
}

#[tauri::command]
fn delete_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    let meta = fs::symlink_metadata(p).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

/// Move `src` into the directory `dest_dir`, keeping its file name. Backs the
/// sidebar drag-and-drop so files can be reorganized without a terminal.
#[tauri::command]
fn move_path(src: String, dest_dir: String) -> Result<String, String> {
    let src_path = Path::new(&src);
    let name = src_path
        .file_name()
        .ok_or_else(|| "invalid source".to_string())?;
    let dest_dir_path = Path::new(&dest_dir);
    if !dest_dir_path.is_dir() {
        return Err("destination is not a folder".into());
    }
    let dest = dest_dir_path.join(name);
    // No-op drop onto the folder the item already lives in.
    if dest.as_path() == src_path {
        return Ok(to_ui_path(src_path));
    }
    // Refuse to drop a folder into itself or one of its own descendants, which
    // would either fail cryptically or orphan the subtree.
    let src_abs = fs::canonicalize(src_path).map_err(|e| e.to_string())?;
    let dest_dir_abs = fs::canonicalize(dest_dir_path).map_err(|e| e.to_string())?;
    if dest_dir_abs == src_abs || dest_dir_abs.starts_with(&src_abs) {
        return Err("cannot move a folder into itself".into());
    }
    if dest.exists() {
        return Err(format!("\"{}\" already exists here", name.to_string_lossy()));
    }
    fs::rename(src_path, &dest).map_err(|e| e.to_string())?;
    Ok(to_ui_path(&dest))
}

/// Rename a file or folder in place, keeping it in the same parent directory.
/// `new_name` is a bare name (no path separators). Returns the new UI path.
#[tauri::command]
fn rename_path(path: String, new_name: String) -> Result<String, String> {
    let name = new_name.trim();
    if name.is_empty() || name.contains('/') || name.contains('\\') || name == "." || name == ".." {
        return Err("invalid name".into());
    }
    let src = Path::new(&path);
    let parent = src.parent().ok_or_else(|| "invalid path".to_string())?;
    let dest = parent.join(name);
    if dest == src {
        return Ok(to_ui_path(src));
    }
    if dest.exists() {
        return Err(format!("\"{}\" already exists", name));
    }
    fs::rename(src, &dest).map_err(|e| e.to_string())?;
    Ok(to_ui_path(&dest))
}

#[tauri::command]
fn initial_root() -> Option<String> {
    INITIAL_ROOT.get().cloned().flatten()
}

// Extensions worth grepping for the cross-file search (Ctrl+Shift+F). Mirrors
// the text/markdown/html kinds the editor opens; everything else (images, pdf,
// binaries) is skipped so the walk stays fast.
const SEARCHABLE_EXT: &[&str] = &[
    "md", "markdown", "mdown", "txt", "html", "htm", "tex", "bib", "py", "c", "h", "cpp", "hpp",
    "cc", "hh", "cxx", "cu", "cuh", "sh", "bash", "zsh", "js", "mjs", "ts", "json", "yaml", "yml",
    "toml", "xml", "css", "rs", "go", "java", "rb", "lua", "sql", "ini", "cfg", "conf", "log",
    "csv", "cmake", "mk", "patch", "diff",
];
const SEARCHABLE_NAMES: &[&str] = &["makefile", "gnumakefile", "dockerfile"];

const MAX_SEARCH_MATCHES: usize = 5000;
const MAX_SEARCH_FILE_BYTES: u64 = 2 * 1024 * 1024;
const MAX_PREVIEW_CHARS: usize = 400;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    line: usize,   // 1-based line number
    col: usize,    // UTF-16 offset of the match within the line (JS/CodeMirror units)
    length: usize, // UTF-16 length of the match
    preview: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMatches {
    path: String,
    matches: Vec<SearchMatch>,
}

fn is_searchable(path: &Path) -> bool {
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if SEARCHABLE_EXT.contains(&ext.to_lowercase().as_str()) {
            return true;
        }
    }
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|n| SEARCHABLE_NAMES.contains(&n.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn search_file(path: &Path, re: &regex::Regex, out: &mut Vec<FileMatches>, total: &mut usize) {
    let meta = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return,
    };
    if meta.len() > MAX_SEARCH_FILE_BYTES {
        return;
    }
    // Non-UTF-8 (binary) files just fail to read and are skipped.
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return,
    };
    let mut matches = Vec::new();
    for (i, line) in content.lines().enumerate() {
        for m in re.find_iter(line) {
            matches.push(SearchMatch {
                line: i + 1,
                col: line[..m.start()].encode_utf16().count(),
                length: m.as_str().encode_utf16().count(),
                preview: line.chars().take(MAX_PREVIEW_CHARS).collect(),
            });
            *total += 1;
            if *total >= MAX_SEARCH_MATCHES {
                break;
            }
        }
        if *total >= MAX_SEARCH_MATCHES {
            break;
        }
    }
    if !matches.is_empty() {
        out.push(FileMatches {
            path: to_ui_path(path),
            matches,
        });
    }
}

fn walk_search(dir: &Path, re: &regex::Regex, out: &mut Vec<FileMatches>, total: &mut usize) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.filter_map(|e| e.ok()) {
        if *total >= MAX_SEARCH_MATCHES {
            return;
        }
        let name = entry.file_name();
        if name.to_string_lossy().starts_with('.') {
            continue;
        }
        // Don't follow symlinks: avoids directory cycles hanging the walk.
        let ft = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if ft.is_symlink() {
            continue;
        }
        let path = entry.path();
        if ft.is_dir() {
            walk_search(&path, re, out, total);
        } else if is_searchable(&path) {
            search_file(&path, re, out, total);
        }
    }
}

#[tauri::command]
fn search_in_files(
    roots: Vec<String>,
    query: String,
    case_sensitive: bool,
    whole_word: bool,
    use_regex: bool,
) -> Result<Vec<FileMatches>, String> {
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let base = if use_regex {
        query.clone()
    } else {
        regex::escape(&query)
    };
    let pattern = if whole_word {
        format!(r"\b(?:{})\b", base)
    } else {
        base
    };
    let re = regex::RegexBuilder::new(&pattern)
        .case_insensitive(!case_sensitive)
        .build()
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    let mut total = 0usize;
    for root in &roots {
        if total >= MAX_SEARCH_MATCHES {
            break;
        }
        walk_search(Path::new(root), &re, &mut out, &mut total);
    }
    Ok(out)
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Prefs {
    #[serde(default)]
    favorites: Vec<String>,
    #[serde(default)]
    recents: Vec<String>,
    #[serde(default = "default_font_size")]
    editor_font_size: u32,
    #[serde(default = "default_preview_font_size")]
    preview_font_size: u32,
}

fn default_font_size() -> u32 {
    13
}

fn default_preview_font_size() -> u32 {
    14
}

impl Default for Prefs {
    fn default() -> Self {
        Prefs {
            favorites: Vec::new(),
            recents: Vec::new(),
            editor_font_size: default_font_size(),
            preview_font_size: default_preview_font_size(),
        }
    }
}

fn prefs_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("prefs.json"))
}

#[tauri::command]
fn load_prefs(app: tauri::AppHandle) -> Prefs {
    prefs_path(&app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn save_prefs(app: tauri::AppHandle, prefs: Prefs) -> Result<(), String> {
    let path = prefs_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&prefs).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let root = std::env::args().nth(1).and_then(|arg| {
        let p = fs::canonicalize(arg).ok()?;
        p.is_dir().then(|| to_ui_path(&p))
    });
    let _ = INITIAL_ROOT.set(root);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // Nothing may swap the webview out for a website (e.g. WebKitGTK's
        // default middle-click-on-link navigation) - there is no way back and
        // the whole session (tabs, terminals) would be lost. External URLs
        // only ever open via the opener plugin.
        .plugin(
            tauri::plugin::Builder::<_, ()>::new("navigation-guard")
                .on_navigation(|_webview, url| {
                    matches!(url.scheme(), "tauri" | "asset" | "about")
                        || matches!(
                            url.host_str(),
                            Some("localhost") | Some("tauri.localhost") | Some("asset.localhost")
                        )
                })
                .build(),
        )
        .manage(terminal::TermState::default())
        .invoke_handler(tauri::generate_handler![
            list_dir,
            read_text_file,
            write_text_file,
            create_file,
            create_dir,
            delete_path,
            move_path,
            rename_path,
            search_in_files,
            initial_root,
            load_prefs,
            save_prefs,
            terminal::term_create,
            terminal::term_write,
            terminal::term_resize,
            terminal::term_kill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
