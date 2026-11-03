# CF Map

A minimal Tauri 2 mobile viewer for [cf.mikira.id](https://cf.mikira.id/), the unofficial Comifuro map. React 19 and Tamagui 3 provide the loading and connection retry screen. The app then navigates its WebView directly to the map, with no app toolbar or additional tabs.

The website rejects iframe embedding, so this viewer uses full-page navigation. Map behavior, search, favorites, and data remain provided by the original website. Initial loading needs internet access. This repository does not bundle or claim ownership of the website or map data.

## Download the Android preview

| Device | Signed APK | Size |
|---|---|---|
| ARM64 Android phone | [Download](downloads/cf-map-arm64-v8a-preview.apk) | 6.83 MB (6,830,673 bytes) |
| x86_64 Waydroid | [Download](downloads/cf-map-x86_64-preview.apk) | 7.18 MB (7,182,926 bytes) |

These are optimized release builds signed with a local preview certificate for sideloading. Exact sizes and SHA-256 hashes are in [the size report](downloads/apk-sizes.json). Sizes exclude the system WebView and downloaded website data.

Verified: both APK signatures, two production frontend tests, loading the live map at phone size, and installation plus map rendering in Waydroid. ARM64 was compiled and signed but has not been run on a physical phone.

## Run and verify

```sh
npm ci
npm run dev
npm test
```

Tests run the production frontend at a 432 × 960 viewport and verify direct navigation and offline recovery. They use Google Chrome at `/usr/bin/google-chrome`; set `CHROME_PATH` to override that path. `npm run build` checks TypeScript and produces the web bundle.

## Android

Use Java 21, Rust, and the Android SDK with `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`, and NDK `27.2.12479018`. Add Rust targets:

```sh
rustup target add aarch64-linux-android x86_64-linux-android
```

The build helper defaults to `.tools/android-sdk`, Java at `/usr/lib/jvm/java-21-openjdk-amd64`, and `.tools/gradle` for Gradle downloads. Override `ANDROID_HOME`, `NDK_HOME`, or `JAVA_HOME` to use an existing installation. The checked-in Android project targets API 36 and supports Android 7.0+ (API 24).

```sh
npm run android:dev
npm run android:build
npm run android:sign-preview
```

The Android project is already generated. If regenerating with `npm run android:init`, check the template's compile/target SDK and retain API 36, or install the SDK version requested by the template.

Release APKs are split by architecture. `android:sign-preview` signs them with an automatically generated **local development certificate** using the conventional test password `android`. These builds are for local sideloading, not store publication. Keep `.tools/preview.keystore` if you want to install future updates over the same app; use a separate production signing setup before publishing.

- `artifacts/cf-map-arm64-v8a-preview.apk`: ARM64 Android phones.
- `artifacts/cf-map-x86_64-preview.apk`: Waydroid on this computer.
- `artifacts/apk-sizes.json`: exact byte counts, MB/MiB sizes, and SHA-256 checksums.

Build tools, caches, screenshots, and local APK outputs are ignored by Git. The `downloads/` directory contains the signed preview snapshots linked above.

For Waydroid, start Android and accept its ADB authorization dialog when prompted:

```sh
waydroid show-full-ui
# Find the current IP in `waydroid status`.
adb connect 192.168.240.112:5555
adb install --no-incremental -r artifacts/cf-map-x86_64-preview.apk
adb shell am start -n id.mikira.cf.viewer/.MainActivity
```

## iOS

The shared app can be built with Tauri on macOS with Xcode and the iOS prerequisites installed:

```sh
npm run tauri -- ios init
npm run tauri -- ios dev
```

iOS compilation, signing, and package size have not been verified on this Linux machine.

## Scope

No custom native commands or plugins are exposed to the hosted website. The only Android permission requested by this viewer is internet access. Tamagui styles the local loading/retry screen; the map's interface retains the website's own design.
