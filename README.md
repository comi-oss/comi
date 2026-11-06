# Comi

## Catalog release publishing

The catalog API can publish immutable SQLite snapshots from the live D1-backed
`/items` endpoint to the `comi-catalog-releases` R2 bucket. The app checks the
small current manifest when it opens the shopping list, downloads a changed
snapshot once, verifies its SHA-256, and reads the local SQLite copy thereafter.
The last installed copy stays available offline. Before the first snapshot is
published, the app continues using the existing D1 API.

R2 must first be enabled for the Cloudflare account in the dashboard. Then create
the bucket once and publish a release using Wrangler (the script reads the
existing `../scraper/.env` token without printing it):

```sh
pnpm dlx wrangler r2 bucket create comi-catalog-releases
pnpm catalog:publish
```

`pnpm catalog:publish` fetches the current catalog, builds a compact SQLite
snapshot under ignored `dist/catalog/`, deploys the Worker with its R2 binding,
uploads the immutable database, then updates the current manifest. Run it again
after scraper data has been synced to D1.

A minimal Tauri 2 app that opens [cf.mikira.id](https://cf.mikira.id/) directly in the system WebView and adds a Comifuro shopping list.

The website supplies the map, search, and saved-booth list. Comi adds a chest shortcut above the map controls; it stays attached as the bottom sheet moves and opens a searchable catalog and locally saved shopping list with quantities and a running total. Catalog reads use the public, read-only Rust Cloudflare Worker in [src/cloudflare-worker](src/cloudflare-worker), bound to the scraper's Comi D1 database and catalog R2 bucket. Shopping list entries stay on the device. Extracted catalog prices and items may need review. Initial map and catalog access require internet. The map's artwork and data are not bundled or claimed by this repository.

## Requirements

Use Rust, Node.js 22+, and pnpm 10.32.1. Android builds use Java 21 and the Android SDK with `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`, and NDK `27.2.12479018`.

```sh
pnpm install --frozen-lockfile
rustup target add aarch64-linux-android x86_64-linux-android
pnpm android:dev
pnpm android:build
pnpm android:sign-preview
```

There is no frontend development server or JavaScript UI dependency. The only pnpm dependency is the Tauri CLI. The Tauri crate is in `src/`; its URL is configured in `src/tauri.conf.json`, and `src/src/lib.rs` injects the shopping-list shortcut and uses a narrow Rust command to fetch catalog data because the map's Content Security Policy blocks direct cross-origin requests. The separate Rust Worker crate is in `src/cloudflare-worker/`; it compiles to WebAssembly and deploys independently with `pnpm worker:deploy`. The Worker is co-located with the Tauri Rust source but is not linked into the Android/iOS app binary. The UI follows the map website language and color theme. The API URL is public; no Cloudflare credentials are shipped in the app. Generated Kotlin/Gradle files provide the standard Android host and compile/package the Tauri library.

The Android build helper defaults to `.tools/android-sdk`, Java at `/usr/lib/jvm/java-21-openjdk-amd64`, and `.tools/gradle`. Override `ANDROID_HOME`, `NDK_HOME`, or `JAVA_HOME` for an existing installation. The checked-in Android project targets API 36 and supports Android 7.0+ (API 24). If regenerating it with `pnpm android:init`, check the requested SDK and preserve the pnpm invocation in `BuildTask.kt`.

For desktop development, `pnpm dev` runs the Tauri app and `pnpm build` creates desktop bundles; install the corresponding Tauri system prerequisites first.

## Android previews

The signing script creates optimized release APKs with a local development certificate using the conventional test password `android`. They are for sideloading, not store publication. Keep `.tools/preview.keystore` to install future updates over the same app; configure production signing separately before publishing.

- `artifacts/comi-arm64-v8a-preview.apk`: ARM64 Android phones.
- `artifacts/comi-x86_64-preview.apk`: x86_64 Waydroid.
- `artifacts/apk-sizes.json`: exact byte counts, MB/MiB sizes, and SHA-256 checksums.
- Merged pull requests to `main` produce Android ARM64 and iOS builds in a GitHub release. The Android APK is signed with the repository's preview key. iOS builds use free Personal Team development signing when the three signing secrets below are configured; otherwise CI attaches an unsigned IPA.

### Free iOS device signing

For personal testing, sign into Xcode on a Mac with your Apple Account and use its free **Personal Team**. Connect and register your iPhone, then build and run once from Xcode. Xcode creates a development certificate and a provisioning profile for that device. Export the Apple Development identity (including its private key) as a password-protected `.p12`; copy the matching `.mobileprovision` from `~/Library/MobileDevice/Provisioning Profiles/`.

Store base64-encoded contents as GitHub Actions secrets named `IOS_CERTIFICATE`, `IOS_CERTIFICATE_PASSWORD`, and `IOS_MOBILE_PROVISION`. CI validates the PKCS#12 password, profile expiration, app identifier, and registered devices before asking Tauri to export a development-signed IPA. Keep the certificate, password, and profile from the same Xcode signing setup; a mismatched password makes the certificate impossible to import. Do not commit the `.p12` or profile. If these secrets are absent, CI publishes an unsigned IPA instead.

This free route is for your own device testing only. Personal Team App IDs, registered devices, and provisioning profiles expire after seven days, so refresh the profile and update the secret regularly; the app must be rebuilt and reinstalled after expiry. It cannot publish to TestFlight or the App Store. Apple requires paid Developer Program membership for those distribution features.

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

Copy the latest Waydroid screen recording from `/sdcard/Movies` into the host `~/Videos` folder:

```sh
pnpm waydroid:recording
# Or copy one specific file:
pnpm waydroid:recording -- screen-20261104-152712.mp4
```

If multiple ADB devices are connected, the helper selects Waydroid when it can identify it; otherwise set `ANDROID_SERIAL`.

## iOS

Build on macOS with Xcode and Tauri's iOS prerequisites installed:

```sh
pnpm tauri ios init
pnpm tauri ios dev
```

iOS compilation, signing, and package size have not been verified on this Linux machine.
