const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    if (url.pathname === "/health") return json({ ok: true, service: "comi-catalog-api" });
    if (url.pathname !== "/items") return json({ error: "not_found" }, 404);

    const event = url.searchParams.get("event") || "cf23";
    if (!/^[a-z0-9-]{1,32}$/.test(event)) return json({ error: "invalid_event" }, 400);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const offset = Math.min(100000, Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0));
    const query = (url.searchParams.get("q") || "").trim().slice(0, 120);
    const booth = (url.searchParams.get("booth") || "").trim().slice(0, 160);

    const sql = `SELECT id, name, category, fandom, characters_json, price_text,
          price_amount, currency, variants_json, availability, confidence,
          review_status, event_circle_id, circle_name, schedules_json, source_url, image_source
        FROM unique_event_items
        WHERE event_id = ?1
          AND (?2 = '' OR lower(circle_name) = lower(?2) OR event_circle_id = ?2)
          AND (?3 = '' OR name LIKE ?3 ESCAPE '\\' COLLATE NOCASE OR circle_name LIKE ?3 ESCAPE '\\' COLLATE NOCASE)
        ORDER BY circle_name COLLATE NOCASE, name COLLATE NOCASE
        LIMIT ?4 OFFSET ?5`;
    const pattern = query ? `%${query.replace(/[\\%_]/g, "\\$&")}%` : "";
    const params = [event, booth, pattern, limit + 1, offset];
    const rows = await env.DB.prepare(sql).bind(...params).all();
    const items = rows.results.slice(0, limit).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      fandom: row.fandom,
      characters: parseJson(row.characters_json),
      priceText: row.price_text,
      priceAmount: row.price_amount,
      currency: row.currency,
      variants: parseJson(row.variants_json),
      availability: row.availability,
      confidence: row.confidence,
      reviewStatus: row.review_status,
      boothId: row.event_circle_id,
      boothName: row.circle_name,
      schedules: parseJson(row.schedules_json),
      sourceUrl: row.source_url,
      imageSource: row.image_source,
    }));
    return json({ event, items, limit, offset, hasMore: rows.results.length > limit });
  },
};

function parseJson(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}
