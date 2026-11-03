#!/usr/bin/env bash
# Host-window dimensions are applied when Waydroid starts its session.
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$project_dir/.tools"
exec 9>"$project_dir/.tools/waydroid-display.lock"
flock -n 9 || { echo 'Another display switch is still running.' >&2; exit 1; }
mode="${1:-toggle}"
case "$mode" in
  portrait|potrait|landscape|toggle) ;;
  *) echo 'Usage: bash scripts/waydroid-display.sh [portrait|landscape|toggle]' >&2; exit 2 ;;
esac
[[ "$mode" != potrait ]] || mode=portrait
unit=comi-waydroid-preview.service
start_session() {
  systemctl --user stop "$unit" 2>/dev/null || true
  systemd-run --user --quiet --unit=comi-waydroid-preview --collect \
    --property=RemainAfterExit=yes \
    --setenv="WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-wayland-0}" \
    /usr/bin/waydroid show-full-ui
}
wait_ready() {
  local deadline=$((SECONDS + 120))
  while (( SECONDS < deadline )); do
    ip="$(waydroid status | awk '/IP address:/ { print $NF }')"
    if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      serial="$ip:5555"
      timeout 3 adb connect "$serial" >/dev/null 2>&1 || true
      if [[ "$(timeout 3 adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)" == 1 ]] &&
         timeout 3 adb -s "$serial" shell pm path android 2>/dev/null | grep -q '^package:'; then
        return 0
      fi
    fi
    sleep 1
  done
  echo 'Android did not finish booting. Check Waydroid or accept the ADB authorization dialog.' >&2
  return 1
}
if ! waydroid status | grep -q 'Session:.*RUNNING'; then start_session; fi
wait_ready
current_width="$(adb -s "$serial" shell getprop persist.waydroid.width | tr -d '\r')"
if [[ "$mode" == toggle ]]; then
  if [[ "$current_width" == 960 ]]; then mode=portrait; else mode=landscape; fi
fi
if [[ "$mode" == portrait ]]; then width=432; height=960; else width=960; height=432; fi
echo "Switching to $mode ($width x $height). Briefly restarting Waydroid to resize its window."
waydroid prop set persist.waydroid.width "$width"
waydroid prop set persist.waydroid.height "$height"
actual_width="$(adb -s "$serial" shell getprop persist.waydroid.width | tr -d '\r')"
actual_height="$(adb -s "$serial" shell getprop persist.waydroid.height | tr -d '\r')"
if [[ "$actual_width" != "$width" || "$actual_height" != "$height" ]]; then
  echo 'Waydroid did not accept the display settings; no restart performed.' >&2
  exit 1
fi
waydroid session stop
start_session
wait_ready
adb -s "$serial" shell wm size reset
adb -s "$serial" shell wm density 320
adb -s "$serial" shell wm user-rotation lock 0
scale="$(adb -s "$serial" shell getprop waydroid.display_scale | tr -d '\r')"
expected="$(python3 -c 'import sys; s=float(sys.argv[3] or 1); print(f"{round(int(sys.argv[1])*s)}x{round(int(sys.argv[2])*s)}")' "$width" "$height" "$scale")"
actual="$(adb -s "$serial" shell wm size | sed -n 's/^Physical size: //p' | tr -d '\r')"
if [[ "$actual" != "$expected" ]]; then
  echo "Display switch failed: requested $expected, Android reports $actual." >&2
  exit 1
fi
if adb -s "$serial" shell pm path id.mikira.cf.viewer 2>/dev/null | grep -q '^package:'; then
  adb -s "$serial" shell am start -n id.mikira.cf.viewer/.MainActivity
fi
printf 'Verified %s: %s logical, %s internal pixels.\n' "$mode" "${width}x${height}" "$actual"
