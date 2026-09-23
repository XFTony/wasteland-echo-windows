#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{env, fs, path::PathBuf};

fn install_panic_log() {
    std::panic::set_hook(Box::new(|info| {
        let base = env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(env::temp_dir);
        let directory = base.join("WastelandEcho").join("logs");
        let _ = fs::create_dir_all(&directory);
        let _ = fs::write(directory.join("crash.log"), format!("{info}\n"));
    }));
}

fn main() {
    install_panic_log();
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("failed to run Wasteland Echo desktop shell");
}
