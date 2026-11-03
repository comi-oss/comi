/// Starts the map viewer on desktop or mobile.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Err(error) = tauri::Builder::default().run(tauri::generate_context!()) {
        eprintln!("could not start CF Map: {error}");
        std::process::exit(1);
    }
}
