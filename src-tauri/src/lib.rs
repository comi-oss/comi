use base64::{engine::general_purpose::STANDARD, Engine as _};
use sha2::{Digest, Sha256};
use std::{fs, path::PathBuf};
use tauri::{webview::PageLoadEvent, AppHandle, Manager};

const INVENTORY_SHORTCUT_SCRIPT: &str = include_str!("../assets/inventory-shortcut.js");
const INVENTORY_CSS: &str = include_str!("../assets/inventory-overlay.css");
const COMI_CHEST_ICON: &str = include_str!("../assets/comi-chest.svg");
const CATALOG_API: &str = "https://comi-catalog-api.ryanadi001.workers.dev";

#[tauri::command]
async fn catalog_items(
    query: String,
    booth: String,
    offset: u32,
) -> Result<serde_json::Value, String> {
    reqwest::Client::new()
        .get(format!("{CATALOG_API}/items"))
        .query(&[
            ("event", "cf23"),
            ("limit", "40"),
            ("offset", &offset.to_string()),
            ("q", &query),
            ("booth", &booth),
        ])
        .send()
        .await
        .map_err(|_| "Could not connect to the Comifuro catalog.".to_owned())?
        .error_for_status()
        .map_err(|_| "The Comifuro catalog request failed.".to_owned())?
        .json()
        .await
        .map_err(|_| "The Comifuro catalog response was invalid.".to_owned())
}

#[tauri::command]
async fn catalog_image(app: AppHandle, url: String, variant: String) -> Result<String, String> {
    let mut parsed =
        reqwest::Url::parse(&url).map_err(|_| "invalid catalog image URL".to_owned())?;
    if parsed.scheme() != "https"
        || parsed.host_str() != Some("pbs.twimg.com")
        || !parsed.path().starts_with("/media/")
    {
        return Err("unsupported catalog image host".to_owned());
    }
    let variant = match variant.as_str() {
        "thumbnail" => "small",
        "original" => "orig",
        _ => return Err("unsupported catalog image variant".to_owned()),
    };
    parsed.query_pairs_mut().append_pair("name", variant);

    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|_| "could not access image cache".to_owned())?
        .join("catalog-images");
    fs::create_dir_all(&cache_dir).map_err(|_| "could not create image cache".to_owned())?;
    let cache_path = image_cache_path(&cache_dir, parsed.as_str());
    if let Ok(bytes) = fs::read(&cache_path) {
        return Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(bytes)));
    }

    let response = reqwest::Client::new()
        .get(parsed)
        .send()
        .await
        .map_err(|_| "could not load the catalog image".to_owned())?
        .error_for_status()
        .map_err(|_| "The catalog image request failed.".to_owned())?;
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .filter(|value| value.starts_with("image/"))
        .unwrap_or("image/jpeg")
        .to_owned();
    if response
        .content_length()
        .is_some_and(|size| size > 4_000_000)
    {
        return Err("catalog image is too large".to_owned());
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|_| "could not read the catalog image".to_owned())?;
    if bytes.len() > 4_000_000 {
        return Err("catalog image is too large".to_owned());
    }
    let _ = fs::write(&cache_path, &bytes);
    prune_image_cache(&cache_dir, 250 * 1024 * 1024);
    Ok(format!(
        "data:{content_type};base64,{}",
        STANDARD.encode(bytes)
    ))
}

fn image_cache_path(cache_dir: &PathBuf, url: &str) -> PathBuf {
    let digest = Sha256::digest(url.as_bytes());
    cache_dir.join(format!("{digest:x}.jpg"))
}

fn prune_image_cache(cache_dir: &std::path::Path, max_bytes: u64) {
    let Ok(entries) = fs::read_dir(cache_dir) else {
        return;
    };
    let mut files: Vec<_> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            metadata
                .is_file()
                .then(|| (entry.path(), metadata.len(), metadata.modified().ok()))
        })
        .collect();
    let mut total: u64 = files.iter().map(|(_, size, _)| size).sum();
    if total <= max_bytes {
        return;
    }
    files.sort_by_key(|(_, _, modified)| *modified);
    for (path, size, _) in files {
        if total <= max_bytes {
            break;
        }
        if fs::remove_file(path).is_ok() {
            total = total.saturating_sub(size);
        }
    }
}

/// Starts the map viewer on desktop or mobile.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![catalog_items, catalog_image])
        .on_page_load(|webview, page| {
            if page.event() == PageLoadEvent::Finished
                && page.url().host_str() == Some("cf.mikira.id")
            {
                let script = INVENTORY_SHORTCUT_SCRIPT
                    .replace("__COMI_INVENTORY_CSS__", INVENTORY_CSS)
                    .replace("__COMI_CHEST_ICON__", COMI_CHEST_ICON);
                if let Err(error) = webview.eval(script) {
                    eprintln!("could not add shopping list shortcut: {error}");
                }
            }
        })
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("could not start comi: {error}");
        std::process::exit(1);
    }
}
