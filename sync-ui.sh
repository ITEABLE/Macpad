#!/bin/bash
# Push UI changes to the running app without rebuilding.
#
# Rebuilding re-signs MacPad.app, which makes macOS drop its Accessibility
# grant. Editing only web/index.html avoids that entirely: the app reads the
# UI from Application Support, so this just copies and you reload the phone.
set -euo pipefail
cd "$(dirname "$0")"
SUPPORT="$HOME/Library/Application Support/MacPad"
mkdir -p "$SUPPORT"
rm -rf "$SUPPORT/web"
cp -R web "$SUPPORT/web"
echo "UI synced to $SUPPORT/web"
echo "Pull down to reload the page on your phone - that's it."
