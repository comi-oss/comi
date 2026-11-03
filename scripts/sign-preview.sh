#!/usr/bin/env bash
# Signs optimized release APKs with a local development certificate for sideloading.
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
android_sdk="${ANDROID_HOME:-$project_dir/.tools/android-sdk}"
build_tools="$android_sdk/build-tools/36.0.0"
preview_keystore="$project_dir/.tools/preview.keystore"
mkdir -p artifacts .tools/aligned-apks
if [[ ! -f "$preview_keystore" ]]; then
  keytool -genkeypair -noprompt -keystore "$preview_keystore" \
    -alias preview -keyalg RSA -keysize 2048 -validity 3650 \
    -dname 'CN=CF Map Local Preview' -storepass android -keypass android
  chmod 600 "$preview_keystore"
fi
for abi in arm64-v8a x86_64; do
  input="src-tauri/gen/android/app/build/outputs/apk/$abi/release/app-$abi-release-unsigned.apk"
  aligned=".tools/aligned-apks/$abi.apk"
  output="artifacts/cf-map-$abi-preview.apk"
  if [[ ! -f "$input" ]]; then
    echo "Missing APK: $input. Run npm run android:build first." >&2
    exit 1
  fi
  "$build_tools/zipalign" -P 16 -f 4 "$input" "$aligned"
  "$build_tools/apksigner" sign --ks "$preview_keystore" \
    --ks-key-alias preview --ks-pass pass:android --key-pass pass:android \
    --out "$output" "$aligned"
  "$build_tools/apksigner" verify "$output"
done
python3 - <<'PY'
import hashlib, json
from pathlib import Path
report = []
for path in sorted(Path('artifacts').glob('cf-map-*-preview.apk')):
    size = path.stat().st_size
    report.append({'file': str(path), 'bytes': size, 'MB': round(size / 1_000_000, 2),
                   'MiB': round(size / 1_048_576, 2),
                   'sha256': hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()})
Path('artifacts/apk-sizes.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
PY
