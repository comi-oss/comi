use base64::{engine::general_purpose::STANDARD, Engine as _};
use rusqlite::{params, Connection, OpenFlags};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::PathBuf,
    sync::OnceLock,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{webview::PageLoadEvent, AppHandle, Manager};

const INVENTORY_SHORTCUT_SCRIPT: &str = include_str!("../assets/inventory-shortcut.js");
const INVENTORY_CSS: &str = include_str!("../assets/inventory-overlay.css");
const COMI_CHEST_ICON: &str = include_str!("../assets/comi-chest.svg");
const CATALOG_API: &str = "https://comi-catalog-api.ryanadi001.workers.dev";
static CATALOG_IMAGE_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogManifest {
    version: String,
    sha256: String,
    url: String,
}

#[tauri::command]
async fn catalog_items(
    app: AppHandle,
    query: String,
    booth: String,
    offset: u32,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|_| "Could not access the catalog cache.".to_owned())?
        .join("catalog");
    fs::create_dir_all(&cache_dir).map_err(|_| "Could not create the catalog cache.".to_owned())?;

    let mut release_path = None;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let checked_at = cache_dir.join("manifest-checked-at");
    let refresh_manifest = fs::read_to_string(&checked_at)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .is_none_or(|checked| now.saturating_sub(checked) >= 300);
    if refresh_manifest {
        let _ = fs::write(&checked_at, now.to_string());
    }
    if refresh_manifest {
        if let Ok(response) = client
            .get(format!("{CATALOG_API}/catalog/manifest"))
            .send()
            .await
        {
            if let Ok(response) = response.error_for_status() {
                if let Ok(manifest) = response.json::<CatalogManifest>().await {
                    if manifest
                        .version
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
                        && manifest.url.starts_with("/catalog/catalog-")
                        && manifest.url.ends_with(".sqlite")
                    {
                        let target = cache_dir.join(format!("catalog-{}.sqlite", manifest.version));
                        let current_version =
                            fs::read_to_string(cache_dir.join("current.txt")).ok();
                        let valid_cached = current_version
                            .as_deref()
                            .is_some_and(|version| version.trim() == manifest.version)
                            && target.is_file();
                        let valid_existing_release = !valid_cached
                            && fs::read(&target).ok().is_some_and(|bytes| {
                                format!("{:x}", Sha256::digest(bytes)) == manifest.sha256
                            });
                        if valid_cached || valid_existing_release {
                            let _ = fs::write(
                                cache_dir.join("current.txt"),
                                manifest.version.as_bytes(),
                            );
                            release_path = Some(target);
                        } else if let Ok(response) = client
                            .get(format!("{CATALOG_API}{}", manifest.url))
                            .send()
                            .await
                        {
                            if let Ok(response) = response.error_for_status() {
                                if let Ok(bytes) = response.bytes().await {
                                    let digest = format!("{:x}", Sha256::digest(&bytes));
                                    if digest == manifest.sha256 {
                                        let temporary = target.with_extension("sqlite.tmp");
                                        if fs::write(&temporary, &bytes).is_ok()
                                            && fs::rename(&temporary, &target).is_ok()
                                        {
                                            let _ = fs::write(
                                                cache_dir.join("current.txt"),
                                                manifest.version.as_bytes(),
                                            );
                                            if let Ok(entries) = fs::read_dir(&cache_dir) {
                                                for entry in entries.flatten() {
                                                    let path = entry.path();
                                                    if path != target
                                                        && path
                                                            .extension()
                                                            .is_some_and(|ext| ext == "sqlite")
                                                    {
                                                        let _ = fs::remove_file(path);
                                                    }
                                                }
                                            }
                                            release_path = Some(target);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Once installed, the last good release remains usable when offline or when the
    // manifest endpoint is temporarily unavailable.
    if release_path.is_none() {
        release_path = fs::read_to_string(cache_dir.join("current.txt"))
            .ok()
            .map(|version| cache_dir.join(format!("catalog-{}.sqlite", version.trim())))
            .filter(|path| path.is_file());
    }
    if let Some(path) = release_path {
        return query_cached_catalog(&path, &query, &booth, offset);
    }

    // Keep first install functional until the first R2 catalog release is published.
    client
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

fn query_cached_catalog(
    path: &PathBuf,
    query: &str,
    booth: &str,
    offset: u32,
) -> Result<serde_json::Value, String> {
    let db = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|_| "The saved Comifuro catalog could not be opened.".to_owned())?;
    let pattern = if query.is_empty() {
        String::new()
    } else {
        format!(
            "%{}%",
            query
                .replace('\\', "\\\\")
                .replace('%', "\\%")
                .replace('_', "\\_")
        )
    };
    let mut statement = db
        .prepare(
            r#"
        SELECT id,name,category,fandom,characters_json,price_text,price_amount,currency,
               variants_json,availability,confidence,review_status,booth_id,booth_name,
               schedules_json,source_url,image_source
        FROM items
        WHERE (?1 = '' OR lower(booth_name) = lower(?1) OR booth_id = ?1)
          AND (?2 = '' OR name LIKE ?2 ESCAPE '\' COLLATE NOCASE
               OR booth_name LIKE ?2 ESCAPE '\' COLLATE NOCASE)
        ORDER BY booth_name COLLATE NOCASE, name COLLATE NOCASE
        LIMIT 41 OFFSET ?3
    "#,
        )
        .map_err(|_| "The saved catalog has an unsupported format.".to_owned())?;
    let rows = statement.query_map(params![booth, pattern, offset], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?, "name": row.get::<_, String>(1)?,
            "category": row.get::<_, Option<String>>(2)?, "fandom": row.get::<_, Option<String>>(3)?,
            "characters": parse_json(row.get::<_, Option<String>>(4)?.as_deref()),
            "priceText": row.get::<_, Option<String>>(5)?, "priceAmount": row.get::<_, Option<f64>>(6)?,
            "currency": row.get::<_, Option<String>>(7)?,
            "variants": parse_json(row.get::<_, Option<String>>(8)?.as_deref()),
            "availability": row.get::<_, Option<String>>(9)?, "confidence": row.get::<_, Option<f64>>(10)?,
            "reviewStatus": row.get::<_, Option<String>>(11)?, "boothId": row.get::<_, Option<String>>(12)?,
            "boothName": row.get::<_, Option<String>>(13)?,
            "schedules": parse_json(row.get::<_, Option<String>>(14)?.as_deref()),
            "sourceUrl": row.get::<_, Option<String>>(15)?, "imageSource": row.get::<_, Option<String>>(16)?,
        }))
    }).map_err(|_| "Could not query the saved Comifuro catalog.".to_owned())?;
    let collected: Result<Vec<_>, _> = rows.collect();
    let mut items =
        collected.map_err(|_| "Could not read the saved Comifuro catalog.".to_owned())?;
    let has_more = items.len() > 40;
    items.truncate(40);
    Ok(
        serde_json::json!({"event":"cf23","items":items,"limit":40,"offset":offset,"hasMore":has_more}),
    )
}

fn parse_json(value: Option<&str>) -> serde_json::Value {
    value
        .and_then(|value| serde_json::from_str(value).ok())
        .unwrap_or(serde_json::Value::Null)
}

#[tauri::command]
async fn catalog_image(app: AppHandle, url: String, variant: String) -> Result<String, String> {
    let mut parsed =
        reqwest::Url::parse(&url).map_err(|_| "invalid catalog image URL".to_owned())?;
    if !supported_catalog_image(&parsed) {
        return Err("unsupported catalog image host".to_owned());
    }
    let variant = match variant.as_str() {
        "thumbnail" => "small",
        "original" => "orig",
        _ => return Err("unsupported catalog image variant".to_owned()),
    };
    if parsed.host_str() == Some("pbs.twimg.com") {
        parsed.query_pairs_mut().append_pair("name", variant);
    }

    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|_| "could not access image cache".to_owned())?
        .join("catalog-images");
    fs::create_dir_all(&cache_dir).map_err(|_| "could not create image cache".to_owned())?;
    let cache_path = image_cache_path(&cache_dir, parsed.as_str());
    if let Ok(bytes) = fs::read(&cache_path) {
        if let Some(mime) = catalog_image_mime(&bytes) {
            return Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)));
        }
    }

    let response = CATALOG_IMAGE_CLIENT
        .get_or_init(reqwest::Client::new)
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
    let extension = if url.ends_with(".webp") { "webp" } else { "jpg" };
    cache_dir.join(format!("{digest:x}.{extension}"))
}

fn supported_catalog_image(url: &reqwest::Url) -> bool {
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port_or_known_default() != Some(443)
    {
        return false;
    }
    match url.host_str() {
        Some("pbs.twimg.com") => url.path().starts_with("/media/"),
        Some("comi-catalog-api.ryanadi001.workers.dev") => url
            .path()
            .strip_prefix("/catalog/images/")
            .and_then(|path| path.strip_suffix(".webp"))
            .is_some_and(|hash| hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit())),
        _ => false,
    }
}

fn catalog_image_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        Some("image/webp")
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some("image/jpeg")
    } else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else {
        None
    }
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
