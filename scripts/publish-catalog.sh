#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRAPER_ENV="$ROOT/../scraper/.env"
if [[ ! -f "$SCRAPER_ENV" ]]; then
  echo "Missing ../scraper/.env (needed for the authenticated Wrangler token)." >&2
  exit 1
fi

set -a
source "$SCRAPER_ENV"
set +a

OUT="$ROOT/dist/catalog"
python3 "$ROOT/scripts/publish-catalog.py" "$OUT"
MANIFEST="$OUT/current.json"
VERSION="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' "$MANIFEST")"
FILE="$(python3 -c 'import json,sys,os;print(os.path.basename(json.load(open(sys.argv[1]))["url"]))' "$MANIFEST")"

(cd "$ROOT/src/cloudflare-worker" && pnpm dlx wrangler deploy)
pnpm dlx wrangler r2 object put "comi-catalog-releases/catalog/$FILE" \
  --file "$OUT/$FILE" --content-type application/vnd.sqlite3 \
  --cache-control 'public, max-age=31536000, immutable' --remote
pnpm dlx wrangler r2 object put comi-catalog-releases/catalog/current.json \
  --file "$MANIFEST" --content-type application/json \
  --cache-control 'public, max-age=60, s-maxage=300' --remote
echo "Published catalog release $VERSION"
