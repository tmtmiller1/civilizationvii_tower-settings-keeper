#!/usr/bin/env bash
# release.sh: produce the release zip for Tower Settings Keeper.
#
# Usage:  ./release.sh
# Output: dist/tower-settings-keeper-vX.Y.Z.zip   (X.Y.Z from the modinfo <Version>; the zip holds one folder,
#                                                   tower-settings-keeper/, with the modinfo at its root)
# Runs the quality gate first (lint, syntax, tests); set SKIP_VERIFY=1 to bypass.

set -euo pipefail
cd "$(dirname "$0")"

MODINFO="tower-settings-keeper.modinfo"
MOD_DIR="tower-settings-keeper"
DIST_DIR="dist"

VERSION="$(grep -oE '<Version>[^<]+</Version>' "$MODINFO" | head -1 | sed -E 's|</?Version>||g')"
[ -n "$VERSION" ] || { echo "error: could not parse <Version> from $MODINFO"; exit 1; }
case "$VERSION" in *-dev|0.0.*) echo "error: <Version> '$VERSION' looks like a dev tag."; exit 1;; esac

if [ "${SKIP_VERIFY:-0}" != "1" ]; then
    echo "release: running 'npm run release:gate' (set SKIP_VERIFY=1 to skip)..."
    npm run release:gate || { echo "release: gate FAILED, aborting."; exit 1; }
fi
command -v xmllint >/dev/null 2>&1 && xmllint --noout "$MODINFO" text/en_us/*.xml

ZIP_NAME="${MOD_DIR}-v${VERSION}.zip"
TARGET_DIR="$DIST_DIR/$MOD_DIR"
rm -rf "$DIST_DIR"; mkdir -p "$TARGET_DIR"
cp "$MODINFO" README.md CHANGELOG.md LICENSE "$TARGET_DIR/"
cp -R ui text "$TARGET_DIR/"
(cd "$DIST_DIR" && zip -qr "$ZIP_NAME" "$MOD_DIR" -x '*.DS_Store')

echo "==> Zip contents"
unzip -l "$DIST_DIR/$ZIP_NAME" | awk 'NR>3 && $4 != "" {print $4}' | grep -v '/$' | sort
echo "==> $DIST_DIR/$ZIP_NAME ready (version $VERSION)"
