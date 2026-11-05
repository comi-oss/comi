#!/usr/bin/env bash
set -euo pipefail

if [[ ${1:-} == "--help" || ${1:-} == "-h" ]]; then
  cat <<'HELP'
Copy a Waydroid screen recording into ~/Videos.

Usage:
  pnpm waydroid:recording
  pnpm waydroid:recording -- screen-20261104-152712.mp4

By default, copies the newest MP4 in /sdcard/Movies.
Set ANDROID_SERIAL if more than one ADB device is connected.
HELP
  exit 0
fi

command -v adb >/dev/null 2>&1 || { echo "adb is required." >&2; exit 1; }

serial=${ANDROID_SERIAL:-}
if [[ -z $serial ]]; then
  mapfile -t online < <(adb devices -l | awk 'NR > 1 && $2 == "device" {print $1}')
  if (( ${#online[@]} == 0 )); then
    echo "No online ADB devices. Start Waydroid and connect it with adb first." >&2
    exit 1
  elif (( ${#online[@]} == 1 )); then
    serial=${online[0]}
  else
    serial=$(adb devices -l | awk 'NR > 1 && $2 == "device" && tolower($0) ~ /waydroid/ {print $1; exit}')
    if [[ -z $serial ]]; then
      echo "Multiple ADB devices found. Set ANDROID_SERIAL to the Waydroid serial." >&2
      adb devices -l >&2
      exit 1
    fi
  fi
fi
adb_cmd=(adb -s "$serial")

if [[ -n ${1:-} ]]; then
  filename=$1
  if [[ $filename == */* || $filename != *.mp4 ]]; then
    echo "Pass only an MP4 filename from Waydroid's Movies folder." >&2
    exit 1
  fi
  source_path="/sdcard/Movies/$filename"
  if ! "${adb_cmd[@]}" shell test -f "$source_path"; then
    echo "Recording not found: $source_path" >&2
    exit 1
  fi
else
  files=$("${adb_cmd[@]}" shell 'ls -t /sdcard/Movies/*.mp4 2>/dev/null' | tr -d '\r' || true)
  source_path=$(printf '%s\n' "$files" | sed -n '1p')
  if [[ -z $source_path ]]; then
    echo "No MP4 recordings found in /sdcard/Movies on $serial." >&2
    exit 1
  fi
  filename=${source_path##*/}
fi

destination="$HOME/Videos/$filename"
mkdir -p "$HOME/Videos"
"${adb_cmd[@]}" pull "$source_path" "$destination"
echo "Saved to $destination"
