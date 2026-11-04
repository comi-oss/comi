# Comi

A minimal Tauri 2 app that opens [cf.mikira.id](https://cf.mikira.id/) directly in the system WebView. It displays only the unofficial Comifuro map: no custom shell, tabs, shop, character profile, or bundled web frontend.

The website supplies the map, search, and saved-booth list. Comi adds a pixel chest shortcut to that list above the map controls; it stays attached to the controls as the bottom sheet moves. Initial access requires internet. The map's artwork and data are not bundled or claimed by this repository.

## Requirements

Use Rust, Node.js 22+, and pnpm 10.32.1. Android builds use Java 21 and the Android SDK with `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`, and NDK `27.2.12479018`.

```sh
pnpm install --frozen-lockfile
rustup target add aarch64-linux-android x86_64-linux-android
pnpm android:dev
pnpm android:build
pnpm android:sign-preview
```

There is no frontend development server or JavaScript UI dependency. The only pnpm dependency is the Tauri CLI. The app's URL is configured in `src-tauri/tauri.conf.json`; `src-tauri/src/lib.rs` injects the inventory shortcut into the map page. The Pxlkit icon is attributed in the map footer; see [third-party notices](THIRD_PARTY_NOTICES.md). Generated Kotlin/Gradle files provide the standard Android host and compile/package the Rust library.

The Android build helper defaults to `.tools/android-sdk`, Java at `/usr/lib/jvm/java-21-openjdk-amd64`, and `.tools/gradle`. Override `ANDROID_HOME`, `NDK_HOME`, or `JAVA_HOME` for an existing installation. The checked-in Android project targets API 36 and supports Android 7.0+ (API 24). If regenerating it with `pnpm android:init`, check the requested SDK and preserve the pnpm invocation in `BuildTask.kt`.

For desktop development, `pnpm dev` runs the Tauri app and `pnpm build` creates desktop bundles; install the corresponding Tauri system prerequisites first.

## Android previews

The signing script creates optimized release APKs with a local development certificate using the conventional test password `android`. They are for sideloading, not store publication. Keep `.tools/preview.keystore` to install future updates over the same app; configure production signing separately before publishing.

- `artifacts/comi-arm64-v8a-preview.apk`: ARM64 Android phones.
- `artifacts/comi-x86_64-preview.apk`: x86_64 Waydroid.
- `artifacts/apk-sizes.json`: exact byte counts, MB/MiB sizes, and SHA-256 checksums.
- [`downloads/`](downloads/): signed preview snapshots and their size report. Package size excludes the system WebView and downloaded map data.

```sh
waydroid show-full-ui
# Find the current IP in `waydroid status`; accept ADB authorization if prompted.
adb connect 192.168.240.112:5555
adb install --no-incremental -r artifacts/comi-x86_64-preview.apk
adb shell am start -n id.mikira.cf.viewer/.MainActivity
```

## Waydroid orientation

```sh
pnpm waydroid:display portrait
pnpm waydroid:display landscape
pnpm waydroid:display toggle
```

Portrait uses 432 × 960; landscape uses 960 × 432. At 2× desktop scaling, Android renders at 864 × 1920 or 1920 × 864 internally. Switching briefly restarts the Waydroid session and reopens Comi. The helper waits for Android to boot and verifies the actual resolution before reporting success. A user systemd service keeps the restarted session alive; concurrent switches are rejected. Requires Waydroid, systemd user services, ADB, Bash, Python 3, and standard Linux tools. `potrait` is accepted as an alias.

`waydroid show-full-ui` means the full Android interface, not desktop fullscreen. For independent desktop windows per Android app, Waydroid also provides `persist.waydroid.multi_windows` mode.

## iOS

Build on macOS with Xcode and Tauri's iOS prerequisites installed:

```sh
pnpm tauri ios init
pnpm tauri ios dev
```

iOS compilation, signing, and package size have not been verified on this Linux machine.
