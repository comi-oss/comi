use tauri::webview::PageLoadEvent;

const INVENTORY_SHORTCUT_SCRIPT: &str = include_str!("../assets/inventory-shortcut.js");
const PXLKIT_CHEST_ICON: &str = include_str!("../assets/pxlkit-chest.svg");

/// Starts the map viewer on desktop or mobile.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .on_page_load(|webview, page| {
            if page.event() == PageLoadEvent::Finished
                && page.url().host_str() == Some("cf.mikira.id")
            {
                let script = INVENTORY_SHORTCUT_SCRIPT.replace("__COMI_ICON__", PXLKIT_CHEST_ICON);
                if let Err(error) = webview.eval(script) {
                    eprintln!("could not add inventory shortcut: {error}");
                }
            }
        })
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("could not start comi: {error}");
        std::process::exit(1);
    }
}
