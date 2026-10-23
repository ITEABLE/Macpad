#!/bin/bash
# Build MacPad.app — a self-contained menu bar app.
set -euo pipefail
cd "$(dirname "$0")"

APP="MacPad.app"
BIN="$APP/Contents/MacOS/MacPad"

echo "==> Compiling (optimized, arm64)…"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -O -swift-version 5 \
  -framework AppKit -framework Network -framework CryptoKit -framework CoreImage \
  -o "$BIN" Sources/*.swift

echo "==> Assembling bundle…"
cp -R web "$APP/Contents/Resources/web"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>MacPad</string>
  <key>CFBundleDisplayName</key><string>MacPad</string>
  <key>CFBundleIdentifier</key><string>local.macpad.trackpad</string>
  <key>CFBundleExecutable</key><string>MacPad</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSLocalNetworkUsageDescription</key>
  <string>MacPad serves the trackpad page to your iPhone over your local network.</string>
</dict>
</plist>
PLIST

echo "==> Signing (ad-hoc)…"
codesign --force --sign - --identifier local.macpad.trackpad "$APP" >/dev/null 2>&1 \
  || codesign --force --sign - "$APP"

echo "==> Installing to /Applications…"
# Always run from one fixed location. Two copies of the app means two entries in
# the Accessibility list, and granting the wrong one is impossible to debug.
osascript -e 'tell application "MacPad" to quit' 2>/dev/null || true
pkill -x MacPad 2>/dev/null || true
sleep 1
rm -rf /Applications/MacPad.app
cp -R "$APP" /Applications/MacPad.app
codesign --force --deep --sign - --identifier local.macpad.trackpad /Applications/MacPad.app >/dev/null 2>&1
xattr -cr /Applications/MacPad.app 2>/dev/null || true
rm -rf "$APP"

# Mirror the UI into the writable folder the app prefers, so later tweaks to
# web/index.html can be applied with ./sync-ui.sh instead of a full rebuild.
SUPPORT="$HOME/Library/Application Support/MacPad"
mkdir -p "$SUPPORT"
rm -rf "$SUPPORT/web"
cp -R web "$SUPPORT/web"

echo
echo "Installed /Applications/MacPad.app"
echo "Launch it with:  open /Applications/MacPad.app"
echo
echo "NOTE: rebuilding changes the app's ad-hoc signature, so macOS drops the"
echo "Accessibility grant. If the mouse stops responding after a rebuild, run:"
echo "  tccutil reset Accessibility local.macpad.trackpad"
echo "then relaunch and switch MacPad back on in System Settings."
