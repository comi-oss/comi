use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use worker::{wasm_bindgen::JsValue, *};

const CORS_ORIGIN: &str = "*";

#[derive(Deserialize)]
struct ItemRow {
    id: String,
    name: String,
    category: Option<String>,
    fandom: Option<String>,
    characters_json: Option<String>,
    price_text: Option<String>,
    price_amount: Option<f64>,
    currency: Option<String>,
    variants_json: Option<String>,
    availability: Option<String>,
    confidence: f64,
    review_status: String,
    event_circle_id: String,
    circle_name: String,
    schedules_json: Option<String>,
    source_url: Option<String>,
    image_source: Option<String>,
}

impl ItemRow {
    fn into_json(self) -> Value {
        json!({
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "fandom": self.fandom,
            "characters": parse_json(self.characters_json.as_deref()),
            "priceText": self.price_text,
            "priceAmount": self.price_amount,
            "currency": self.currency,
            "variants": parse_json(self.variants_json.as_deref()),
            "availability": self.availability,
            "confidence": self.confidence,
            "reviewStatus": self.review_status,
            "boothId": self.event_circle_id,
            "boothName": self.circle_name,
            "schedules": parse_json(self.schedules_json.as_deref()),
            "sourceUrl": self.source_url,
            "imageSource": self.image_source,
        })
    }
}

#[event(fetch)]
pub async fn main(request: Request, env: Env, _ctx: Context) -> Result<Response> {
    if request.method() == Method::Options {
        return Ok(Response::empty()?.with_headers(cors_headers()?));
    }
    if request.method() != Method::Get {
        return json_response(&json!({ "error": "method_not_allowed" }), 405);
    }

    let url = request.url()?;
    match url.path() {
        "/health" => json_response(&json!({ "ok": true, "service": "comi-catalog-api" }), 200),
        "/catalog/manifest" => {
            serve_r2_object(
                &env,
                "catalog/current.json",
                "application/json; charset=utf-8",
                "public, max-age=60, s-maxage=300",
            )
            .await
        }
        "/items" => serve_items(&env, &url).await,
        path if path.starts_with("/catalog/") && path.ends_with(".sqlite") => {
            let filename = path.strip_prefix("/catalog/").unwrap_or_default();
            if !filename
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-'))
            {
                return json_response(&json!({ "error": "invalid_catalog_release" }), 400);
            }
            let key = format!("catalog/{filename}");
            serve_r2_object(
                &env,
                &key,
                "application/vnd.sqlite3",
                "public, max-age=31536000, immutable",
            )
            .await
        }
        _ => json_response(&json!({ "error": "not_found" }), 404),
    }
}

async fn serve_items(env: &Env, url: &Url) -> Result<Response> {
    let params: HashMap<String, String> = url.query_pairs().into_owned().collect();
    let event = params.get("event").map(String::as_str).unwrap_or("cf23");
    if event.is_empty()
        || event.len() > 32
        || !event
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
    {
        return json_response(&json!({ "error": "invalid_event" }), 400);
    }
    let limit = params
        .get("limit")
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(50)
        .clamp(1, 100);
    let offset = params
        .get("offset")
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(0)
        .min(100_000);
    let query: String = params
        .get("q")
        .map(String::as_str)
        .unwrap_or_default()
        .trim()
        .chars()
        .take(120)
        .collect();
    let booth: String = params
        .get("booth")
        .map(String::as_str)
        .unwrap_or_default()
        .trim()
        .chars()
        .take(160)
        .collect();
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

    let sql = r#"
        SELECT id, name, category, fandom, characters_json, price_text,
               price_amount, currency, variants_json, availability, confidence,
               review_status, event_circle_id, circle_name, schedules_json,
               source_url, image_source
        FROM unique_event_items
        WHERE event_id = ?1
          AND (?2 = '' OR lower(circle_name) = lower(?2) OR event_circle_id = ?2)
          AND (?3 = '' OR name LIKE ?3 ESCAPE '\' COLLATE NOCASE OR circle_name LIKE ?3 ESCAPE '\' COLLATE NOCASE)
        ORDER BY circle_name COLLATE NOCASE, name COLLATE NOCASE
        LIMIT ?4 OFFSET ?5
    "#;
    let statement = env.d1("DB")?.prepare(sql).bind(&[
        JsValue::from_str(event),
        JsValue::from_str(&booth),
        JsValue::from_str(&pattern),
        JsValue::from_f64(f64::from(limit + 1)),
        JsValue::from_f64(f64::from(offset)),
    ])?;
    let rows = statement.all().await?.results::<ItemRow>()?;
    let has_more = rows.len() > limit as usize;
    let items: Vec<Value> = rows
        .into_iter()
        .take(limit as usize)
        .map(ItemRow::into_json)
        .collect();
    json_response(
        &json!({
            "event": event,
            "items": items,
            "limit": limit,
            "offset": offset,
            "hasMore": has_more,
        }),
        200,
    )
}

async fn serve_r2_object(
    env: &Env,
    key: &str,
    content_type: &str,
    cache_control: &str,
) -> Result<Response> {
    let Some(object) = env.bucket("CATALOG_RELEASES")?.get(key).execute().await? else {
        return json_response(&json!({ "error": "catalog_object_not_found" }), 404);
    };
    let Some(body) = object.body() else {
        return json_response(&json!({ "error": "catalog_object_has_no_body" }), 500);
    };
    let headers = cors_headers()?;
    headers.set("Content-Type", content_type)?;
    headers.set("Cache-Control", cache_control)?;
    Ok(Response::from_body(body.response_body()?)?.with_headers(headers))
}

fn json_response(value: &Value, status: u16) -> Result<Response> {
    Ok(Response::from_json(value)?
        .with_headers(cors_headers()?)
        .with_status(status))
}

fn cors_headers() -> Result<Headers> {
    let headers = Headers::new();
    headers.set("Access-Control-Allow-Origin", CORS_ORIGIN)?;
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS")?;
    headers.set("Access-Control-Allow-Headers", "Content-Type")?;
    headers.set("Access-Control-Max-Age", "86400")?;
    Ok(headers)
}

fn parse_json(value: Option<&str>) -> Value {
    value
        .and_then(|text| serde_json::from_str(text).ok())
        .unwrap_or(Value::Null)
}
