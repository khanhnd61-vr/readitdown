use serde::Serialize;
use std::fs;
use std::path::Path;
use std::sync::OnceLock;

static INITIAL_ROOT: OnceLock<Option<String>> = OnceLock::new();

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
                path: e.path().to_string_lossy().to_string(),
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
    if rel_path.is_empty() || rel.is_absolute() || rel_path.split('/').any(|p| p == "..") {
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
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn create_dir(dir: String, rel_path: String) -> Result<String, String> {
    let path = resolve_new_path(&dir, &rel_path)?;
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
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

#[tauri::command]
fn initial_root() -> Option<String> {
    INITIAL_ROOT.get().cloned().flatten()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let root = std::env::args().nth(1).and_then(|arg| {
        let p = fs::canonicalize(arg).ok()?;
        p.is_dir().then(|| p.to_string_lossy().to_string())
    });
    let _ = INITIAL_ROOT.set(root);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_dir,
            read_text_file,
            write_text_file,
            create_file,
            create_dir,
            delete_path,
            initial_root
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
