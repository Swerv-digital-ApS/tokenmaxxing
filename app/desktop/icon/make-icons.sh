#!/usr/bin/env bash
# Regenerates the app icons (src-tauri/icons/) and the menu bar icon from the Swift renderers here.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
swift "$DIR/make-icon.swift" "$TMP/icon_1024.png"
(cd "$DIR/.." && bunx tauri icon "$TMP/icon_1024.png" --output src-tauri/icons)
# Keep icon.ico for the Windows installer; mobile/store assets are unused.
(cd "$DIR/../src-tauri/icons" && rm -rf android ios Square*.png StoreLogo.png 64x64.png)
swift "$DIR/make-tray-icon.swift" "$DIR/../src-tauri/icons/tray.png"
rm -rf "$TMP"
