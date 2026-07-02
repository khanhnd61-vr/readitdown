// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Release builds launched from a terminal re-spawn themselves detached, so
    // `readitdown` returns the prompt immediately. READITDOWN_FOREGROUND=1 skips this.
    // Debug builds stay attached (tauri dev watches the process).
    #[cfg(all(unix, not(debug_assertions)))]
    {
        use std::io::IsTerminal;
        use std::os::unix::process::CommandExt;
        use std::process::{Command, Stdio};

        if std::env::var_os("READITDOWN_FOREGROUND").is_none() && std::io::stdout().is_terminal() {
            let exe = std::env::current_exe().expect("current_exe");
            let spawned = Command::new(exe)
                .args(std::env::args_os().skip(1))
                .env("READITDOWN_FOREGROUND", "1")
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .process_group(0)
                .spawn();
            match spawned {
                Ok(_) => return,
                Err(e) => eprintln!("readitdown: failed to detach: {e}"),
            }
        }
    }

    readitdown_lib::run()
}
