use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

pub struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct TermState(Mutex<HashMap<u32, Session>>);

static NEXT_ID: AtomicU32 = AtomicU32::new(1);

#[derive(serde::Serialize, Clone)]
struct TermData {
    id: u32,
    data: String,
}

fn size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn default_shell() -> String {
    #[cfg(windows)]
    return std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".into());
    #[cfg(not(windows))]
    std::env::var("SHELL").unwrap_or_else(|_| {
        if cfg!(target_os = "macos") {
            "/bin/zsh".into()
        } else {
            "/bin/bash".into()
        }
    })
}

fn home_dir() -> Option<String> {
    #[cfg(windows)]
    return std::env::var("USERPROFILE").ok();
    #[cfg(not(windows))]
    std::env::var("HOME").ok()
}

#[tauri::command]
pub fn term_create(
    app: AppHandle,
    state: State<TermState>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<u32, String> {
    let pair = native_pty_system()
        .openpty(size(cols, rows))
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(default_shell());
    // login shell on macOS so PATH matches the user's terminal (GUI apps get a bare env)
    if cfg!(target_os = "macos") {
        cmd.arg("-l");
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    if let Some(dir) = cwd.filter(|d| Path::new(d).is_dir()).or_else(home_dir) {
        cmd.cwd(dir);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    state.0.lock().unwrap().insert(
        id,
        Session {
            master: pair.master,
            writer,
            child,
        },
    );

    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        // carry holds a multi-byte UTF-8 char split across read boundaries
        let mut carry: Vec<u8> = Vec::new();
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    carry.extend_from_slice(&buf[..n]);
                    let data = match std::str::from_utf8(&carry) {
                        Ok(s) => {
                            let s = s.to_string();
                            carry.clear();
                            s
                        }
                        Err(e) if e.error_len().is_none() => {
                            let valid = e.valid_up_to();
                            let s = String::from_utf8_lossy(&carry[..valid]).into_owned();
                            carry.drain(..valid);
                            s
                        }
                        Err(_) => {
                            let s = String::from_utf8_lossy(&carry).into_owned();
                            carry.clear();
                            s
                        }
                    };
                    if !data.is_empty() {
                        let _ = app.emit("term-data", TermData { id, data });
                    }
                }
            }
        }
        // reap the child unless term_kill already did
        let sess = app.state::<TermState>().0.lock().unwrap().remove(&id);
        if let Some(mut s) = sess {
            let _ = s.child.wait();
        }
        let _ = app.emit("term-exit", id);
    });

    Ok(id)
}

#[tauri::command]
pub fn term_write(state: State<TermState>, id: u32, data: String) -> Result<(), String> {
    let mut map = state.0.lock().unwrap();
    let s = map.get_mut(&id).ok_or("no such terminal")?;
    s.writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn term_resize(state: State<TermState>, id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let map = state.0.lock().unwrap();
    let s = map.get(&id).ok_or("no such terminal")?;
    s.master.resize(size(cols, rows)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn term_kill(state: State<TermState>, id: u32) {
    let sess = state.0.lock().unwrap().remove(&id);
    if let Some(mut s) = sess {
        let _ = s.child.kill();
        let _ = s.child.wait();
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn pty_spawn_and_read() {
        let pair = native_pty_system().openpty(size(80, 24)).unwrap();
        let mut cmd = CommandBuilder::new("/bin/echo");
        cmd.arg("pty-works");
        let mut child = pair.slave.spawn_command(cmd).unwrap();
        drop(pair.slave);
        let mut reader = pair.master.try_clone_reader().unwrap();
        let mut out = Vec::new();
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => out.extend_from_slice(&buf[..n]),
            }
        }
        child.wait().unwrap();
        assert!(String::from_utf8_lossy(&out).contains("pty-works"));
    }
}
