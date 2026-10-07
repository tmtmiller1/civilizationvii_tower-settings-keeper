#!/usr/bin/env bash
# release.sh: produce the release zip, the modder kit zip and the Steam Workshop manifest for Tower Settings Keeper.
#
# Usage:  ./release.sh
# Output: dist/tower-settings-keeper-vX.Y.Z.zip     (X.Y.Z from the modinfo <Version>; one folder, tower-settings-keeper/,
#                                                     with the modinfo at its root)
#         dist/settings-keeper-embed-vX.Y.Z.zip      (the file plus embed/README.md and the licence, for modders)
#         dist/workshop_item.vdf                      (steamcmd manifest, no preview file; set the preview on the web page)
# The mod folder includes embed/README.md, so a Workshop subscription is the kit too. The game ignores the file.
# The change note comes from CHANGELOG.steam.txt, which scripts/steam-changelog.mjs keeps in step with CHANGELOG.md.
# The description is included only for the first upload (no steam_workshop_id.txt yet) or when WITH_DESCRIPTION=1.
# The quality gate (lint, syntax, tests) runs first. Set SKIP_VERIFY=1 to skip it.

set -euo pipefail
cd "$(dirname "$0")"

MODINFO="tower-settings-keeper.modinfo"
MOD_DIR="tower-settings-keeper"
TITLE="Tower Settings Keeper"
APPID="1295660"
DIST_DIR="dist"

VERSION="$(grep -oE '<Version>[^<]+</Version>' "$MODINFO" | head -1 | sed -E 's|</?Version>||g')"
[ -n "$VERSION" ] || { echo "error: could not parse <Version> from $MODINFO"; exit 1; }
case "$VERSION" in *-dev|0.0.*) echo "error: <Version> '$VERSION' looks like a dev tag."; exit 1;; esac

if [ "${SKIP_VERIFY:-0}" != "1" ]; then
    echo "release: running 'npm run release:gate' (set SKIP_VERIFY=1 to skip)..."
    npm run release:gate || { echo "release: gate FAILED, aborting."; exit 1; }
fi
command -v xmllint >/dev/null 2>&1 && xmllint --noout "$MODINFO" text/en_us/*.xml

WORKSHOP_ID_FILE="steam_workshop_id.txt"
PUBLISHED_FILE_ID=""
[ -f "$WORKSHOP_ID_FILE" ] && PUBLISHED_FILE_ID="$(tr -dc '0-9' < "$WORKSHOP_ID_FILE")"

ZIP_NAME="${MOD_DIR}-v${VERSION}.zip"
TARGET_DIR="$DIST_DIR/$MOD_DIR"
rm -rf "$DIST_DIR"; mkdir -p "$TARGET_DIR/embed"
cp "$MODINFO" README.md CHANGELOG.md LICENSE "$TARGET_DIR/"
cp -R ui text "$TARGET_DIR/"
cp embed/README.md "$TARGET_DIR/embed/README.md"
mkdir -p "$TARGET_DIR/docs"; cp -R docs/readme "$TARGET_DIR/docs/readme"
(cd "$DIST_DIR" && zip -qr "$ZIP_NAME" "$MOD_DIR" -x '*.DS_Store')

# the modder-side kit: the one file plus its instructions
EMBED_DIR="$DIST_DIR/settings-keeper-embed"; mkdir -p "$EMBED_DIR"
cp ui/settings-keeper.js "$EMBED_DIR/"; cp embed/README.md "$EMBED_DIR/README.md"; cp LICENSE "$EMBED_DIR/"
(cd "$DIST_DIR" && zip -qr "settings-keeper-embed-v${VERSION}.zip" settings-keeper-embed -x '*.DS_Store')

ABS_CONTENT="$(cd "$TARGET_DIR" && pwd)"

# Change note: VDF-safe (no straight double quotes, no backslashes); a hand-edited block is kept.
CHANGENOTE="$(node scripts/steam-changelog.mjs note "$VERSION")" \
    || { echo "error: could not build the Steam change note (see above)"; exit 1; }

# Description: under Steam's 8000-character cap, straight quotes swapped for curly ones (steamcmd's KeyValues
# parser has no escape for a literal double quote).
DESC_SRC="docs/steam-workshop-description.txt"
DESCRIPTION=""
if [ -z "$PUBLISHED_FILE_ID" ] || [ "${WITH_DESCRIPTION:-0}" = "1" ]; then
    [ -f "$DESC_SRC" ] || { echo "error: $DESC_SRC missing"; exit 1; }
    DESCRIPTION="$(sed -E "s/\\\\/\\\\\\\\/g; s/'/’/g; s/\"([^\"]*)\"/“\\1”/g" "$DESC_SRC")"
    DESC_LEN="$(printf '%s' "$DESCRIPTION" | wc -c | tr -d ' ')"
    [ "$DESC_LEN" -le 8000 ] || { echo "error: description is $DESC_LEN bytes; Steam rejects more than 8000."; exit 1; }
fi

VDF="$DIST_DIR/workshop_item.vdf"
{
    echo '"workshopitem"'; echo '{'
    echo "    \"appid\"          \"$APPID\""
    [ -n "$PUBLISHED_FILE_ID" ] && echo "    \"publishedfileid\" \"$PUBLISHED_FILE_ID\""
    echo "    \"contentfolder\"  \"$ABS_CONTENT\""
    echo "    \"visibility\"     \"0\""
    echo "    \"title\"          \"$TITLE\""
    [ -n "$DESCRIPTION" ] && printf '    "description"    "%s"\n' "$DESCRIPTION"
    echo "    \"changenote\"     \"${CHANGENOTE}\""
    echo '}'
} > "$VDF"

echo "==> Zip contents"
unzip -l "$DIST_DIR/$ZIP_NAME" | awk 'NR>3 && $4 != "" {print $4}' | grep -v '/$' | sort
echo "==> $DIST_DIR/$ZIP_NAME and $DIST_DIR/settings-keeper-embed-v${VERSION}.zip ready (version $VERSION); manifest $VDF"
if [ -n "$PUBLISHED_FILE_ID" ]; then
    echo "  UPDATE mode: publishedfileid $PUBLISHED_FILE_ID"
else
    echo "  NEW-ITEM mode: the first upload mints a publishedfileid; save it so later runs update the same item:"
    echo "     echo <publishedfileid> > steam_workshop_id.txt"
fi
