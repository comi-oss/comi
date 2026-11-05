#!/usr/bin/env python3
"""Fetch the published D1 API into a versioned, read-only SQLite release."""
import hashlib
import json
import os
import pathlib
import sqlite3
import sys
import urllib.parse
import urllib.request

API = os.environ.get("COMI_CATALOG_API", "https://comi-catalog-api.ryanadi001.workers.dev")
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "dist/catalog")
OUT.mkdir(parents=True, exist_ok=True)
rows = []
offset = 0
while True:
    url = API + "/items?" + urllib.parse.urlencode({"event": "cf23", "limit": 100, "offset": offset})
    request = urllib.request.Request(url, headers={"User-Agent": "ComiCatalogPublisher/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        page = json.load(response)
    rows.extend(page["items"])
    offset += len(page["items"])
    print(f"Fetched {offset} catalog items", flush=True)
    if not page["hasMore"]:
        break

tmp = OUT / "catalog.sqlite.tmp"
tmp.unlink(missing_ok=True)
db = sqlite3.connect(tmp)
db.execute("PRAGMA journal_mode=DELETE")
db.execute("PRAGMA synchronous=FULL")
db.execute("""CREATE TABLE items (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT, fandom TEXT,
    characters_json TEXT, price_text TEXT, price_amount REAL, currency TEXT,
    variants_json TEXT, availability TEXT, confidence REAL, review_status TEXT,
    booth_id TEXT, booth_name TEXT, schedules_json TEXT, source_url TEXT,
    image_source TEXT
)""")
db.execute("CREATE INDEX items_name ON items(name COLLATE NOCASE)")
db.execute("CREATE INDEX items_booth ON items(booth_name COLLATE NOCASE, booth_id)")
db.execute("CREATE TABLE release_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
db.executemany("""INSERT INTO items VALUES (
    :id,:name,:category,:fandom,:characters,:priceText,:priceAmount,:currency,
    :variants,:availability,:confidence,:reviewStatus,:boothId,:boothName,
    :schedules,:sourceUrl,:imageSource
)""", [{**item,
    "characters": json.dumps(item.get("characters"), ensure_ascii=False),
    "variants": json.dumps(item.get("variants"), ensure_ascii=False),
    "schedules": json.dumps(item.get("schedules"), ensure_ascii=False),
} for item in rows])
db.execute("INSERT INTO release_meta VALUES ('event','cf23')")
db.execute("INSERT INTO release_meta VALUES ('item_count',?)", (str(len(rows)),))
db.commit()
db.close()
data = tmp.read_bytes()
digest = hashlib.sha256(data).hexdigest()
version = digest[:20]
filename = f"catalog-{version}.sqlite"
release = OUT / filename
tmp.replace(release)
manifest = {
    "version": version,
    "sha256": digest,
    "size": len(data),
    "itemCount": len(rows),
    "url": f"/catalog/{filename}",
}
(OUT / "current.json").write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
print(json.dumps({**manifest, "file": str(release)}))
